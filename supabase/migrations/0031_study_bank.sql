-- 0031 — The Bible study bank (Resources → Bible studies).
--
--   * Ekklē keeps a shared bank of studies: studies with org_id null. Every
--     ministry gets them. A ministry's own studies (org_id = the ministry)
--     sit alongside them (their editor comes next).
--   * Each ministry chooses which studies its seekers get and in what order
--     (ministry_studies: enabled + position). With no choice recorded, a bank
--     study is on, in the bank's order — so new bank studies simply appear.
--   * Seekers' studies (Your space → Studies) follow that choice and order,
--     unlocking one after another as before.
--   * Existing studies move into the bank (today there is one: study 1).

alter table studies alter column org_id drop not null;
update studies set org_id = null where org_id is not null;

create table if not exists ministry_studies (
  org_id     uuid not null references organizations (id) on delete cascade,
  study_id   uuid not null references studies (id) on delete cascade,
  enabled    boolean not null default true,
  position   int not null,
  primary key (org_id, study_id)
);
alter table ministry_studies enable row level security;
revoke all on ministry_studies from anon, authenticated; -- functions only

-- Leaders read the bank's studies (and their own) through the table too.
drop policy if exists studies_leadership_all on studies;
create policy studies_leadership_read on studies
  for select to authenticated
  using (is_leadership() and (org_id is null or org_id = app_user_org()));
create policy studies_leadership_write on studies
  for all to authenticated
  using (is_leadership() and org_id = app_user_org())
  with check (is_leadership() and org_id = app_user_org());
drop policy if exists study_pages_leadership_all on study_pages;
create policy study_pages_leadership_read on study_pages
  for select to authenticated
  using (exists (select 1 from studies s where s.id = study_pages.study_id and is_leadership()
                 and (s.org_id is null or s.org_id = app_user_org())));
create policy study_pages_leadership_write on study_pages
  for all to authenticated
  using (exists (select 1 from studies s where s.id = study_pages.study_id
                 and is_leadership() and s.org_id = app_user_org()))
  with check (exists (select 1 from studies s where s.id = study_pages.study_id
                 and is_leadership() and s.org_id = app_user_org()));

-- A ministry's studies in its order: the bank's and its own, approved, with
-- whether each is on. rn numbers the ones that are on (the unlock order).
create or replace function private.ministry_study_order(p_org uuid)
returns table (study_id uuid, enabled boolean, ord bigint, rn bigint)
language sql stable security definer set search_path = public
as $$
  with all_studies as (
    select s.id, s.org_id, s.sort_order, s.created_at,
           coalesce(ms.enabled, true) as enabled,
           ms.position
    from studies s
    left join ministry_studies ms on ms.study_id = s.id and ms.org_id = p_org
    where s.status = 'approved' and (s.org_id is null or s.org_id = p_org)
  ), ordered as (
    select id, enabled,
           row_number() over (order by position nulls last, (org_id is not null), sort_order, created_at) as ord
    from all_studies
  )
  select id, enabled, ord,
         case when enabled then row_number() over (partition by enabled order by ord) end
  from ordered;
$$;
revoke execute on function private.ministry_study_order(uuid) from public;

-- ---------------------------------------------------------------------------
-- Seekers: the ministry's chosen studies, in its order
-- ---------------------------------------------------------------------------
create or replace function seeker_studies()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return '[]'::jsonb; end if;
  with ordered as (
    select s.*, o.rn,
           (select p.completed_at is not null from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec.id) as completed,
           (select p.last_page from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec.id) as last_page
    from private.ministry_study_order(v_rec.org_id) o
    join studies s on s.id = o.study_id
    where o.enabled),
  -- (A study with no progress yet counts as not finished — before 0031 the
  -- next one unlocked as soon as the previous was merely listed.)
  flagged as (
    select o.*, coalesce(o.completed, false) as done,
           coalesce(lag(coalesce(o.completed, false)) over (order by o.rn), true) as prev_done
    from ordered o)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'number', rn, 'title', title, 'tagline', tagline,
           'completed', done, 'locked', not (rn = 1 or prev_done),
           'started', last_page is not null, 'last_page', coalesce(last_page, 1)
         ) order by rn), '[]'::jsonb)
  into v_result from flagged;
  return v_result;
end;
$$;

