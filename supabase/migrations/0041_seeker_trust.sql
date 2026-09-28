-- 0041 — N3: the seeker experience.
--
--   * A member's photo (optional): members upload their own to the public
--     `photos` bucket (in a folder named by their membership id); Admins and
--     Leaders can remove one, never upload one.
--   * "Who you're talking to": the landing and the seeker's connection return
--     the member's photo and ministry name for the card shown before writing.
--   * Delete my details: a seeker erases themselves — messages, conversation,
--     name and email, study progress and reminders — and, unless they are
--     also on a ministry's team, their sign-in (which takes their Bible
--     highlights, notes and reading plans with it).
--   * A weekly study reminder (opt-in): a day and time in their own time
--     zone, sent only while there is a study to do.

-- ---------------------------------------------------------------------------
-- Member photos
-- ---------------------------------------------------------------------------
alter table users add column if not exists photo text;
alter table users drop constraint if exists users_photo_check;
alter table users add constraint users_photo_check
  check (photo is null or photo ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A member uploads only into their own folder (their membership id).
create or replace function public.photo_folder()
returns text language sql stable security definer set search_path = public
as $$ select app_user_id()::text; $$;
revoke execute on function public.photo_folder() from public, anon;
grant execute on function public.photo_folder() to authenticated;

drop policy if exists "photos: upload" on storage.objects;
drop policy if exists "photos: replace" on storage.objects;
drop policy if exists "photos: remove" on storage.objects;
create policy "photos: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.photo_folder());
create policy "photos: replace" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.photo_folder());
create policy "photos: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.photo_folder());

