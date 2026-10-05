-- 0052 — Prayer: a quiet reminder through a busy day, never a to-do.
--
--   * Members, Leaders and Admins choose a few times through the day (like
--     Daniel, 6:10), each with an optional short email.
--   * A quiet moment: a verse for the day and, if they like, two or three
--     names from their own list to hold before God. "Amen" closes it. The
--     names rotate gently so everyone comes up over time.
--   * Their list is private — only they can read it (not Leaders, not the
--     Ekklē team). A request can be marked answered with a short note, to
--     look back on with gratitude.
--   * Nothing is scored: no ticks, streaks, counts or "missed" times.

create table if not exists prayer_times (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  label         text not null check (char_length(trim(label)) between 1 and 30),
  at            time not null,
  tz            text not null,
  email         boolean not null default false,
  last_sent_on  date,
  created_at    timestamptz not null default now()
);
create index if not exists prayer_times_user_idx on prayer_times (user_id);
alter table prayer_times enable row level security;
revoke all on prayer_times from anon, authenticated;

create table if not exists prayer_people (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 80),
  request        text not null default '' check (char_length(request) <= 500),
  answered_at    timestamptz,
  answered_note  text not null default '' check (char_length(answered_note) <= 500),
  -- When they last came up in a quiet moment (rotation only; never shown).
  shown_at       timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists prayer_people_user_idx on prayer_people (user_id, answered_at, shown_at);
alter table prayer_people enable row level security;
revoke all on prayer_people from anon, authenticated;

-- A verse for the day (the same for everyone), shown from the built-in Bible.
create or replace function private.prayer_verse(p_day date)
returns text language sql immutable set search_path = ''
as $$
  select (array[
    'DAN.6:10-10', 'PSA.5:3-3', 'PSA.55:17-17', 'PSA.46:10-10', 'MAT.11:28-28', 'PHP.4:6-7',
    '1TH.5:16-18', 'MAT.6:6-6', 'ISA.40:31-31', 'PSA.62:8-8', 'LAM.3:22-23', 'PSA.121:1-2',
    'JER.29:12-13', '1PE.5:7-7', 'HEB.4:16-16', 'JAS.5:16-16', 'PSA.145:18-18', 'MRK.1:35-35',
    'LUK.5:16-16', 'ROM.8:26-26', 'ROM.12:12-12', 'COL.4:2-2', 'EPH.6:18-18', '1JN.5:14-14',
    'PSA.139:23-24', 'PSA.23:1-3', 'MAT.7:7-8', 'JHN.15:7-7', 'PSA.34:18-18', 'ISA.26:3-3'
  ])[1 + ((p_day - date '2026-01-01') % 30 + 30) % 30];
$$;

-- The next few names, gently rotating (those not seen longest come first).
create or replace function private.prayer_names(p_user uuid, p_exclude uuid[], p_n int)
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'request', x.request)), '[]'::jsonb)
  from (select id, name, request from prayer_people
         where user_id = p_user and answered_at is null and not (id = any (coalesce(p_exclude, '{}')))
         order by shown_at nulls first, created_at
         limit p_n) x;
$$;
revoke execute on function private.prayer_names(uuid, uuid[], int) from public;

create or replace function private.prayer_person_json(p prayer_people)
returns jsonb language sql stable set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'request', p.request,
                            'answered_at', p.answered_at, 'answered_note', p.answered_note);
$$;
revoke execute on function private.prayer_person_json(prayer_people) from public;

-- ---------------------------------------------------------------------------
-- Their own prayer page
-- ---------------------------------------------------------------------------
create or replace function my_prayer()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_me uuid := app_user_id();
begin
  if v_me is null then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'times', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label,
                         'at', to_char(t.at, 'HH24:MI'), 'tz', t.tz, 'email', t.email) order by t.at)
                       from prayer_times t where t.user_id = v_me), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(private.prayer_person_json(p) order by p.created_at)
                        from prayer_people p where p.user_id = v_me and p.answered_at is null), '[]'::jsonb),
    'answered', coalesce((select jsonb_agg(private.prayer_person_json(p) order by p.answered_at desc)
                          from prayer_people p where p.user_id = v_me and p.answered_at is not null), '[]'::jsonb));
end;
$$;

-- A quiet moment: the day's verse and a few names (not those just shown).
create or replace function prayer_moment(p_today date, p_exclude uuid[])
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_me uuid := app_user_id();
begin
  if v_me is null then raise exception 'forbidden'; end if;
  return jsonb_build_object('verse', private.prayer_verse(coalesce(p_today, current_date)),
                            'people', private.prayer_names(v_me, p_exclude, 3));
end;
$$;

