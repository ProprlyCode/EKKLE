-- 0034 — The study editor: series, drafts, answers.
--
--   * Studies belong to a series (study_series). Ekklē's series (org_id null)
--     are the shared bank, kept by the Ekklē team (Owners and Admins); a
--     ministry's Admins and Leaders keep their own series. A locked series is
--     finished: its studies can't be edited, and nothing is added to it.
--   * Each study keeps its intended answers (studies.answers, one per blank,
--     in order). People see them only after they submit the study.
--   * Edits happen on a draft (studies.draft) until Publish replaces the live
--     pages. A study that has never been published is status 'draft', which
--     people never see.
--   * Studies unlock one after another within a series (a ministry's order).
--   * Authoring goes through the functions below only: the direct write
--     policies on studies / study_pages are dropped.

create table if not exists study_series (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations (id) on delete cascade, -- null: Ekklē's
  title       text not null check (char_length(trim(title)) between 1 and 120),
  position    int  not null default 0,
  locked_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists study_series_org_idx on study_series (org_id, position);
alter table study_series enable row level security;
revoke all on study_series from anon, authenticated; -- functions only

alter table studies add column if not exists series_id uuid references study_series (id) on delete restrict;
alter table studies add column if not exists answers text[] not null default '{}';
alter table studies add column if not exists draft jsonb;

-- The first series of an owner (Ekklē or a ministry), made when needed.
create or replace function private.default_series(p_org uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from study_series
   where org_id is not distinct from p_org order by position, created_at limit 1;
  if v_id is null then
    insert into study_series (org_id, title, position)
    values (p_org, 'Bible studies', 1) returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function private.default_series(uuid) from public;

-- A study inserted without a series joins its owner's first one.
create or replace function private.study_default_series()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.series_id is null then
    new.series_id := private.default_series(new.org_id);
  end if;
  return new;
end;
$$;
drop trigger if exists studies_default_series on studies;
create trigger studies_default_series before insert on studies
  for each row execute function private.study_default_series();

update studies set series_id = private.default_series(org_id) where series_id is null;
alter table studies alter column series_id set not null;

-- Study 1's answers (from its answer key).
update studies
   set answers = array['love', 'know', 'friends', 'made', 'known', 'scripture', 'inspiration',
                       'now', 'praise', 'extol', 'honor', 'truth', 'justice', 'before', 'believe']
 where org_id is null and title = 'The Logic of Love' and answers = '{}';

-- Authoring only through the functions below.
drop policy if exists studies_leadership_write on studies;
drop policy if exists study_pages_leadership_write on study_pages;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Whose studies the caller keeps: on ekkle.org the Ekklē team's Owners and
-- Admins keep Ekklē's (org null); on a ministry's address its Admins and
-- Leaders keep the ministry's. No row: not allowed.
create or replace function private.author_scope()
returns table (org_id uuid) language sql stable security definer set search_path = public
as $$
  select app_user_org() where is_leadership()
  union all
  select null::uuid where app_user_org() is null and is_platform_admin();
$$;
revoke execute on function private.author_scope() from public;

-- How many blanks a list of pages holds.
create or replace function private.count_blanks(p_pages jsonb)
returns int language sql immutable set search_path = public
as $$
  select coalesce(sum((char_length(b ->> 'text') - char_length(replace(b ->> 'text', '{{}}', ''))) / 4), 0)::int
  from jsonb_array_elements(coalesce(p_pages, '[]'::jsonb)) pg,
       jsonb_array_elements(coalesce(pg -> 'blocks', '[]'::jsonb)) b
  where b ->> 't' = 'p';
$$;
revoke execute on function private.count_blanks(jsonb) from public;

-- A study the caller may edit (in scope, series not locked), or an error.
create or replace function private.editable_study(p_id uuid)
returns studies language plpgsql stable security definer set search_path = public
as $$
declare v_study studies; v_locked boolean;
begin
  select s.* into v_study from studies s
   where s.id = p_id and exists (select 1 from private.author_scope() a
                                  where a.org_id is not distinct from s.org_id);
  if v_study.id is null then raise exception 'forbidden'; end if;
  select locked_at is not null into v_locked from study_series where id = v_study.series_id;
  if v_locked then raise exception 'series_locked'; end if;
  return v_study;
end;
$$;
revoke execute on function private.editable_study(uuid) from public;

-- The live content of a study, as {title, tagline, pages, answers}.
create or replace function private.study_content(p_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'title', s.title, 'tagline', s.tagline, 'answers', to_jsonb(s.answers),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('blocks', pg.blocks) order by pg.page_number)
                         from study_pages pg where pg.study_id = s.id), '[]'::jsonb))
  from studies s where s.id = p_id;
