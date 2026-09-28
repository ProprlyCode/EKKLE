-- 0038 — Bible reading plans.
--
--   * Plans: Ekklē's (org_id null — John in 21 days, the Gospels in 90 days,
--     Psalms & Proverbs in 30 days, the Bible in a year) and a ministry's own
--     (its Admins and Leaders write them). Each day is a list of readings,
--     "BOOK.CHAPTER" or "BOOK.CHAPTER:FROM-TO".
--   * Anyone signed in on an address (people exploring and the team) can start
--     a plan, tick days off in any order and catch up any time — no streaks.
--     Progress belongs to the person (their login), across devices.
--   * Read together: a ministry's Admins and Leaders start a plan for their
--     people from a date. Joining shows the day the group is on and how many
--     are reading along — a count, never names.
--   * Daily email, opt-in: the person picks a time in their own time zone; a
--     job every 15 minutes sends today's reading (the next day not yet ticked)
--     once a day through the `notify` function. Off by default.
--   * Everything goes through the functions below (tables are closed).

create table if not exists reading_plans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations (id) on delete cascade, -- null: Ekklē's
  title        text not null check (char_length(trim(title)) between 1 and 120),
  description  text check (description is null or char_length(description) <= 400),
  position     int  not null default 0,
  status       text not null default 'published' check (status in ('draft', 'published')),
  created_at   timestamptz not null default now()
);
create index if not exists reading_plans_org_idx on reading_plans (org_id, position);

create table if not exists reading_plan_days (
  plan_id   uuid not null references reading_plans (id) on delete cascade,
  day       int  not null check (day between 1 and 400),
  readings  text[] not null check (cardinality(readings) between 1 and 20),
  primary key (plan_id, day)
);

create table if not exists reading_plan_groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  plan_id     uuid not null references reading_plans (id) on delete cascade,
  start_on    date not null,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create unique index if not exists reading_plan_groups_active
  on reading_plan_groups (org_id, plan_id) where ended_at is null;

create table if not exists reading_progress (
  auth_uid          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id           uuid not null references reading_plans (id) on delete cascade,
  group_id          uuid references reading_plan_groups (id) on delete set null,
  org_id            uuid references organizations (id) on delete set null, -- where they started it
  area              text not null default 'space' check (area in ('space', 'app')),
  done_days         int[] not null default '{}',
  remind_at         time,
  tz                text,
  last_reminded_on  date,
  started_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (auth_uid, plan_id)
);
drop trigger if exists reading_progress_updated_at on reading_progress;
create trigger reading_progress_updated_at before update on reading_progress
  for each row execute function set_updated_at();

alter table reading_plans enable row level security;
alter table reading_plan_days enable row level security;
alter table reading_plan_groups enable row level security;
alter table reading_progress enable row level security;
revoke all on reading_plans, reading_plan_days, reading_plan_groups, reading_progress from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- A plan this address offers (Ekklē's, or the address's ministry's), published.
create or replace function private.visible_plan(p_id uuid)
returns reading_plans language sql stable security definer set search_path = public
as $$
  select p.* from reading_plans p
   where p.id = p_id and p.status = 'published'
     and (p.org_id is null or p.org_id = request_account());
$$;
revoke execute on function private.visible_plan(uuid) from public;

-- The active read-together group for a plan on this address, as jsonb.
create or replace function private.plan_together(p_plan uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'group_id', g.id, 'start_on', g.start_on,
    'day', greatest(1, (current_date - g.start_on) + 1),
    'readers', (select count(*) from reading_progress r where r.group_id = g.id))
  from reading_plan_groups g
  where g.plan_id = p_plan and g.org_id = request_account() and g.ended_at is null
  limit 1;
$$;
revoke execute on function private.plan_together(uuid) from public;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
create or replace function reading_plans()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description,
    'source', case when p.org_id is null then 'ekkle' else 'ministry' end,
    'days', (select count(*) from reading_plan_days d where d.plan_id = p.id),
    'together', private.plan_together(p.id),
    'mine', (select jsonb_build_object(
        'done', cardinality(r.done_days),
        'next_day', (select min(d.day) from reading_plan_days d
                      where d.plan_id = p.id and not (d.day = any (r.done_days))),
        'remind_at', r.remind_at, 'together', r.group_id is not null)
      from reading_progress r where r.plan_id = p.id and r.auth_uid = auth.uid())
  ) order by (p.org_id is not null) desc, p.position, p.created_at), '[]'::jsonb)
  from reading_plans p
  where auth.uid() is not null and p.status = 'published'
    and (p.org_id is null or p.org_id = request_account());
$$;

create or replace function reading_plan(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_plan reading_plans;
begin
  if auth.uid() is null then return null; end if;
  v_plan := private.visible_plan(p_id);
  if v_plan.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_plan.id, 'title', v_plan.title, 'description', v_plan.description,
    'source', case when v_plan.org_id is null then 'ekkle' else 'ministry' end,
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'readings', to_jsonb(d.readings))
                       order by d.day) from reading_plan_days d where d.plan_id = v_plan.id), '[]'::jsonb),
    'together', private.plan_together(v_plan.id),
    'mine', (select jsonb_build_object(
        'done_days', to_jsonb(r.done_days), 'remind_at', r.remind_at, 'tz', r.tz,
        'together', r.group_id is not null)
      from reading_progress r where r.plan_id = v_plan.id and r.auth_uid = auth.uid()));
end;
$$;

-- Start (or join together, when the ministry reads it together).
create or replace function start_reading_plan(p_id uuid, p_together boolean, p_area text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_plan reading_plans; v_group uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  v_plan := private.visible_plan(p_id);
  if v_plan.id is null then raise exception 'not_found'; end if;
  if p_together then
    select id into v_group from reading_plan_groups
     where plan_id = p_id and org_id = request_account() and ended_at is null;
  end if;
  insert into reading_progress (auth_uid, plan_id, group_id, org_id, area)
  values (auth.uid(), p_id, v_group, request_account(),
          case when p_area = 'app' then 'app' else 'space' end)
  on conflict (auth_uid, plan_id) do update
    set group_id = excluded.group_id, org_id = excluded.org_id, area = excluded.area;
end;
$$;

create or replace function mark_reading_day(p_id uuid, p_day int, p_done boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from reading_plan_days where plan_id = p_id and day = p_day) then
    raise exception 'not_found';
  end if;
  update reading_progress
     set done_days = case when p_done
                          then (select array_agg(distinct x order by x) from unnest(done_days || p_day) x)
                          else array_remove(done_days, p_day) end
   where auth_uid = auth.uid() and plan_id = p_id;
  if not found then raise exception 'not_started'; end if;
end;
$$;

create or replace function stop_reading_plan(p_id uuid)
returns void language sql security definer set search_path = public
as $$ delete from reading_progress where auth_uid = auth.uid() and plan_id = p_id; $$;

-- The daily email: a time in their own time zone, or null to turn it off.
create or replace function set_reading_reminder(p_id uuid, p_at time, p_tz text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_at is not null and not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'invalid_time_zone';
  end if;
  update reading_progress
     set remind_at = p_at, tz = case when p_at is null then tz else p_tz end,
         -- Starting today: the first email comes at the next time it's due.
         last_reminded_on = case when p_at is null then last_reminded_on
                                 when (now() at time zone p_tz)::time >= p_at then (now() at time zone p_tz)::date
                                 else null end
   where auth_uid = auth.uid() and plan_id = p_id;
  if not found then raise exception 'not_started'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Writing plans, and reading together (Admins and Leaders; the Ekklē team
-- for Ekklē's — the same scope as the study editor)
-- ---------------------------------------------------------------------------
create or replace function plan_library()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'description', p.description, 'status', p.status,
      'source', case when p.org_id is null then 'ekkle' else 'ministry' end,
      'editable', p.org_id is not distinct from v_scope,
      'days', (select count(*) from reading_plan_days d where d.plan_id = p.id),
      'together', case when v_scope is not null then (
          select jsonb_build_object('group_id', g.id, 'start_on', g.start_on,
                   'readers', (select count(*) from reading_progress r where r.group_id = g.id))
          from reading_plan_groups g
          where g.plan_id = p.id and g.org_id = v_scope and g.ended_at is null) end
    ) order by (p.org_id is not null) desc, p.position, p.created_at)
    from reading_plans p
    where p.org_id is not distinct from v_scope or (v_scope is not null and p.org_id is null and p.status = 'published')
  ), '[]'::jsonb);