-- "Amen": the names they held move to the back of the rotation.
create or replace function prayer_amen(p_ids uuid[])
returns void language plpgsql security definer set search_path = public
as $$
begin
  if app_user_id() is null then raise exception 'forbidden'; end if;
  update prayer_people set shown_at = now() where user_id = app_user_id() and id = any (coalesce(p_ids, '{}'));
end;
$$;

create or replace function save_prayer_person(p_id uuid, p_name text, p_request text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_me uuid := app_user_id(); v_id uuid;
begin
  if v_me is null then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'missing'; end if;
  if p_id is null then
    insert into prayer_people (user_id, name, request)
    values (v_me, trim(p_name), trim(coalesce(p_request, '')))
    returning id into v_id;
  else
    update prayer_people set name = trim(p_name), request = trim(coalesce(p_request, ''))
     where id = p_id and user_id = v_me
    returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  return v_id;
end;
$$;

-- Answered (with an optional note), or back to the list.
create or replace function answer_prayer(p_id uuid, p_answered boolean, p_note text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if app_user_id() is null then raise exception 'forbidden'; end if;
  update prayer_people
     set answered_at = case when p_answered then coalesce(answered_at, now()) end,
         answered_note = case when p_answered then trim(coalesce(p_note, '')) else '' end
   where id = p_id and user_id = app_user_id();
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function delete_prayer_person(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if app_user_id() is null then raise exception 'forbidden'; end if;
  delete from prayer_people where id = p_id and user_id = app_user_id();
end;
$$;

-- Up to five times a day; an email at each is optional.
create or replace function save_prayer_time(p_id uuid, p_label text, p_at time, p_tz text, p_email boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_me uuid := app_user_id(); v_id uuid;
begin
  if v_me is null then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_label, ''))) = 0 or p_at is null then raise exception 'missing'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'invalid_tz'; end if;
  if p_id is null then
    if (select count(*) from prayer_times where user_id = v_me) >= 5 then raise exception 'too_many'; end if;
    insert into prayer_times (user_id, label, at, tz, email)
    values (v_me, trim(p_label), p_at, p_tz, coalesce(p_email, false))
    returning id into v_id;
  else
    update prayer_times set label = trim(p_label), at = p_at, tz = p_tz, email = coalesce(p_email, false),
                            -- a new time today shouldn't count as already sent
                            last_sent_on = case when at <> p_at then null else last_sent_on end
     where id = p_id and user_id = v_me
    returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function delete_prayer_time(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if app_user_id() is null then raise exception 'forbidden'; end if;
  delete from prayer_times where id = p_id and user_id = app_user_id();
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['my_prayer()', 'prayer_moment(date, uuid[])', 'prayer_amen(uuid[])',
      'save_prayer_person(uuid, text, text)', 'answer_prayer(uuid, boolean, text)', 'delete_prayer_person(uuid)',
      'save_prayer_time(uuid, text, time, text, boolean)', 'delete_prayer_time(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The email at each chosen time (opt-in). Sent within the hour after it, once
-- a day; a time that passes unsent simply passes.
-- ---------------------------------------------------------------------------
create or replace function private.prayer_times_due()
returns int language plpgsql security definer set search_path = public
as $$
declare v_row record; v_names jsonb; v_n int := 0;
begin
  for v_row in
    select t.id, t.label, t.user_id, u.auth_uid, u.org_id, (now() at time zone t.tz)::date as today
    from prayer_times t join users u on u.id = t.user_id
    where t.email and u.active and u.auth_uid is not null
      and (now() at time zone t.tz)::time - t.at between interval '0' and interval '59 minutes'
      and (t.last_sent_on is null or t.last_sent_on < (now() at time zone t.tz)::date)
  loop
    v_names := private.prayer_names(v_row.user_id, null, 3);
    update prayer_people set shown_at = now()
     where id in (select (n ->> 'id')::uuid from jsonb_array_elements(v_names) n);
    perform private.notify_edge('notify', jsonb_build_object(
      'kind', 'prayer', 'auth_uid', v_row.auth_uid, 'org_id', v_row.org_id, 'label', v_row.label,
      'verse', private.prayer_verse(v_row.today),
      'names', (select coalesce(jsonb_agg(jsonb_build_object('name', n ->> 'name', 'request', n ->> 'request')), '[]'::jsonb)
                  from jsonb_array_elements(v_names) n)));
    update prayer_times set last_sent_on = v_row.today where id = v_row.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.prayer_times_due() from public;

do $$
begin
  perform cron.schedule('ekkle-prayer-times', '*/15 * * * *', 'select private.prayer_times_due()');
exception when others then
  raise notice 'prayer times not scheduled: %', sqlerrm;
end $$;
