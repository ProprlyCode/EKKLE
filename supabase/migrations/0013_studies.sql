-- Self-hosted interactive studies: a progressively-unlocked library of
-- paginated workbooks. Each study is pages of authored blocks; some blocks
-- carry fill-in blanks ({{}} tokens in the text). A recipient fills the blanks
-- across pages and submits on the final page; completing study N unlocks N+1.
--
-- Recipients never touch these tables directly — everything runs through the
-- SECURITY DEFINER RPCs below, keyed by the device session token (same identity
-- model as the rest of the recipient experience).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists studies (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  sort_order  int  not null default 0,     -- defines the unlock sequence
  number      int,                         -- lesson number shown to readers (e.g. 1 of 27)
  title       text not null,
  tagline     text,                        -- the "Discover" lead line
  status      text not null default 'approved' check (status in ('draft', 'approved')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists studies_org_idx on studies (org_id, sort_order);
create trigger studies_updated_at
  before update on studies
  for each row execute function set_updated_at();

create table if not exists study_pages (
  id           uuid primary key default gen_random_uuid(),
  study_id     uuid not null references studies (id) on delete cascade,
  page_number  int  not null,
  blocks       jsonb not null default '[]'::jsonb, -- [{t:'h'|'p'|'img', text|src}]
  unique (study_id, page_number)
);

create table if not exists study_progress (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references recipients (id) on delete cascade,
  study_id      uuid not null references studies (id) on delete cascade,
  last_page     int  not null default 1,
  answers       jsonb not null default '{}'::jsonb, -- { "<blank index>": "<value>" }
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (recipient_id, study_id)
);
create index if not exists study_progress_recipient_idx on study_progress (recipient_id);
create trigger study_progress_updated_at
  before update on study_progress
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default. Recipients reach studies only through the RPCs below
-- (SECURITY DEFINER). Leadership can manage their org's studies for authoring.
-- ---------------------------------------------------------------------------
alter table studies        enable row level security;
alter table study_pages    enable row level security;
alter table study_progress enable row level security;

drop policy if exists studies_leadership_all on studies;
create policy studies_leadership_all on studies
  for all to authenticated
  using (is_leadership() and org_id = app_user_org())
  with check (is_leadership() and org_id = app_user_org());

drop policy if exists study_pages_leadership_all on study_pages;
create policy study_pages_leadership_all on study_pages
  for all to authenticated
  using (exists (select 1 from studies s
                 where s.id = study_pages.study_id
                   and is_leadership() and s.org_id = app_user_org()))
  with check (exists (select 1 from studies s
                 where s.id = study_pages.study_id
                   and is_leadership() and s.org_id = app_user_org()));
-- study_progress: no table policies — RPC-only (per-recipient, no auth user).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Find (or create) the recipient row for a device session within an org.
-- Bare study visitors have no lead yet; we create a minimal, consent-free
-- recipient so their progress can be saved and resumed across pages/devices.
create or replace function _study_recipient(p_session_token text, p_org_id uuid)
returns recipients
language plpgsql
security definer
set search_path = public
as $$
declare v_recipient recipients;
begin
  select * into v_recipient from recipients
  where session_token = p_session_token and deleted_at is null limit 1;

  if not found then
    insert into recipients (org_id, session_token)
    values (p_org_id, p_session_token)
    returning * into v_recipient;
  end if;

  return v_recipient;
end;
$$;

-- The pilot is single-org; resolve the org a visitor's library belongs to.
-- Prefer the recipient's own org, else the sole/first organization.
create or replace function _study_org(p_session_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select org_id from recipients
      where session_token = p_session_token and deleted_at is null limit 1),
    (select id from organizations order by created_at asc limit 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs (anon-safe)
-- ---------------------------------------------------------------------------
-- The library: every approved study for the org, with lock + completion state.
-- Study N is unlocked when the study immediately before it (by sort_order) is
-- completed for this recipient; the first study is always unlocked.
create or replace function list_studies(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_rec uuid;
  v_result jsonb;
begin
  v_org := _study_org(p_session_token);
  select id into v_rec from recipients
    where session_token = p_session_token and deleted_at is null limit 1;

  with ordered as (
    select s.*,
           row_number() over (order by s.sort_order, s.created_at) as rn,
           (select p.completed_at is not null
              from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec) as completed
    from studies s
    where s.org_id = v_org and s.status = 'approved'
  ),
  flagged as (
    select o.*,
           coalesce(o.completed, false) as done,
           coalesce(lag(o.completed) over (order by o.rn), true) as prev_done
    from ordered o
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'number', number,
           'title', title,
           'tagline', tagline,
           'completed', done,
           'locked', not (rn = 1 or prev_done)
         ) order by rn), '[]'::jsonb)
  into v_result
  from flagged;

  return v_result;
end;
$$;
grant execute on function list_studies(text) to anon, authenticated;

-- One study's pages + this recipient's saved progress. Refuses a locked study.
create or replace function get_study(p_session_token text, p_study_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_rec uuid;
  v_study studies;
  v_locked boolean;
  v_result jsonb;
begin
  v_org := _study_org(p_session_token);
  select * into v_study from studies
    where id = p_study_id and org_id = v_org and status = 'approved' limit 1;
  if not found then return null; end if;

  select id into v_rec from recipients
    where session_token = p_session_token and deleted_at is null limit 1;

  -- Locked iff a strictly-earlier study is not yet completed.
  v_locked := exists (
    select 1 from studies e
    where e.org_id = v_org and e.status = 'approved'
      and (e.sort_order, e.created_at) < (v_study.sort_order, v_study.created_at)
      and not exists (
        select 1 from study_progress p
        where p.study_id = e.id and p.recipient_id = v_rec
          and p.completed_at is not null
      )
  );
  if v_locked then
    return jsonb_build_object('locked', true);
  end if;

  select jsonb_build_object(
    'id', v_study.id,
    'number', v_study.number,
    'title', v_study.title,
    'tagline', v_study.tagline,
    'locked', false,
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks
      ) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id
    ), '[]'::jsonb),
    'progress', (
      select jsonb_build_object(
        'last_page', p.last_page, 'answers', p.answers,
        'completed', p.completed_at is not null
      )
      from study_progress p
      where p.study_id = v_study.id and p.recipient_id = v_rec
    )
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function get_study(text, uuid) to anon, authenticated;

-- Save where the reader is + their answers so far (resume across devices).
create or replace function save_study_progress(
  p_session_token text, p_study_id uuid, p_last_page int, p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_study studies;
  v_rec recipients;
begin
  select * into v_study from studies where id = p_study_id and status = 'approved' limit 1;
  if not found then return; end if;

  v_rec := _study_recipient(p_session_token, v_study.org_id);

  insert into study_progress (recipient_id, study_id, last_page, answers)
  values (v_rec.id, p_study_id, greatest(coalesce(p_last_page, 1), 1),
          coalesce(p_answers, '{}'::jsonb))
  on conflict (recipient_id, study_id) do update
    set last_page = greatest(excluded.last_page, study_progress.last_page),
        answers   = excluded.answers;
end;
$$;
grant execute on function save_study_progress(text, uuid, int, jsonb) to anon, authenticated;

-- Mark a study complete (unlocks the next). Idempotent.
create or replace function complete_study(
  p_session_token text, p_study_id uuid, p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_study studies;
  v_rec recipients;
begin
  select * into v_study from studies where id = p_study_id and status = 'approved' limit 1;
  if not found then return; end if;

  v_rec := _study_recipient(p_session_token, v_study.org_id);

  insert into study_progress (recipient_id, study_id, answers, completed_at)
  values (v_rec.id, p_study_id, coalesce(p_answers, '{}'::jsonb), now())
  on conflict (recipient_id, study_id) do update
    set answers = coalesce(excluded.answers, study_progress.answers),
        completed_at = coalesce(study_progress.completed_at, now());
end;
$$;
grant execute on function complete_study(text, uuid, jsonb) to anon, authenticated;