end;
$$;

-- One plan for the editor, with every day.
create or replace function plan_for_editing(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean; v_plan reading_plans;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  select * into v_plan from reading_plans where id = p_id and org_id is not distinct from v_scope;
  if v_plan.id is null then raise exception 'forbidden'; end if;
  return jsonb_build_object('id', v_plan.id, 'title', v_plan.title, 'description', v_plan.description,
    'status', v_plan.status,
    'days', coalesce((select jsonb_agg(to_jsonb(d.readings) order by d.day)
                        from reading_plan_days d where d.plan_id = v_plan.id), '[]'::jsonb));
end;
$$;

-- Create (p_id null) or replace a plan. p_days: [["JHN.1"], ["JHN.2", "PSA.1"], …]
create or replace function save_reading_plan(p_id uuid, p_title text, p_description text, p_days jsonb, p_status text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean; v_id uuid; v_day jsonb; v_n int := 0;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_title, ''))) = 0 then raise exception 'title_required'; end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then raise exception 'no_days'; end if;
  if exists (select 1 from jsonb_array_elements(p_days) d, jsonb_array_elements_text(d) r
              where r !~ '^[1-3A-Z]{3}\.[0-9]{1,3}(:[0-9]{1,3}(-[0-9]{1,3})?)?$') then
    raise exception 'invalid_reading';
  end if;

  if p_id is null then
    insert into reading_plans (org_id, title, description, status, position)
    values (v_scope, trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
            case when p_status = 'draft' then 'draft' else 'published' end,
            coalesce((select max(position) from reading_plans where org_id is not distinct from v_scope), 0) + 1)
    returning id into v_id;
  else
    update reading_plans
       set title = trim(p_title), description = nullif(trim(coalesce(p_description, '')), ''),
           status = case when p_status = 'draft' then 'draft' else 'published' end
     where id = p_id and org_id is not distinct from v_scope
    returning id into v_id;
    if v_id is null then raise exception 'forbidden'; end if;
    delete from reading_plan_days where plan_id = v_id;
  end if;

  for v_day in select * from jsonb_array_elements(p_days) loop
    v_n := v_n + 1;
    insert into reading_plan_days (plan_id, day, readings)
    values (v_id, v_n, array(select jsonb_array_elements_text(v_day)));
  end loop;
  -- Ticked days past the new end no longer count.
  update reading_progress set done_days = array(select x from unnest(done_days) x where x <= v_n)
   where plan_id = v_id;
  return v_id;
end;
$$;