$$;
revoke execute on function private.study_content(uuid) from public;

-- ---------------------------------------------------------------------------
-- The editor
-- ---------------------------------------------------------------------------
-- Every series the caller keeps, with its studies (drafts too).
create or replace function study_library()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sr.id, 'title', sr.title, 'locked', sr.locked_at is not null,
      'studies', coalesce((select jsonb_agg(jsonb_build_object(
          'id', s.id, 'title', coalesce(s.draft ->> 'title', s.title), 'status', s.status,
          'has_draft', s.draft is not null,
          'pages', coalesce(jsonb_array_length(s.draft -> 'pages'),
                            (select count(*) from study_pages pg where pg.study_id = s.id)::int),
          'people_started', (select count(*) from study_progress p where p.study_id = s.id)
        ) order by s.sort_order, s.created_at) from studies s where s.series_id = sr.id), '[]'::jsonb)
    ) order by sr.position, sr.created_at)
    from study_series sr where sr.org_id is not distinct from v_scope
  ), '[]'::jsonb);
end;
$$;

-- Create (p_id null) or rename a series. Returns its id.
create or replace function save_study_series(p_id uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean; v_id uuid;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_title, ''))) = 0 then raise exception 'title_required'; end if;
  if p_id is null then
    insert into study_series (org_id, title, position)
    values (v_scope, trim(p_title),
            coalesce((select max(position) from study_series where org_id is not distinct from v_scope), 0) + 1)
    returning id into v_id;
    return v_id;
  end if;
  update study_series set title = trim(p_title)
   where id = p_id and org_id is not distinct from v_scope and locked_at is null
  returning id into v_id;
  if v_id is null then raise exception 'forbidden'; end if;
  return v_id;
end;
$$;

-- Finish a series: from now on its studies can't be edited or added to.
-- (Only its published studies stay; unpublished ones must be published or
-- discarded first.)
create or replace function lock_study_series(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  if not exists (select 1 from study_series where id = p_id and org_id is not distinct from v_scope) then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from studies where series_id = p_id and (status = 'draft' or draft is not null)) then
    raise exception 'unpublished_changes';
  end if;
  update study_series set locked_at = coalesce(locked_at, now()) where id = p_id;
end;
$$;

