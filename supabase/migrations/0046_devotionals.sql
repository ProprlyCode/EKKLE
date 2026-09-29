-- 0046 — Daily devotionals, written by a ministry's Admins and Leaders.
--
--   * One per date (written ahead): a title, a Bible passage, a short
--     thought, a question to sit with and a short prayer. Draft or published.
--   * Everyone on the ministry's address — seekers in Your space and the
--     team — sees today's at the top of the Bible tab (the most recent one
--     when today has none) and can browse the past ones. Future ones stay
--     hidden until their day.
--   * An opt-in daily email with that day's devotional, at a time they
--     choose (only on days that have one).

create table if not exists devotionals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  day         date not null,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  passage     text check (passage ~ '^[1-3A-Z]{3}\.\d{1,3}(:\d{1,3}-\d{1,3})?$'),
  body        text not null check (char_length(trim(body)) between 1 and 6000),
  question    text check (char_length(question) <= 500),
  prayer      text check (char_length(prayer) <= 1000),
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, day)
);
alter table devotionals enable row level security;
revoke all on devotionals from anon, authenticated;
drop trigger if exists devotionals_updated_at on devotionals;
create trigger devotionals_updated_at before update on devotionals
  for each row execute function set_updated_at();

-- The ministry the caller reads as: their membership, else their seeker space.
create or replace function private.reader_org()
returns uuid language sql stable security definer set search_path = public
as $$ select coalesce(app_user_org(), (_seeker_rec()).org_id); $$;
revoke execute on function private.reader_org() from public;

-- Their "today" (from the device), kept within a day of the real date so
-- nobody reads ahead.
create or replace function private.reader_today(p_today date)
returns date language sql stable set search_path = ''
as $$
  select least(coalesce(p_today, current_date), (now() at time zone 'UTC')::date + 1);
$$;

create or replace function private.devotional_json(d devotionals)
returns jsonb language sql stable set search_path = public
as $$
  select jsonb_build_object('id', d.id, 'day', d.day, 'title', d.title, 'passage', d.passage,
                            'body', d.body, 'question', d.question, 'prayer', d.prayer, 'status', d.status);
$$;

-- Today's (or the latest before it).
create or replace function todays_devotional(p_today date)
returns jsonb language sql stable security definer set search_path = public
as $$
  select private.devotional_json(d) from devotionals d
   where d.org_id = private.reader_org() and d.status = 'published'
     and d.day <= private.reader_today(p_today)
   order by d.day desc limit 1;
$$;

-- Past ones, newest first (60 at a time).
create or replace function past_devotionals(p_today date, p_before date)
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(private.devotional_json(d) order by d.day desc), '[]'::jsonb)
  from (select * from devotionals d
         where d.org_id = private.reader_org() and d.status = 'published'
           and d.day <= private.reader_today(p_today)
           and (p_before is null or d.day < p_before)
         order by d.day desc limit 60) d;
$$;

-- ---------------------------------------------------------------------------
-- Writing them (Admins and Leaders)
-- ---------------------------------------------------------------------------
create or replace function devotional_library()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(private.devotional_json(d) || jsonb_build_object(
                     'author', (select u.name from users u where u.id = d.created_by))
                   order by d.day desc)
                   from devotionals d where d.org_id = app_user_org()), '[]'::jsonb);
end;
$$;