create or replace function delete_reading_plan(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  delete from reading_plans where id = p_id and org_id is not distinct from v_scope;
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- A ministry reads a plan together from a date (one group per plan at a time).
create or replace function start_reading_together(p_plan uuid, p_start date)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if not exists (select 1 from reading_plans where id = p_plan and status = 'published'
                  and (org_id is null or org_id = app_user_org())) then
    raise exception 'not_found';
  end if;
  update reading_plan_groups set ended_at = now()
   where plan_id = p_plan and org_id = app_user_org() and ended_at is null;
  insert into reading_plan_groups (org_id, plan_id, start_on)
  values (app_user_org(), p_plan, coalesce(p_start, current_date)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function end_reading_together(p_group uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  update reading_plan_groups set ended_at = now()
   where id = p_group and org_id = app_user_org() and ended_at is null;
  if not found then raise exception 'not_found'; end if;
  -- Readers keep their own progress; they just aren't reading together now.
  update reading_progress set group_id = null where group_id = p_group;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['reading_plans()', 'reading_plan(uuid)', 'start_reading_plan(uuid, boolean, text)',
      'mark_reading_day(uuid, int, boolean)', 'stop_reading_plan(uuid)', 'set_reading_reminder(uuid, time, text)',
      'plan_library()', 'plan_for_editing(uuid)', 'save_reading_plan(uuid, text, text, jsonb, text)',
      'delete_reading_plan(uuid)', 'start_reading_together(uuid, date)', 'end_reading_together(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The daily email
-- ---------------------------------------------------------------------------
create or replace function private.reading_reminders_due()
returns int language plpgsql security definer set search_path = public
as $$
declare v_row record; v_n int := 0;
begin
  for v_row in
    select r.auth_uid, r.plan_id, (now() at time zone r.tz)::date as today
    from reading_progress r
    where r.remind_at is not null and r.tz is not null
      and (now() at time zone r.tz)::time >= r.remind_at
      and (r.last_reminded_on is null or r.last_reminded_on < (now() at time zone r.tz)::date)
      -- Finished plans don't email.
      and exists (select 1 from reading_plan_days d
                   where d.plan_id = r.plan_id and not (d.day = any (r.done_days)))
  loop
    perform private.notify_edge('notify', jsonb_build_object(
      'kind', 'reading', 'auth_uid', v_row.auth_uid, 'plan_id', v_row.plan_id));
    update reading_progress set last_reminded_on = v_row.today
     where auth_uid = v_row.auth_uid and plan_id = v_row.plan_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.reading_reminders_due() from public;

do $$
begin
  perform cron.schedule('ekkle-reading-reminders', '*/15 * * * *', 'select private.reading_reminders_due()');
exception when others then
  raise notice 'reading reminders not scheduled: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Ekklē's starter plans (generated by scripts/bible/plans.mjs)
-- ---------------------------------------------------------------------------

with p as (
  insert into reading_plans (org_id, title, description, position, status)
  values (null, 'John in 21 days', 'The Gospel of John, a chapter a day — a good place to begin.', 1, 'published')
  returning id
)
insert into reading_plan_days (plan_id, day, readings)
select p.id, d.day, d.readings from p, (values
  (1, array['JHN.1']::text[]),
  (2, array['JHN.2']::text[]),
  (3, array['JHN.3']::text[]),
  (4, array['JHN.4']::text[]),
  (5, array['JHN.5']::text[]),
  (6, array['JHN.6']::text[]),
  (7, array['JHN.7']::text[]),
  (8, array['JHN.8']::text[]),
  (9, array['JHN.9']::text[]),
  (10, array['JHN.10']::text[]),
  (11, array['JHN.11']::text[]),
  (12, array['JHN.12']::text[]),
  (13, array['JHN.13']::text[]),
  (14, array['JHN.14']::text[]),
  (15, array['JHN.15']::text[]),
  (16, array['JHN.16']::text[]),
  (17, array['JHN.17']::text[]),
  (18, array['JHN.18']::text[]),
  (19, array['JHN.19']::text[]),
  (20, array['JHN.20']::text[]),
  (21, array['JHN.21']::text[])
) as d(day, readings);

with p as (
  insert into reading_plans (org_id, title, description, position, status)
  values (null, 'The Gospels in 90 days', 'Matthew, Mark, Luke and John — the life of Jesus, about a chapter a day.', 2, 'published')
  returning id
)
insert into reading_plan_days (plan_id, day, readings)
select p.id, d.day, d.readings from p, (values
  (1, array['MAT.1']::text[]),
  (2, array['MAT.2']::text[]),
  (3, array['MAT.3']::text[]),
  (4, array['MAT.4']::text[]),
  (5, array['MAT.5']::text[]),
  (6, array['MAT.6']::text[]),
  (7, array['MAT.7']::text[]),
  (8, array['MAT.8']::text[]),
  (9, array['MAT.9']::text[]),
  (10, array['MAT.10']::text[]),
  (11, array['MAT.11']::text[]),
  (12, array['MAT.12']::text[]),
  (13, array['MAT.13']::text[]),
  (14, array['MAT.14']::text[]),
  (15, array['MAT.15']::text[]),
  (16, array['MAT.16']::text[]),
  (17, array['MAT.17']::text[]),
  (18, array['MAT.18']::text[]),
  (19, array['MAT.19']::text[]),
  (20, array['MAT.20']::text[]),
  (21, array['MAT.21']::text[]),
  (22, array['MAT.22']::text[]),
  (23, array['MAT.23']::text[]),
  (24, array['MAT.24']::text[]),
  (25, array['MAT.25']::text[]),
  (26, array['MAT.26']::text[]),
  (27, array['MAT.27']::text[]),
  (28, array['MAT.28']::text[]),
  (29, array['MRK.1']::text[]),
  (30, array['MRK.2']::text[]),
  (31, array['MRK.3']::text[]),
  (32, array['MRK.4']::text[]),
  (33, array['MRK.5']::text[]),
  (34, array['MRK.6']::text[]),
  (35, array['MRK.7']::text[]),
  (36, array['MRK.8']::text[]),
  (37, array['MRK.9']::text[]),
  (38, array['MRK.10']::text[]),
  (39, array['MRK.11']::text[]),
  (40, array['MRK.12']::text[]),
  (41, array['MRK.13']::text[]),
  (42, array['MRK.14']::text[]),
  (43, array['MRK.15']::text[]),
  (44, array['MRK.16']::text[]),
  (45, array['LUK.1:1-38']::text[]),
  (46, array['LUK.1:39-80']::text[]),
  (47, array['LUK.2']::text[]),
  (48, array['LUK.3']::text[]),
  (49, array['LUK.4']::text[]),
  (50, array['LUK.5']::text[]),
  (51, array['LUK.6']::text[]),
  (52, array['LUK.7']::text[]),
  (53, array['LUK.8']::text[]),
  (54, array['LUK.9']::text[]),
  (55, array['LUK.10']::text[]),
  (56, array['LUK.11']::text[]),
  (57, array['LUK.12']::text[]),
  (58, array['LUK.13']::text[]),
  (59, array['LUK.14']::text[]),
  (60, array['LUK.15']::text[]),
  (61, array['LUK.16']::text[]),
  (62, array['LUK.17']::text[]),
  (63, array['LUK.18']::text[]),
  (64, array['LUK.19']::text[]),
  (65, array['LUK.20']::text[]),
  (66, array['LUK.21']::text[]),
  (67, array['LUK.22']::text[]),
  (68, array['LUK.23']::text[]),
  (69, array['LUK.24']::text[]),
  (70, array['JHN.1']::text[]),
  (71, array['JHN.2']::text[]),
  (72, array['JHN.3']::text[]),
  (73, array['JHN.4']::text[]),
  (74, array['JHN.5']::text[]),
  (75, array['JHN.6']::text[]),
  (76, array['JHN.7']::text[]),
  (77, array['JHN.8']::text[]),
  (78, array['JHN.9']::text[]),
  (79, array['JHN.10']::text[]),
  (80, array['JHN.11']::text[]),
  (81, array['JHN.12']::text[]),
  (82, array['JHN.13']::text[]),
  (83, array['JHN.14']::text[]),
  (84, array['JHN.15']::text[]),
  (85, array['JHN.16']::text[]),
  (86, array['JHN.17']::text[]),
  (87, array['JHN.18']::text[]),
  (88, array['JHN.19']::text[]),
  (89, array['JHN.20']::text[]),
  (90, array['JHN.21']::text[])
) as d(day, readings);

with p as (
  insert into reading_plans (org_id, title, description, position, status)
  values (null, 'Psalms & Proverbs in 30 days', 'Five psalms and a chapter of Proverbs each day.', 3, 'published')
  returning id
)
insert into reading_plan_days (plan_id, day, readings)
select p.id, d.day, d.readings from p, (values
  (1, array['PSA.1', 'PSA.2', 'PSA.3', 'PSA.4', 'PSA.5', 'PRO.1']::text[]),
  (2, array['PSA.6', 'PSA.7', 'PSA.8', 'PSA.9', 'PSA.10', 'PRO.2']::text[]),
  (3, array['PSA.11', 'PSA.12', 'PSA.13', 'PSA.14', 'PSA.15', 'PRO.3']::text[]),
  (4, array['PSA.16', 'PSA.17', 'PSA.18', 'PSA.19', 'PSA.20', 'PRO.4']::text[]),
  (5, array['PSA.21', 'PSA.22', 'PSA.23', 'PSA.24', 'PSA.25', 'PRO.5']::text[]),
  (6, array['PSA.26', 'PSA.27', 'PSA.28', 'PSA.29', 'PSA.30', 'PRO.6']::text[]),
  (7, array['PSA.31', 'PSA.32', 'PSA.33', 'PSA.34', 'PSA.35', 'PRO.7']::text[]),
  (8, array['PSA.36', 'PSA.37', 'PSA.38', 'PSA.39', 'PSA.40', 'PRO.8']::text[]),
  (9, array['PSA.41', 'PSA.42', 'PSA.43', 'PSA.44', 'PSA.45', 'PRO.9']::text[]),
  (10, array['PSA.46', 'PSA.47', 'PSA.48', 'PSA.49', 'PSA.50', 'PRO.10']::text[]),
  (11, array['PSA.51', 'PSA.52', 'PSA.53', 'PSA.54', 'PSA.55', 'PRO.11']::text[]),
  (12, array['PSA.56', 'PSA.57', 'PSA.58', 'PSA.59', 'PSA.60', 'PRO.12']::text[]),
  (13, array['PSA.61', 'PSA.62', 'PSA.63', 'PSA.64', 'PSA.65', 'PRO.13']::text[]),
  (14, array['PSA.66', 'PSA.67', 'PSA.68', 'PSA.69', 'PSA.70', 'PRO.14']::text[]),
  (15, array['PSA.71', 'PSA.72', 'PSA.73', 'PSA.74', 'PSA.75', 'PRO.15']::text[]),
  (16, array['PSA.76', 'PSA.77', 'PSA.78', 'PSA.79', 'PSA.80', 'PRO.16']::text[]),
  (17, array['PSA.81', 'PSA.82', 'PSA.83', 'PSA.84', 'PSA.85', 'PRO.17']::text[]),
  (18, array['PSA.86', 'PSA.87', 'PSA.88', 'PSA.89', 'PSA.90', 'PRO.18']::text[]),
  (19, array['PSA.91', 'PSA.92', 'PSA.93', 'PSA.94', 'PSA.95', 'PRO.19']::text[]),
  (20, array['PSA.96', 'PSA.97', 'PSA.98', 'PSA.99', 'PSA.100', 'PRO.20']::text[]),
  (21, array['PSA.101', 'PSA.102', 'PSA.103', 'PSA.104', 'PSA.105', 'PRO.21']::text[]),
  (22, array['PSA.106', 'PSA.107', 'PSA.108', 'PSA.109', 'PSA.110', 'PRO.22']::text[]),
  (23, array['PSA.111', 'PSA.112', 'PSA.113', 'PSA.114', 'PSA.115', 'PRO.23']::text[]),
  (24, array['PSA.116', 'PSA.117', 'PSA.118', 'PSA.119', 'PSA.120', 'PRO.24']::text[]),
  (25, array['PSA.121', 'PSA.122', 'PSA.123', 'PSA.124', 'PSA.125', 'PRO.25']::text[]),
  (26, array['PSA.126', 'PSA.127', 'PSA.128', 'PSA.129', 'PSA.130', 'PRO.26']::text[]),
  (27, array['PSA.131', 'PSA.132', 'PSA.133', 'PSA.134', 'PSA.135', 'PRO.27']::text[]),
  (28, array['PSA.136', 'PSA.137', 'PSA.138', 'PSA.139', 'PSA.140', 'PRO.28']::text[]),
  (29, array['PSA.141', 'PSA.142', 'PSA.143', 'PSA.144', 'PSA.145', 'PRO.29']::text[]),
  (30, array['PSA.146', 'PSA.147', 'PSA.148', 'PSA.149', 'PSA.150', 'PRO.30', 'PRO.31']::text[])
) as d(day, readings);

with p as (
  insert into reading_plans (org_id, title, description, position, status)
  values (null, 'The Bible in a year', 'All of Scripture, Genesis to Revelation, in 365 days — about three chapters a day.', 4, 'published')
  returning id
)
insert into reading_plan_days (plan_id, day, readings)
select p.id, d.day, d.readings from p, (values
  (1, array['GEN.1', 'GEN.2', 'GEN.3']::text[]),
  (2, array['GEN.4', 'GEN.5', 'GEN.6', 'GEN.7']::text[]),
  (3, array['GEN.8', 'GEN.9', 'GEN.10']::text[]),
  (4, array['GEN.11', 'GEN.12', 'GEN.13']::text[]),
  (5, array['GEN.14', 'GEN.15', 'GEN.16']::text[]),
  (6, array['GEN.17', 'GEN.18', 'GEN.19', 'GEN.20']::text[]),
  (7, array['GEN.21', 'GEN.22', 'GEN.23']::text[]),
  (8, array['GEN.24', 'GEN.25', 'GEN.26']::text[]),
  (9, array['GEN.27', 'GEN.28', 'GEN.29']::text[]),
  (10, array['GEN.30', 'GEN.31', 'GEN.32', 'GEN.33']::text[]),
  (11, array['GEN.34', 'GEN.35', 'GEN.36']::text[]),
  (12, array['GEN.37', 'GEN.38', 'GEN.39']::text[]),
  (13, array['GEN.40', 'GEN.41', 'GEN.42']::text[]),
  (14, array['GEN.43', 'GEN.44', 'GEN.45', 'GEN.46']::text[]),
  (15, array['GEN.47', 'GEN.48', 'GEN.49']::text[]),
  (16, array['GEN.50', 'EXO.1', 'EXO.2']::text[]),
  (17, array['EXO.3', 'EXO.4', 'EXO.5']::text[]),
  (18, array['EXO.6', 'EXO.7', 'EXO.8', 'EXO.9']::text[]),
  (19, array['EXO.10', 'EXO.11', 'EXO.12']::text[]),
  (20, array['EXO.13', 'EXO.14', 'EXO.15']::text[]),
  (21, array['EXO.16', 'EXO.17', 'EXO.18']::text[]),
  (22, array['EXO.19', 'EXO.20', 'EXO.21', 'EXO.22']::text[]),
  (23, array['EXO.23', 'EXO.24', 'EXO.25']::text[]),
  (24, array['EXO.26', 'EXO.27', 'EXO.28']::text[]),
  (25, array['EXO.29', 'EXO.30', 'EXO.31']::text[]),
  (26, array['EXO.32', 'EXO.33', 'EXO.34', 'EXO.35']::text[]),
  (27, array['EXO.36', 'EXO.37', 'EXO.38']::text[]),
  (28, array['EXO.39', 'EXO.40', 'LEV.1']::text[]),
  (29, array['LEV.2', 'LEV.3', 'LEV.4']::text[]),
  (30, array['LEV.5', 'LEV.6', 'LEV.7', 'LEV.8']::text[]),
  (31, array['LEV.9', 'LEV.10', 'LEV.11']::text[]),
  (32, array['LEV.12', 'LEV.13', 'LEV.14']::text[]),
  (33, array['LEV.15', 'LEV.16', 'LEV.17']::text[]),
  (34, array['LEV.18', 'LEV.19', 'LEV.20', 'LEV.21']::text[]),
  (35, array['LEV.22', 'LEV.23', 'LEV.24']::text[]),
  (36, array['LEV.25', 'LEV.26', 'LEV.27']::text[]),
  (37, array['NUM.1', 'NUM.2', 'NUM.3', 'NUM.4']::text[]),
  (38, array['NUM.5', 'NUM.6', 'NUM.7']::text[]),
  (39, array['NUM.8', 'NUM.9', 'NUM.10']::text[]),
  (40, array['NUM.11', 'NUM.12', 'NUM.13']::text[]),
  (41, array['NUM.14', 'NUM.15', 'NUM.16', 'NUM.17']::text[]),
  (42, array['NUM.18', 'NUM.19', 'NUM.20']::text[]),
  (43, array['NUM.21', 'NUM.22', 'NUM.23']::text[]),
  (44, array['NUM.24', 'NUM.25', 'NUM.26']::text[]),
  (45, array['NUM.27', 'NUM.28', 'NUM.29', 'NUM.30']::text[]),
  (46, array['NUM.31', 'NUM.32', 'NUM.33']::text[]),
  (47, array['NUM.34', 'NUM.35', 'NUM.36']::text[]),
  (48, array['DEU.1', 'DEU.2', 'DEU.3']::text[]),
  (49, array['DEU.4', 'DEU.5', 'DEU.6', 'DEU.7']::text[]),
  (50, array['DEU.8', 'DEU.9', 'DEU.10']::text[]),
  (51, array['DEU.11', 'DEU.12', 'DEU.13']::text[]),
  (52, array['DEU.14', 'DEU.15', 'DEU.16']::text[]),
  (53, array['DEU.17', 'DEU.18', 'DEU.19', 'DEU.20']::text[]),
  (54, array['DEU.21', 'DEU.22', 'DEU.23']::text[]),
  (55, array['DEU.24', 'DEU.25', 'DEU.26']::text[]),
  (56, array['DEU.27', 'DEU.28', 'DEU.29']::text[]),
  (57, array['DEU.30', 'DEU.31', 'DEU.32', 'DEU.33']::text[]),
  (58, array['DEU.34', 'JOS.1', 'JOS.2']::text[]),
  (59, array['JOS.3', 'JOS.4', 'JOS.5']::text[]),
  (60, array['JOS.6', 'JOS.7', 'JOS.8']::text[]),
  (61, array['JOS.9', 'JOS.10', 'JOS.11', 'JOS.12']::text[]),
  (62, array['JOS.13', 'JOS.14', 'JOS.15']::text[]),
  (63, array['JOS.16', 'JOS.17', 'JOS.18']::text[]),
  (64, array['JOS.19', 'JOS.20', 'JOS.21']::text[]),
  (65, array['JOS.22', 'JOS.23', 'JOS.24', 'JDG.1']::text[]),
  (66, array['JDG.2', 'JDG.3', 'JDG.4']::text[]),
  (67, array['JDG.5', 'JDG.6', 'JDG.7']::text[]),
  (68, array['JDG.8', 'JDG.9', 'JDG.10', 'JDG.11']::text[]),
  (69, array['JDG.12', 'JDG.13', 'JDG.14']::text[]),
  (70, array['JDG.15', 'JDG.16', 'JDG.17']::text[]),
  (71, array['JDG.18', 'JDG.19', 'JDG.20']::text[]),
  (72, array['JDG.21', 'RUT.1', 'RUT.2', 'RUT.3']::text[]),
  (73, array['RUT.4', '1SA.1', '1SA.2']::text[]),
  (74, array['1SA.3', '1SA.4', '1SA.5']::text[]),
  (75, array['1SA.6', '1SA.7', '1SA.8']::text[]),
  (76, array['1SA.9', '1SA.10', '1SA.11', '1SA.12']::text[]),
  (77, array['1SA.13', '1SA.14', '1SA.15']::text[]),
  (78, array['1SA.16', '1SA.17', '1SA.18']::text[]),
  (79, array['1SA.19', '1SA.20', '1SA.21']::text[]),
  (80, array['1SA.22', '1SA.23', '1SA.24', '1SA.25']::text[]),
  (81, array['1SA.26', '1SA.27', '1SA.28']::text[]),
  (82, array['1SA.29', '1SA.30', '1SA.31']::text[]),
  (83, array['2SA.1', '2SA.2', '2SA.3']::text[]),
  (84, array['2SA.4', '2SA.5', '2SA.6', '2SA.7']::text[]),
  (85, array['2SA.8', '2SA.9', '2SA.10']::text[]),
  (86, array['2SA.11', '2SA.12', '2SA.13']::text[]),
  (87, array['2SA.14', '2SA.15', '2SA.16']::text[]),
  (88, array['2SA.17', '2SA.18', '2SA.19', '2SA.20']::text[]),
  (89, array['2SA.21', '2SA.22', '2SA.23']::text[]),
  (90, array['2SA.24', '1KI.1', '1KI.2']::text[]),
  (91, array['1KI.3', '1KI.4', '1KI.5']::text[]),
  (92, array['1KI.6', '1KI.7', '1KI.8', '1KI.9']::text[]),
  (93, array['1KI.10', '1KI.11', '1KI.12']::text[]),
  (94, array['1KI.13', '1KI.14', '1KI.15']::text[]),
  (95, array['1KI.16', '1KI.17', '1KI.18']::text[]),
  (96, array['1KI.19', '1KI.20', '1KI.21', '1KI.22']::text[]),
  (97, array['2KI.1', '2KI.2', '2KI.3']::text[]),
  (98, array['2KI.4', '2KI.5', '2KI.6']::text[]),
  (99, array['2KI.7', '2KI.8', '2KI.9']::text[]),
  (100, array['2KI.10', '2KI.11', '2KI.12', '2KI.13']::text[]),
  (101, array['2KI.14', '2KI.15', '2KI.16']::text[]),
  (102, array['2KI.17', '2KI.18', '2KI.19']::text[]),
  (103, array['2KI.20', '2KI.21', '2KI.22', '2KI.23']::text[]),
  (104, array['2KI.24', '2KI.25', '1CH.1']::text[]),
  (105, array['1CH.2', '1CH.3', '1CH.4']::text[]),
  (106, array['1CH.5', '1CH.6', '1CH.7']::text[]),
  (107, array['1CH.8', '1CH.9', '1CH.10', '1CH.11']::text[]),
  (108, array['1CH.12', '1CH.13', '1CH.14']::text[]),
  (109, array['1CH.15', '1CH.16', '1CH.17']::text[]),
  (110, array['1CH.18', '1CH.19', '1CH.20']::text[]),
  (111, array['1CH.21', '1CH.22', '1CH.23', '1CH.24']::text[]),
  (112, array['1CH.25', '1CH.26', '1CH.27']::text[]),
  (113, array['1CH.28', '1CH.29', '2CH.1']::text[]),
  (114, array['2CH.2', '2CH.3', '2CH.4']::text[]),
  (115, array['2CH.5', '2CH.6', '2CH.7', '2CH.8']::text[]),
  (116, array['2CH.9', '2CH.10', '2CH.11']::text[]),
  (117, array['2CH.12', '2CH.13', '2CH.14']::text[]),
  (118, array['2CH.15', '2CH.16', '2CH.17']::text[]),
  (119, array['2CH.18', '2CH.19', '2CH.20', '2CH.21']::text[]),
  (120, array['2CH.22', '2CH.23', '2CH.24']::text[]),
  (121, array['2CH.25', '2CH.26', '2CH.27']::text[]),
  (122, array['2CH.28', '2CH.29', '2CH.30']::text[]),
  (123, array['2CH.31', '2CH.32', '2CH.33', '2CH.34']::text[]),
  (124, array['2CH.35', '2CH.36', 'EZR.1']::text[]),
  (125, array['EZR.2', 'EZR.3', 'EZR.4']::text[]),
  (126, array['EZR.5', 'EZR.6', 'EZR.7']::text[]),
  (127, array['EZR.8', 'EZR.9', 'EZR.10', 'NEH.1']::text[]),
  (128, array['NEH.2', 'NEH.3', 'NEH.4']::text[]),
  (129, array['NEH.5', 'NEH.6', 'NEH.7']::text[]),
  (130, array['NEH.8', 'NEH.9', 'NEH.10']::text[]),
  (131, array['NEH.11', 'NEH.12', 'NEH.13', 'EST.1']::text[]),
  (132, array['EST.2', 'EST.3', 'EST.4']::text[]),
  (133, array['EST.5', 'EST.6', 'EST.7']::text[]),
  (134, array['EST.8', 'EST.9', 'EST.10', 'JOB.1']::text[]),
  (135, array['JOB.2', 'JOB.3', 'JOB.4']::text[]),
  (136, array['JOB.5', 'JOB.6', 'JOB.7']::text[]),
  (137, array['JOB.8', 'JOB.9', 'JOB.10']::text[]),
  (138, array['JOB.11', 'JOB.12', 'JOB.13', 'JOB.14']::text[]),
  (139, array['JOB.15', 'JOB.16', 'JOB.17']::text[]),
  (140, array['JOB.18', 'JOB.19', 'JOB.20']::text[]),
  (141, array['JOB.21', 'JOB.22', 'JOB.23']::text[]),
  (142, array['JOB.24', 'JOB.25', 'JOB.26', 'JOB.27']::text[]),
  (143, array['JOB.28', 'JOB.29', 'JOB.30']::text[]),
  (144, array['JOB.31', 'JOB.32', 'JOB.33']::text[]),
  (145, array['JOB.34', 'JOB.35', 'JOB.36']::text[]),
  (146, array['JOB.37', 'JOB.38', 'JOB.39', 'JOB.40']::text[]),
  (147, array['JOB.41', 'JOB.42', 'PSA.1']::text[]),
  (148, array['PSA.2', 'PSA.3', 'PSA.4']::text[]),
  (149, array['PSA.5', 'PSA.6', 'PSA.7']::text[]),
  (150, array['PSA.8', 'PSA.9', 'PSA.10', 'PSA.11']::text[]),
  (151, array['PSA.12', 'PSA.13', 'PSA.14']::text[]),
  (152, array['PSA.15', 'PSA.16', 'PSA.17']::text[]),
  (153, array['PSA.18', 'PSA.19', 'PSA.20']::text[]),
  (154, array['PSA.21', 'PSA.22', 'PSA.23', 'PSA.24']::text[]),
  (155, array['PSA.25', 'PSA.26', 'PSA.27']::text[]),
  (156, array['PSA.28', 'PSA.29', 'PSA.30']::text[]),
  (157, array['PSA.31', 'PSA.32', 'PSA.33']::text[]),
  (158, array['PSA.34', 'PSA.35', 'PSA.36', 'PSA.37']::text[]),
  (159, array['PSA.38', 'PSA.39', 'PSA.40']::text[]),
  (160, array['PSA.41', 'PSA.42', 'PSA.43']::text[]),
  (161, array['PSA.44', 'PSA.45', 'PSA.46']::text[]),
  (162, array['PSA.47', 'PSA.48', 'PSA.49', 'PSA.50']::text[]),
  (163, array['PSA.51', 'PSA.52', 'PSA.53']::text[]),
  (164, array['PSA.54', 'PSA.55', 'PSA.56']::text[]),
  (165, array['PSA.57', 'PSA.58', 'PSA.59']::text[]),
  (166, array['PSA.60', 'PSA.61', 'PSA.62', 'PSA.63']::text[]),
  (167, array['PSA.64', 'PSA.65', 'PSA.66']::text[]),
  (168, array['PSA.67', 'PSA.68', 'PSA.69']::text[]),
  (169, array['PSA.70', 'PSA.71', 'PSA.72', 'PSA.73']::text[]),
  (170, array['PSA.74', 'PSA.75', 'PSA.76']::text[]),
  (171, array['PSA.77', 'PSA.78', 'PSA.79']::text[]),
  (172, array['PSA.80', 'PSA.81', 'PSA.82']::text[]),
  (173, array['PSA.83', 'PSA.84', 'PSA.85', 'PSA.86']::text[]),
  (174, array['PSA.87', 'PSA.88', 'PSA.89']::text[]),
  (175, array['PSA.90', 'PSA.91', 'PSA.92']::text[]),
  (176, array['PSA.93', 'PSA.94', 'PSA.95']::text[]),
  (177, array['PSA.96', 'PSA.97', 'PSA.98', 'PSA.99']::text[]),
  (178, array['PSA.100', 'PSA.101', 'PSA.102']::text[]),
  (179, array['PSA.103', 'PSA.104', 'PSA.105']::text[]),
  (180, array['PSA.106', 'PSA.107', 'PSA.108']::text[]),
  (181, array['PSA.109', 'PSA.110', 'PSA.111', 'PSA.112']::text[]),
  (182, array['PSA.113', 'PSA.114', 'PSA.115']::text[]),
  (183, array['PSA.116', 'PSA.117', 'PSA.118']::text[]),
  (184, array['PSA.119', 'PSA.120', 'PSA.121']::text[]),
  (185, array['PSA.122', 'PSA.123', 'PSA.124', 'PSA.125']::text[]),
  (186, array['PSA.126', 'PSA.127', 'PSA.128']::text[]),
  (187, array['PSA.129', 'PSA.130', 'PSA.131']::text[]),
  (188, array['PSA.132', 'PSA.133', 'PSA.134']::text[]),
  (189, array['PSA.135', 'PSA.136', 'PSA.137', 'PSA.138']::text[]),
  (190, array['PSA.139', 'PSA.140', 'PSA.141']::text[]),
  (191, array['PSA.142', 'PSA.143', 'PSA.144']::text[]),
  (192, array['PSA.145', 'PSA.146', 'PSA.147']::text[]),
  (193, array['PSA.148', 'PSA.149', 'PSA.150', 'PRO.1']::text[]),
  (194, array['PRO.2', 'PRO.3', 'PRO.4']::text[]),
  (195, array['PRO.5', 'PRO.6', 'PRO.7']::text[]),
  (196, array['PRO.8', 'PRO.9', 'PRO.10']::text[]),
  (197, array['PRO.11', 'PRO.12', 'PRO.13', 'PRO.14']::text[]),
  (198, array['PRO.15', 'PRO.16', 'PRO.17']::text[]),
  (199, array['PRO.18', 'PRO.19', 'PRO.20']::text[]),
  (200, array['PRO.21', 'PRO.22', 'PRO.23', 'PRO.24']::text[]),
  (201, array['PRO.25', 'PRO.26', 'PRO.27']::text[]),
  (202, array['PRO.28', 'PRO.29', 'PRO.30']::text[]),
  (203, array['PRO.31', 'ECC.1', 'ECC.2']::text[]),
  (204, array['ECC.3', 'ECC.4', 'ECC.5', 'ECC.6']::text[]),
  (205, array['ECC.7', 'ECC.8', 'ECC.9']::text[]),
  (206, array['ECC.10', 'ECC.11', 'ECC.12']::text[]),
  (207, array['SNG.1', 'SNG.2', 'SNG.3']::text[]),
  (208, array['SNG.4', 'SNG.5', 'SNG.6', 'SNG.7']::text[]),
  (209, array['SNG.8', 'ISA.1', 'ISA.2']::text[]),
  (210, array['ISA.3', 'ISA.4', 'ISA.5']::text[]),
  (211, array['ISA.6', 'ISA.7', 'ISA.8']::text[]),
  (212, array['ISA.9', 'ISA.10', 'ISA.11', 'ISA.12']::text[]),
  (213, array['ISA.13', 'ISA.14', 'ISA.15']::text[]),
  (214, array['ISA.16', 'ISA.17', 'ISA.18']::text[]),
  (215, array['ISA.19', 'ISA.20', 'ISA.21']::text[]),
  (216, array['ISA.22', 'ISA.23', 'ISA.24', 'ISA.25']::text[]),
  (217, array['ISA.26', 'ISA.27', 'ISA.28']::text[]),
  (218, array['ISA.29', 'ISA.30', 'ISA.31']::text[]),
  (219, array['ISA.32', 'ISA.33', 'ISA.34']::text[]),
  (220, array['ISA.35', 'ISA.36', 'ISA.37', 'ISA.38']::text[]),
  (221, array['ISA.39', 'ISA.40', 'ISA.41']::text[]),
  (222, array['ISA.42', 'ISA.43', 'ISA.44']::text[]),
  (223, array['ISA.45', 'ISA.46', 'ISA.47']::text[]),
  (224, array['ISA.48', 'ISA.49', 'ISA.50', 'ISA.51']::text[]),
  (225, array['ISA.52', 'ISA.53', 'ISA.54']::text[]),
  (226, array['ISA.55', 'ISA.56', 'ISA.57']::text[]),
  (227, array['ISA.58', 'ISA.59', 'ISA.60']::text[]),
  (228, array['ISA.61', 'ISA.62', 'ISA.63', 'ISA.64']::text[]),
  (229, array['ISA.65', 'ISA.66', 'JER.1']::text[]),
  (230, array['JER.2', 'JER.3', 'JER.4']::text[]),
  (231, array['JER.5', 'JER.6', 'JER.7']::text[]),
  (232, array['JER.8', 'JER.9', 'JER.10', 'JER.11']::text[]),
  (233, array['JER.12', 'JER.13', 'JER.14']::text[]),
  (234, array['JER.15', 'JER.16', 'JER.17']::text[]),
  (235, array['JER.18', 'JER.19', 'JER.20', 'JER.21']::text[]),
  (236, array['JER.22', 'JER.23', 'JER.24']::text[]),
  (237, array['JER.25', 'JER.26', 'JER.27']::text[]),
  (238, array['JER.28', 'JER.29', 'JER.30']::text[]),
  (239, array['JER.31', 'JER.32', 'JER.33', 'JER.34']::text[]),
  (240, array['JER.35', 'JER.36', 'JER.37']::text[]),
  (241, array['JER.38', 'JER.39', 'JER.40']::text[]),
  (242, array['JER.41', 'JER.42', 'JER.43']::text[]),
  (243, array['JER.44', 'JER.45', 'JER.46', 'JER.47']::text[]),
  (244, array['JER.48', 'JER.49', 'JER.50']::text[]),
  (245, array['JER.51', 'JER.52', 'LAM.1']::text[]),
  (246, array['LAM.2', 'LAM.3', 'LAM.4']::text[]),
  (247, array['LAM.5', 'EZK.1', 'EZK.2', 'EZK.3']::text[]),
  (248, array['EZK.4', 'EZK.5', 'EZK.6']::text[]),
  (249, array['EZK.7', 'EZK.8', 'EZK.9']::text[]),
  (250, array['EZK.10', 'EZK.11', 'EZK.12']::text[]),
  (251, array['EZK.13', 'EZK.14', 'EZK.15', 'EZK.16']::text[]),
  (252, array['EZK.17', 'EZK.18', 'EZK.19']::text[]),
  (253, array['EZK.20', 'EZK.21', 'EZK.22']::text[]),
  (254, array['EZK.23', 'EZK.24', 'EZK.25']::text[]),
  (255, array['EZK.26', 'EZK.27', 'EZK.28', 'EZK.29']::text[]),
  (256, array['EZK.30', 'EZK.31', 'EZK.32']::text[]),
  (257, array['EZK.33', 'EZK.34', 'EZK.35']::text[]),
  (258, array['EZK.36', 'EZK.37', 'EZK.38']::text[]),
  (259, array['EZK.39', 'EZK.40', 'EZK.41', 'EZK.42']::text[]),
  (260, array['EZK.43', 'EZK.44', 'EZK.45']::text[]),
  (261, array['EZK.46', 'EZK.47', 'EZK.48']::text[]),
  (262, array['DAN.1', 'DAN.2', 'DAN.3']::text[]),
  (263, array['DAN.4', 'DAN.5', 'DAN.6', 'DAN.7']::text[]),
  (264, array['DAN.8', 'DAN.9', 'DAN.10']::text[]),
  (265, array['DAN.11', 'DAN.12', 'HOS.1']::text[]),
  (266, array['HOS.2', 'HOS.3', 'HOS.4', 'HOS.5']::text[]),
  (267, array['HOS.6', 'HOS.7', 'HOS.8']::text[]),
  (268, array['HOS.9', 'HOS.10', 'HOS.11']::text[]),
  (269, array['HOS.12', 'HOS.13', 'HOS.14']::text[]),
  (270, array['JOL.1', 'JOL.2', 'JOL.3', 'AMO.1']::text[]),
  (271, array['AMO.2', 'AMO.3', 'AMO.4']::text[]),
  (272, array['AMO.5', 'AMO.6', 'AMO.7']::text[]),
  (273, array['AMO.8', 'AMO.9', 'OBA.1']::text[]),
  (274, array['JON.1', 'JON.2', 'JON.3', 'JON.4']::text[]),
  (275, array['MIC.1', 'MIC.2', 'MIC.3']::text[]),
  (276, array['MIC.4', 'MIC.5', 'MIC.6']::text[]),
  (277, array['MIC.7', 'NAM.1', 'NAM.2']::text[]),
  (278, array['NAM.3', 'HAB.1', 'HAB.2', 'HAB.3']::text[]),
  (279, array['ZEP.1', 'ZEP.2', 'ZEP.3']::text[]),
  (280, array['HAG.1', 'HAG.2', 'ZEC.1']::text[]),
  (281, array['ZEC.2', 'ZEC.3', 'ZEC.4']::text[]),
  (282, array['ZEC.5', 'ZEC.6', 'ZEC.7', 'ZEC.8']::text[]),
  (283, array['ZEC.9', 'ZEC.10', 'ZEC.11']::text[]),
  (284, array['ZEC.12', 'ZEC.13', 'ZEC.14']::text[]),
  (285, array['MAL.1', 'MAL.2', 'MAL.3']::text[]),
  (286, array['MAL.4', 'MAT.1', 'MAT.2', 'MAT.3']::text[]),
  (287, array['MAT.4', 'MAT.5', 'MAT.6']::text[]),
  (288, array['MAT.7', 'MAT.8', 'MAT.9']::text[]),
  (289, array['MAT.10', 'MAT.11', 'MAT.12']::text[]),
  (290, array['MAT.13', 'MAT.14', 'MAT.15', 'MAT.16']::text[]),
  (291, array['MAT.17', 'MAT.18', 'MAT.19']::text[]),
  (292, array['MAT.20', 'MAT.21', 'MAT.22']::text[]),
  (293, array['MAT.23', 'MAT.24', 'MAT.25']::text[]),
  (294, array['MAT.26', 'MAT.27', 'MAT.28', 'MRK.1']::text[]),
  (295, array['MRK.2', 'MRK.3', 'MRK.4']::text[]),
  (296, array['MRK.5', 'MRK.6', 'MRK.7']::text[]),
  (297, array['MRK.8', 'MRK.9', 'MRK.10']::text[]),
  (298, array['MRK.11', 'MRK.12', 'MRK.13', 'MRK.14']::text[]),
  (299, array['MRK.15', 'MRK.16', 'LUK.1']::text[]),
  (300, array['LUK.2', 'LUK.3', 'LUK.4']::text[]),
  (301, array['LUK.5', 'LUK.6', 'LUK.7', 'LUK.8']::text[]),
  (302, array['LUK.9', 'LUK.10', 'LUK.11']::text[]),
  (303, array['LUK.12', 'LUK.13', 'LUK.14']::text[]),
  (304, array['LUK.15', 'LUK.16', 'LUK.17']::text[]),
  (305, array['LUK.18', 'LUK.19', 'LUK.20', 'LUK.21']::text[]),
  (306, array['LUK.22', 'LUK.23', 'LUK.24']::text[]),
  (307, array['JHN.1', 'JHN.2', 'JHN.3']::text[]),
  (308, array['JHN.4', 'JHN.5', 'JHN.6']::text[]),
  (309, array['JHN.7', 'JHN.8', 'JHN.9', 'JHN.10']::text[]),
  (310, array['JHN.11', 'JHN.12', 'JHN.13']::text[]),
  (311, array['JHN.14', 'JHN.15', 'JHN.16']::text[]),
  (312, array['JHN.17', 'JHN.18', 'JHN.19']::text[]),
  (313, array['JHN.20', 'JHN.21', 'ACT.1', 'ACT.2']::text[]),
  (314, array['ACT.3', 'ACT.4', 'ACT.5']::text[]),
  (315, array['ACT.6', 'ACT.7', 'ACT.8']::text[]),
  (316, array['ACT.9', 'ACT.10', 'ACT.11']::text[]),
  (317, array['ACT.12', 'ACT.13', 'ACT.14', 'ACT.15']::text[]),
  (318, array['ACT.16', 'ACT.17', 'ACT.18']::text[]),
  (319, array['ACT.19', 'ACT.20', 'ACT.21']::text[]),
  (320, array['ACT.22', 'ACT.23', 'ACT.24']::text[]),
  (321, array['ACT.25', 'ACT.26', 'ACT.27', 'ACT.28']::text[]),
  (322, array['ROM.1', 'ROM.2', 'ROM.3']::text[]),
  (323, array['ROM.4', 'ROM.5', 'ROM.6']::text[]),
  (324, array['ROM.7', 'ROM.8', 'ROM.9']::text[]),
  (325, array['ROM.10', 'ROM.11', 'ROM.12', 'ROM.13']::text[]),
  (326, array['ROM.14', 'ROM.15', 'ROM.16']::text[]),
  (327, array['1CO.1', '1CO.2', '1CO.3']::text[]),
  (328, array['1CO.4', '1CO.5', '1CO.6']::text[]),
  (329, array['1CO.7', '1CO.8', '1CO.9', '1CO.10']::text[]),
  (330, array['1CO.11', '1CO.12', '1CO.13']::text[]),
  (331, array['1CO.14', '1CO.15', '1CO.16']::text[]),
  (332, array['2CO.1', '2CO.2', '2CO.3', '2CO.4']::text[]),
  (333, array['2CO.5', '2CO.6', '2CO.7']::text[]),
  (334, array['2CO.8', '2CO.9', '2CO.10']::text[]),
  (335, array['2CO.11', '2CO.12', '2CO.13']::text[]),
  (336, array['GAL.1', 'GAL.2', 'GAL.3', 'GAL.4']::text[]),
  (337, array['GAL.5', 'GAL.6', 'EPH.1']::text[]),
  (338, array['EPH.2', 'EPH.3', 'EPH.4']::text[]),
  (339, array['EPH.5', 'EPH.6', 'PHP.1']::text[]),
  (340, array['PHP.2', 'PHP.3', 'PHP.4', 'COL.1']::text[]),
  (341, array['COL.2', 'COL.3', 'COL.4']::text[]),
  (342, array['1TH.1', '1TH.2', '1TH.3']::text[]),
  (343, array['1TH.4', '1TH.5', '2TH.1']::text[]),
  (344, array['2TH.2', '2TH.3', '1TI.1', '1TI.2']::text[]),
  (345, array['1TI.3', '1TI.4', '1TI.5']::text[]),
  (346, array['1TI.6', '2TI.1', '2TI.2']::text[]),
  (347, array['2TI.3', '2TI.4', 'TIT.1']::text[]),
  (348, array['TIT.2', 'TIT.3', 'PHM.1', 'HEB.1']::text[]),
  (349, array['HEB.2', 'HEB.3', 'HEB.4']::text[]),
  (350, array['HEB.5', 'HEB.6', 'HEB.7']::text[]),
  (351, array['HEB.8', 'HEB.9', 'HEB.10']::text[]),
  (352, array['HEB.11', 'HEB.12', 'HEB.13', 'JAS.1']::text[]),
  (353, array['JAS.2', 'JAS.3', 'JAS.4']::text[]),
  (354, array['JAS.5', '1PE.1', '1PE.2']::text[]),
  (355, array['1PE.3', '1PE.4', '1PE.5']::text[]),
  (356, array['2PE.1', '2PE.2', '2PE.3', '1JN.1']::text[]),
  (357, array['1JN.2', '1JN.3', '1JN.4']::text[]),
  (358, array['1JN.5', '2JN.1', '3JN.1']::text[]),
  (359, array['JUD.1', 'REV.1', 'REV.2']::text[]),
  (360, array['REV.3', 'REV.4', 'REV.5', 'REV.6']::text[]),
  (361, array['REV.7', 'REV.8', 'REV.9']::text[]),
  (362, array['REV.10', 'REV.11', 'REV.12']::text[]),
  (363, array['REV.13', 'REV.14', 'REV.15']::text[]),
  (364, array['REV.16', 'REV.17', 'REV.18', 'REV.19']::text[]),
  (365, array['REV.20', 'REV.21', 'REV.22']::text[])
) as d(day, readings);