create or replace function seeker_study(p_study_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_study studies; v_rn bigint; v_locked boolean; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  select o.rn into v_rn from private.ministry_study_order(v_rec.org_id) o
   where o.study_id = p_study_id and o.enabled;
  if v_rn is null then return null; end if;
  select * into v_study from studies where id = p_study_id;

  v_locked := exists (
    select 1 from private.ministry_study_order(v_rec.org_id) e
    where e.enabled and e.rn < v_rn
      and not exists (select 1 from study_progress p
        where p.study_id = e.study_id and p.recipient_id = v_rec.id and p.completed_at is not null));
  if v_locked then return jsonb_build_object('locked', true); end if;

  select jsonb_build_object(
    'id', v_study.id, 'number', v_rn, 'title', v_study.title,
    'tagline', v_study.tagline, 'locked', false,
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb),
    'progress', (select jsonb_build_object('last_page', p.last_page, 'answers', p.answers,
        'completed', p.completed_at is not null)
      from study_progress p where p.study_id = v_study.id and p.recipient_id = v_rec.id)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function seeker_save_progress(p_study_id uuid, p_last_page int, p_answers jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rec recipients;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return; end if;
  if not exists (select 1 from private.ministry_study_order(v_rec.org_id) o
                  where o.study_id = p_study_id and o.enabled) then return; end if;
  insert into study_progress (recipient_id, study_id, last_page, answers)
  values (v_rec.id, p_study_id, greatest(coalesce(p_last_page, 1), 1), coalesce(p_answers, '{}'::jsonb))
  on conflict (recipient_id, study_id) do update
    set last_page = greatest(excluded.last_page, study_progress.last_page),
        answers = excluded.answers;
end;
$$;

create or replace function seeker_complete_study(p_study_id uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rec recipients;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return; end if;
  if not exists (select 1 from private.ministry_study_order(v_rec.org_id) o
                  where o.study_id = p_study_id and o.enabled) then return; end if;
  insert into study_progress (recipient_id, study_id, answers, completed_at)
  values (v_rec.id, p_study_id, coalesce(p_answers, '{}'::jsonb), now())
  on conflict (recipient_id, study_id) do update
    set answers = coalesce(excluded.answers, study_progress.answers),
        completed_at = coalesce(study_progress.completed_at, now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins and Leaders: choose, order, preview
-- ---------------------------------------------------------------------------
create or replace function ministry_study_bank()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org();
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'tagline', s.tagline,
      'source', case when s.org_id is null then 'ekkle' else 'ministry' end,
      'enabled', o.enabled, 'number', o.rn,
      'pages', (select count(*) from study_pages pg where pg.study_id = s.id),
      'seekers_started', (select count(*) from study_progress p join recipients r on r.id = p.recipient_id
                          where p.study_id = s.id and r.org_id = v_org),
      'seekers_completed', (select count(*) from study_progress p join recipients r on r.id = p.recipient_id
                          where p.study_id = s.id and r.org_id = v_org and p.completed_at is not null)
    ) order by o.ord)
    from private.ministry_study_order(v_org) o join studies s on s.id = o.study_id
  ), '[]'::jsonb);
end;
$$;

-- Save the whole list: every study in order, each on or off.
-- p_items: [{ "id": uuid, "enabled": bool }, …]
create or replace function save_ministry_studies(p_items jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid := app_user_org();
  v_item jsonb;
  v_pos int := 0;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_pos := v_pos + 1;
    if not exists (select 1 from studies where id = (v_item ->> 'id')::uuid
                    and (org_id is null or org_id = v_org)) then
      raise exception 'forbidden';
    end if;
    insert into ministry_studies (org_id, study_id, enabled, position)
    values (v_org, (v_item ->> 'id')::uuid, coalesce((v_item ->> 'enabled')::boolean, true), v_pos)
    on conflict (org_id, study_id) do update
      set enabled = excluded.enabled, position = excluded.position;
  end loop;
end;
$$;

-- A study exactly as seekers see it (all pages), for Admins and Leaders.
create or replace function preview_study(p_study_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_study studies;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into v_study from studies
   where id = p_study_id and (org_id is null or org_id = app_user_org());
  if v_study.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_study.id, 'number', null, 'title', v_study.title, 'tagline', v_study.tagline,
    'locked', false, 'progress', null,
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['ministry_study_bank()', 'save_ministry_studies(jsonb)', 'preview_study(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
