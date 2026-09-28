-- 0037 — Credit a series to where its studies come from.
--
-- A series can carry a credit line and a link (e.g. "[truth]Link",
-- https://truthlink.org). It shows under each study's title, in the Studies
-- list and in Resources → Bible studies. Authors can change the credit even
-- after the series is locked (it isn't the studies' content).
-- Ekklē's first series is credited to [truth]Link, whose studies it holds.

alter table study_series add column if not exists credit text
  check (credit is null or char_length(trim(credit)) between 1 and 120);
alter table study_series add column if not exists credit_url text
  check (credit_url is null or credit_url ~ '^https?://[^\s]+$');

update study_series set credit = '[truth]Link', credit_url = 'https://truthlink.org'
 where org_id is null and credit is null;

-- Set (or clear, with nulls) a series' credit.
create or replace function set_study_series_credit(p_id uuid, p_credit text, p_url text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean; v_url text := nullif(trim(coalesce(p_url, '')), '');
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  if v_url is not null and v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
  update study_series set credit = nullif(trim(coalesce(p_credit, '')), ''), credit_url = v_url
   where id = p_id and org_id is not distinct from v_scope;
  if not found then raise exception 'forbidden'; end if;
end;
$$;
revoke execute on function set_study_series_credit(uuid, text, text) from public, anon;
grant execute on function set_study_series_credit(uuid, text, text) to authenticated;

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
      'credit', sr.credit, 'credit_url', sr.credit_url,
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
                                 'locked', v_series.locked_at is not null,
                                 'credit', v_series.credit, 'credit_url', v_series.credit_url),
    'has_draft', v_study.draft is not null,
    'content', coalesce(v_study.draft, private.study_content(v_study.id)),
    'people_started', (select count(*) from study_progress p where p.study_id = v_study.id));
end;
$$;

create or replace function seeker_studies()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return '[]'::jsonb; end if;
  with ordered as (
    select s.id, s.title, s.tagline, s.series_id, sr.title as series_title, sr.credit, sr.credit_url, o.rn,
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
           'series', series_title, 'credit', credit, 'credit_url', credit_url,
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
    'credit', (select credit from study_series where id = v_study.series_id),
    'credit_url', (select credit_url from study_series where id = v_study.series_id),
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
    'credit', (select credit from study_series where id = v_study.series_id),
    'credit_url', (select credit_url from study_series where id = v_study.series_id),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb));
end;
$$;

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
      'series', sr.title, 'credit', sr.credit,
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