-- A new study in a series, starting as a draft. Returns its id.
-- p_draft: { title, tagline, pages: [{blocks}], answers: [text] }
create or replace function create_study(p_series uuid, p_draft jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_series study_series; v_id uuid;
begin
  select sr.* into v_series from study_series sr
   where sr.id = p_series and exists (select 1 from private.author_scope() a
                                       where a.org_id is not distinct from sr.org_id);
  if v_series.id is null then raise exception 'forbidden'; end if;
  if v_series.locked_at is not null then raise exception 'series_locked'; end if;
  insert into studies (org_id, series_id, sort_order, title, tagline, status, draft)
  values (v_series.org_id, v_series.id,
          coalesce((select max(sort_order) from studies where series_id = v_series.id), 0) + 1,
          coalesce(nullif(trim(p_draft ->> 'title'), ''), 'Untitled study'),
          nullif(trim(p_draft ->> 'tagline'), ''), 'draft', coalesce(p_draft, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- One study for the editor: its draft (or the live content to start from),
-- what's live, and whether it can be edited.
create or replace function editor_study(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_study studies; v_series study_series;
begin
  select s.* into v_study from studies s
   where s.id = p_id and exists (select 1 from private.author_scope() a
                                  where a.org_id is not distinct from s.org_id);
  if v_study.id is null then raise exception 'forbidden'; end if;
  select * into v_series from study_series where id = v_study.series_id;
  return jsonb_build_object(
    'id', v_study.id, 'status', v_study.status,
    'series', jsonb_build_object('id', v_series.id, 'title', v_series.title,
                                 'locked', v_series.locked_at is not null),
    'has_draft', v_study.draft is not null,
    'content', coalesce(v_study.draft, private.study_content(v_study.id)),
    'people_started', (select count(*) from study_progress p where p.study_id = v_study.id));
end;
$$;

create or replace function save_study_draft(p_id uuid, p_draft jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_study studies;
begin
  v_study := private.editable_study(p_id);
  if jsonb_typeof(p_draft -> 'pages') is distinct from 'array' then raise exception 'invalid_draft'; end if;
  update studies set draft = p_draft where id = v_study.id;
end;
$$;

-- Publish the draft: it replaces the live study. Every blank needs an answer.
create or replace function publish_study(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_study studies;
  v_draft jsonb;
  v_answers text[];
  v_page jsonb;
  v_n int := 0;
begin
  v_study := private.editable_study(p_id);
  v_draft := v_study.draft;
  if v_draft is null then return; end if;
  if char_length(trim(coalesce(v_draft ->> 'title', ''))) = 0 then raise exception 'title_required'; end if;
  if jsonb_array_length(coalesce(v_draft -> 'pages', '[]'::jsonb)) = 0 then raise exception 'no_pages'; end if;
  select coalesce(array_agg(trim(a) order by ord), '{}') into v_answers
    from jsonb_array_elements_text(coalesce(v_draft -> 'answers', '[]'::jsonb)) with ordinality as t(a, ord);
  if coalesce(array_length(v_answers, 1), 0) <> private.count_blanks(v_draft -> 'pages')
     or exists (select 1 from unnest(v_answers) a where a = '') then
    raise exception 'answers_mismatch';
  end if;

  update studies
     set title = trim(v_draft ->> 'title'), tagline = nullif(trim(v_draft ->> 'tagline'), ''),
         answers = v_answers, status = 'approved', draft = null
   where id = v_study.id;
  delete from study_pages where study_id = v_study.id;
  for v_page in select * from jsonb_array_elements(v_draft -> 'pages') loop
    v_n := v_n + 1;
    insert into study_pages (study_id, page_number, blocks)
    values (v_study.id, v_n, coalesce(v_page -> 'blocks', '[]'::jsonb));
  end loop;
end;
$$;

-- Throw the draft away. A study that was never published goes altogether.
create or replace function discard_study_draft(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_study studies;
begin
  v_study := private.editable_study(p_id);
  if v_study.status = 'draft' then
    delete from studies where id = v_study.id;
  else
    update studies set draft = null where id = v_study.id;
  end if;
end;
$$;

-- Move a study up (-1) or down (1) within its series.
create or replace function move_study(p_id uuid, p_by int)
returns void language plpgsql security definer set search_path = public
as $$
declare v_study studies; v_other studies;
begin
  v_study := private.editable_study(p_id);
  if p_by < 0 then
    select * into v_other from studies where series_id = v_study.series_id
      and (sort_order, created_at) < (v_study.sort_order, v_study.created_at)
      order by sort_order desc, created_at desc limit 1;
  else
    select * into v_other from studies where series_id = v_study.series_id
      and (sort_order, created_at) > (v_study.sort_order, v_study.created_at)
      order by sort_order, created_at limit 1;
  end if;
  if v_other.id is null then return; end if;
  -- (Distinct orders first, so the swap is unambiguous.)
  with ranked as (select id, row_number() over (order by sort_order, created_at) as rn
                    from studies where series_id = v_study.series_id)
  update studies s set sort_order = r.rn from ranked r where s.id = r.id;
  update studies s set sort_order = o.sort_order
    from (select id, sort_order from studies where id in (v_study.id, v_other.id)) o
   where s.id in (v_study.id, v_other.id) and o.id <> s.id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['study_library()', 'save_study_series(uuid, text)', 'lock_study_series(uuid)',
      'create_study(uuid, jsonb)', 'editor_study(uuid)', 'save_study_draft(uuid, jsonb)',
      'publish_study(uuid)', 'discard_study_draft(uuid)', 'move_study(uuid, int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- A ministry's order: Ekklē's series in order, then its own
-- ---------------------------------------------------------------------------
create or replace function private.ministry_study_order(p_org uuid)
returns table (study_id uuid, enabled boolean, ord bigint, rn bigint)
language sql stable security definer set search_path = public
as $$
  with all_studies as (
    select s.id, s.org_id, s.sort_order, s.created_at, sr.position as series_position,
           coalesce(ms.enabled, true) as enabled,
           ms.position
    from studies s
    join study_series sr on sr.id = s.series_id
    left join ministry_studies ms on ms.study_id = s.id and ms.org_id = p_org
    where s.status = 'approved' and (s.org_id is null or s.org_id = p_org)
  ), ordered as (
    select id, enabled,
           row_number() over (order by position nulls last, (org_id is not null),
                              series_position, sort_order, created_at) as ord
    from all_studies
  )
  select id, enabled, ord,
         case when enabled then row_number() over (partition by enabled order by ord) end
  from ordered;
$$;
revoke execute on function private.ministry_study_order(uuid) from public;

-- ---------------------------------------------------------------------------
-- People: numbered and unlocked within each series; answers once submitted
-- ---------------------------------------------------------------------------
create or replace function seeker_studies()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return '[]'::jsonb; end if;
  with ordered as (
    select s.id, s.title, s.tagline, s.series_id, sr.title as series_title, o.rn,
           (select p.completed_at is not null from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec.id) as completed,
           (select p.last_page from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec.id) as last_page
    from private.ministry_study_order(v_rec.org_id) o
    join studies s on s.id = o.study_id
    join study_series sr on sr.id = s.series_id
    where o.enabled),
  flagged as (
    select o.*, coalesce(o.completed, false) as done,
           row_number() over (partition by o.series_id order by o.rn) as n,
           coalesce(lag(coalesce(o.completed, false)) over (partition by o.series_id order by o.rn), true) as prev_done
    from ordered o)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'number', n, 'title', title, 'tagline', tagline,
           'series', series_title,
           'completed', done, 'locked', not prev_done,
           'started', last_page is not null, 'last_page', coalesce(last_page, 1)
         ) order by rn), '[]'::jsonb)
  into v_result from flagged;
  return v_result;
end;
$$;

create or replace function seeker_study(p_study_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_study studies; v_rn bigint; v_n bigint; v_locked boolean;
        v_done boolean; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  select o.rn into v_rn from private.ministry_study_order(v_rec.org_id) o
   where o.study_id = p_study_id and o.enabled;
  if v_rn is null then return null; end if;
  select * into v_study from studies where id = p_study_id;

  v_locked := exists (
    select 1 from private.ministry_study_order(v_rec.org_id) e
    join studies es on es.id = e.study_id and es.series_id = v_study.series_id
    where e.enabled and e.rn < v_rn
      and not exists (select 1 from study_progress p
        where p.study_id = e.study_id and p.recipient_id = v_rec.id and p.completed_at is not null));
  if v_locked then return jsonb_build_object('locked', true); end if;

  select count(*) into v_n from private.ministry_study_order(v_rec.org_id) e
    join studies es on es.id = e.study_id and es.series_id = v_study.series_id
   where e.enabled and e.rn <= v_rn;
  v_done := exists (select 1 from study_progress p where p.study_id = v_study.id
                     and p.recipient_id = v_rec.id and p.completed_at is not null);

  select jsonb_build_object(
    'id', v_study.id, 'number', v_n, 'title', v_study.title,
    'tagline', v_study.tagline, 'locked', false,
    'series', (select title from study_series where id = v_study.series_id),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb),
    'answers', case when v_done then to_jsonb(v_study.answers) end,
    'progress', (select jsonb_build_object('last_page', p.last_page, 'answers', p.answers,
        'completed', p.completed_at is not null)
      from study_progress p where p.study_id = v_study.id and p.recipient_id = v_rec.id)
  ) into v_result;
  return v_result;
end;
$$;

-- Admins and Leaders preview with the answers (as after submitting).
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
    'locked', false, 'progress', null, 'answers', to_jsonb(v_study.answers),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb));
end;
$$;

-- The bank list for Admins and Leaders: with each study's series.
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
      'series', sr.title,
      'enabled', o.enabled, 'number', o.rn,
      'pages', (select count(*) from study_pages pg where pg.study_id = s.id),
      'seekers_started', (select count(*) from study_progress p join recipients r on r.id = p.recipient_id
                          where p.study_id = s.id and r.org_id = v_org),
      'seekers_completed', (select count(*) from study_progress p join recipients r on r.id = p.recipient_id
                          where p.study_id = s.id and r.org_id = v_org and p.completed_at is not null)
    ) order by o.ord)
    from private.ministry_study_order(v_org) o
    join studies s on s.id = o.study_id
    join study_series sr on sr.id = s.series_id
  ), '[]'::jsonb);
end;
$$;