create or replace function save_devotional(
  p_id uuid, p_day date, p_title text, p_passage text, p_body text, p_question text, p_prayer text, p_status text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_id uuid;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if p_day is null or char_length(trim(coalesce(p_title, ''))) = 0 or char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'missing';
  end if;
  if nullif(trim(p_passage), '') is not null
     and trim(p_passage) !~ '^[1-3A-Z]{3}\.\d{1,3}(:\d{1,3}-\d{1,3})?$' then
    raise exception 'invalid_passage';
  end if;
  if exists (select 1 from devotionals where org_id = v_org and day = p_day and id is distinct from p_id) then
    raise exception 'day_taken';
  end if;
  if p_id is null then
    insert into devotionals (org_id, day, title, passage, body, question, prayer, status, created_by)
    values (v_org, p_day, trim(p_title), nullif(trim(p_passage), ''), trim(p_body),
            nullif(trim(p_question), ''), nullif(trim(p_prayer), ''),
            case when p_status = 'published' then 'published' else 'draft' end, app_user_id())
    returning id into v_id;
  else
    update devotionals
       set day = p_day, title = trim(p_title), passage = nullif(trim(p_passage), ''), body = trim(p_body),
           question = nullif(trim(p_question), ''), prayer = nullif(trim(p_prayer), ''),
           status = case when p_status = 'published' then 'published' else 'draft' end
     where id = p_id and org_id = v_org
    returning id into v_id;
    if v_id is null then raise exception 'forbidden'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function delete_devotional(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  delete from devotionals where id = p_id and org_id = app_user_org();
end;
$$;

-- ---------------------------------------------------------------------------
-- The daily email (opt-in)
-- ---------------------------------------------------------------------------
create table if not exists devotional_reminders (
  auth_uid      uuid not null references auth.users (id) on delete cascade,
  org_id        uuid not null references organizations (id) on delete cascade,
  area          text not null check (area in ('app', 'space')),
  remind_at     time not null,
  tz            text not null,
  last_sent_on  date,
  primary key (auth_uid, org_id)
);
create index if not exists devotional_reminders_org_idx on devotional_reminders (org_id);
alter table devotional_reminders enable row level security;
revoke all on devotional_reminders from anon, authenticated;

create or replace function my_devotional_reminder()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('at', to_char(remind_at, 'HH24:MI'), 'tz', tz)
  from devotional_reminders where auth_uid = auth.uid() and org_id = private.reader_org();
$$;

-- p_at null turns it off.
create or replace function set_devotional_reminder(p_at time, p_tz text, p_area text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org uuid := private.reader_org();
begin
  if auth.uid() is null or v_org is null then raise exception 'forbidden'; end if;
  if p_at is null then
    delete from devotional_reminders where auth_uid = auth.uid() and org_id = v_org;
    return;
  end if;
  if p_area not in ('app', 'space') or not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'invalid_reminder';
  end if;
  insert into devotional_reminders (auth_uid, org_id, area, remind_at, tz)
  values (auth.uid(), v_org, p_area, p_at, p_tz)
  on conflict (auth_uid, org_id) do update
    set area = excluded.area, remind_at = excluded.remind_at, tz = excluded.tz;
end;
$$;

create or replace function private.devotional_reminders_due()
returns int language plpgsql security definer set search_path = public
as $$
declare v_row record; v_n int := 0;
begin
  for v_row in
    select r.auth_uid, r.org_id, r.area, d.id as devotional_id, (now() at time zone r.tz)::date as today
    from devotional_reminders r
    join devotionals d on d.org_id = r.org_id and d.status = 'published'
                      and d.day = (now() at time zone r.tz)::date
    where (now() at time zone r.tz)::time >= r.remind_at
      and (r.last_sent_on is null or r.last_sent_on < (now() at time zone r.tz)::date)
  loop
    perform private.notify_edge('notify', jsonb_build_object(
      'kind', 'devotional', 'auth_uid', v_row.auth_uid, 'org_id', v_row.org_id,
      'area', v_row.area, 'devotional_id', v_row.devotional_id));
    update devotional_reminders set last_sent_on = v_row.today
     where auth_uid = v_row.auth_uid and org_id = v_row.org_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.devotional_reminders_due() from public;

do $$
begin
  perform cron.schedule('ekkle-devotional-reminders', '*/15 * * * *', 'select private.devotional_reminders_due()');
exception when others then
  raise notice 'devotional reminders not scheduled: %', sqlerrm;
end $$;

-- Deleting their details (0045) takes these too.
create or replace function delete_my_details()
returns void language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  delete from messages m using conversations c, recipients r
   where m.conversation_id = c.id and c.recipient_id = r.id and r.auth_uid = v_uid;
  update conversations c set status = 'blocked'
    from recipients r where c.recipient_id = r.id and r.auth_uid = v_uid;
  delete from study_progress p using recipients r where p.recipient_id = r.id and r.auth_uid = v_uid;
  update recipients
     set deleted_at = coalesce(deleted_at, now()), email = null, first_name = '', auth_uid = null,
         session_token = gen_random_uuid()::text
   where auth_uid = v_uid;
  delete from study_reminders where auth_uid = v_uid;
  delete from devotional_reminders where auth_uid = v_uid;
  if not exists (select 1 from users where auth_uid = v_uid) then
    delete from auth.users where id = v_uid;
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['todays_devotional(date)', 'past_devotionals(date, date)', 'devotional_library()',
      'save_devotional(uuid, date, text, text, text, text, text, text)', 'delete_devotional(uuid)',
      'my_devotional_reminder()', 'set_devotional_reminder(time, text, text)', 'delete_my_details()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