-- The member sets (or, with null, removes) their own photo.
create or replace function set_my_photo(p_path text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_me uuid := app_user_id();
begin
  if v_me is null then raise exception 'forbidden'; end if;
  if p_path is not null and split_part(p_path, '/', 1) <> v_me::text then
    raise exception 'invalid_photo';
  end if;
  update users set photo = p_path where id = v_me;
end;
$$;

-- Admins and Leaders can take a photo down (not put one up).
create or replace function remove_member_photo(p_member uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  update users set photo = null where id = p_member and org_id = app_user_org();
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Who you're talking to"
-- ---------------------------------------------------------------------------
create or replace function private.member_card(p_member users)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'name', p_member.name,
    'short_message', p_member.short_message,
    'photo', p_member.photo,
    'ministry', (select o.name from organizations o where o.id = p_member.org_id));
$$;
revoke execute on function private.member_card(users) from public;

create or replace function get_recipient_landing(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member users;
  v_seq sequences;
  v_result jsonb;
begin
  select * into v_member from users where code_slug = p_slug and active = true
    and (request_account() is null or org_id = request_account()) limit 1;
  if not found then return null; end if;

  select * into v_seq from sequences
  where id = member_active_sequence_id(v_member);
  if not found then return null; end if;

  select jsonb_build_object(
    'member', private.member_card(v_member),
    'sequence', jsonb_build_object('id', v_seq.id, 'title', v_seq.title),
    'connect', jsonb_build_object(
      'headline', v_seq.connect_headline,
      'body', v_seq.connect_body,
      'ctas', v_seq.ctas
    ),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('headline', s.headline, 'body', s.body, 'icon', s.icon)
        order by s.sort_order)
      from sequence_screens s where s.sequence_id = v_seq.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function seeker_connection()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_member users; v_convo conversations;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  v_member := _seeker_member(v_rec);
  if v_member.id is null then return jsonb_build_object('member', null); end if;

  select * into v_convo from conversations
    where member_id = v_member.id and recipient_id = v_rec.id limit 1;

  return jsonb_build_object(
    'member', private.member_card(v_member),
    'status', coalesce(v_convo.status, 'active'),
    'messages', case when v_convo.id is null then '[]'::jsonb
                     else private.conversation_items(v_convo.id) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Weekly study reminder
-- ---------------------------------------------------------------------------
create table if not exists study_reminders (
  auth_uid      uuid primary key references auth.users (id) on delete cascade,
  org_id        uuid not null references organizations (id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  remind_at     time not null,
  tz            text not null,
  last_sent_on  date,
  created_at    timestamptz not null default now()
);
alter table study_reminders enable row level security;
revoke all on study_reminders from anon, authenticated;

-- The study a seeker has to do next: the first unlocked, unfinished one.
create or replace function private.next_study(p_rec recipients)
returns jsonb language sql stable security definer set search_path = public
as $$
  with ordered as (
    select s.id, s.title, s.series_id, o.rn,
           (select p.completed_at is not null from study_progress p
             where p.study_id = s.id and p.recipient_id = p_rec.id) as completed,
           (select p.last_page from study_progress p
             where p.study_id = s.id and p.recipient_id = p_rec.id) as last_page
    from private.ministry_study_order(p_rec.org_id) o
    join studies s on s.id = o.study_id
    where o.enabled),
  flagged as (
    select o.*, coalesce(o.completed, false) as done,
           row_number() over (partition by o.series_id order by o.rn) as n,
           coalesce(lag(coalesce(o.completed, false)) over (partition by o.series_id order by o.rn), true) as prev_done
    from ordered o)
  select jsonb_build_object('id', id, 'number', n, 'title', title,
                            'started', last_page is not null, 'page', coalesce(last_page, 1))
  from flagged
  where not done and prev_done
  order by (last_page is null), rn
  limit 1;
$$;
revoke execute on function private.next_study(recipients) from public;

create or replace function my_study_reminder()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('weekday', weekday, 'at', to_char(remind_at, 'HH24:MI'), 'tz', tz)
  from study_reminders where auth_uid = auth.uid();
$$;

-- p_weekday null turns it off.
create or replace function set_study_reminder(p_weekday int, p_at time, p_tz text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_rec recipients := _seeker_rec();
begin
  if v_rec.id is null then raise exception 'forbidden'; end if;
  if p_weekday is null then
    delete from study_reminders where auth_uid = auth.uid();
    return;
  end if;
  if p_weekday not between 0 and 6 or p_at is null
     or not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'invalid_reminder';
  end if;
  insert into study_reminders (auth_uid, org_id, weekday, remind_at, tz)
  values (auth.uid(), v_rec.org_id, p_weekday, p_at, p_tz)
  on conflict (auth_uid) do update
    set org_id = excluded.org_id, weekday = excluded.weekday,
        remind_at = excluded.remind_at, tz = excluded.tz;
end;
$$;

create or replace function private.study_reminders_due()
returns int language plpgsql security definer set search_path = public
as $$
declare v_row record; v_next jsonb; v_n int := 0;
begin
  for v_row in
    select s.auth_uid, s.org_id, (now() at time zone s.tz)::date as today, r as rec
    from study_reminders s
    join recipients r on r.auth_uid = s.auth_uid and r.deleted_at is null
    where extract(dow from now() at time zone s.tz) = s.weekday
      and (now() at time zone s.tz)::time >= s.remind_at
      and (s.last_sent_on is null or s.last_sent_on < (now() at time zone s.tz)::date)
  loop
    v_next := private.next_study(v_row.rec);
    -- Nothing left to do: no email (it picks up again if more studies arrive).
    if v_next is not null then
      perform private.notify_edge('notify', jsonb_build_object(
        'kind', 'study', 'auth_uid', v_row.auth_uid, 'org_id', v_row.org_id, 'study', v_next));
      v_n := v_n + 1;
    end if;
    update study_reminders set last_sent_on = v_row.today where auth_uid = v_row.auth_uid;
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.study_reminders_due() from public;

do $$
begin
  perform cron.schedule('ekkle-study-reminders', '*/15 * * * *', 'select private.study_reminders_due()');
exception when others then
  raise notice 'study reminders not scheduled: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Delete my details
-- ---------------------------------------------------------------------------
create or replace function delete_my_details()
returns void language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_rec recipients;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  select * into v_rec from recipients where auth_uid = v_uid limit 1;
  if v_rec.id is not null then
    -- The same erasure as a member's "erase", done by the seeker.
    delete from messages m using conversations c
     where m.conversation_id = c.id and c.recipient_id = v_rec.id;
    update conversations set status = 'blocked' where recipient_id = v_rec.id;
    delete from study_progress where recipient_id = v_rec.id;
    update recipients
       set deleted_at = now(), email = null, first_name = '', auth_uid = null,
           session_token = gen_random_uuid()::text
     where id = v_rec.id;
  end if;
  delete from study_reminders where auth_uid = v_uid;
  -- Their sign-in goes too (with their Bible marks and reading plans), unless
  -- they're also on a ministry's team.
  if not exists (select 1 from users where auth_uid = v_uid) then
    delete from auth.users where id = v_uid;
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['set_my_photo(text)', 'remove_member_photo(uuid)', 'my_study_reminder()',
      'set_study_reminder(int, time, text)', 'delete_my_details()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
