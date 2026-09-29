-- 0045 — Pilot readiness: security and correctness fixes from the review.
--
--   1. The first study functions (0013: get_study, list_studies,
--      save_study_progress, complete_study) are no longer used. Anyone could
--      call them with a made-up session token to create seeker records and
--      mark studies complete, around the unlock rules. They're closed.
--   2. Functions only signed-in people use can no longer be called without
--      signing in (each already checked who's asking; now anon can't reach
--      them at all).
--   3. Delete my details: a seeker with a space at more than one ministry has
--      every one of them erased, not just the first.
--   4. The weekly study reminder: one email per reminder, even for a seeker
--      known to more than one ministry.
--   5. Fixed search paths on three small helpers; faster row checks on users
--      and Bible marks; indexes for the busiest lookups.

-- ---------------------------------------------------------------------------
-- 1–2. Who can call what
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  -- Retired: nobody calls these.
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('get_study', 'list_studies', 'save_study_progress', 'complete_study') loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;

  -- Signed-in only.
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('claim_membership', 'conversation_meta', 'erase_conversation', 'list_reports',
                                'my_conversations', 'open_reports_count', 'platform_overview', 'record_checkin',
                                'regenerate_join_code', 'replace_sequence_screens', 'resolve_report',
                                'set_member_active', 'set_my_active_sequence', 'set_org_settings',
                                'link_seeker_account', 'seeker_block_conversation', 'seeker_connection',
                                'seeker_send_message', 'seeker_studies', 'seeker_study', 'seeker_save_progress',
                                'seeker_complete_study') loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Delete my details — every ministry they're known to
-- ---------------------------------------------------------------------------
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
  -- Their sign-in goes too (with their Bible marks and reading plans), unless
  -- they're also on a ministry's team.
  if not exists (select 1 from users where auth_uid = v_uid) then
    delete from auth.users where id = v_uid;
  end if;
end;
$$;
revoke execute on function delete_my_details() from public, anon;
grant execute on function delete_my_details() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. One reminder email per reminder
-- ---------------------------------------------------------------------------
create or replace function private.study_reminders_due()
returns int language plpgsql security definer set search_path = public
as $$
declare v_row record; v_next jsonb; v_n int := 0;
begin
  for v_row in
    select s.auth_uid, s.org_id, (now() at time zone s.tz)::date as today, r as rec
    from study_reminders s
    join recipients r on r.auth_uid = s.auth_uid and r.org_id = s.org_id and r.deleted_at is null
    where extract(dow from now() at time zone s.tz) = s.weekday
      and (now() at time zone s.tz)::time >= s.remind_at
      and (s.last_sent_on is null or s.last_sent_on < (now() at time zone s.tz)::date)
  loop
    v_next := private.next_study(v_row.rec);
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

-- ---------------------------------------------------------------------------
-- 5. Search paths, row checks, indexes
-- ---------------------------------------------------------------------------
alter function private.getting_started_steps(text) set search_path = '';
alter function private.getting_started_marked_steps() set search_path = '';
alter function private.host_subdomain(text) set search_path = '';

drop policy if exists users_update_self on users;
create policy users_update_self on users
  for update to authenticated
  using (auth_uid = (select auth.uid()))
  with check (auth_uid = (select auth.uid()));

drop policy if exists users_select_team on users;
create policy users_select_team on users
  for select to authenticated
  using (auth_uid = (select auth.uid()) or (org_id = (select app_user_org()) and (select is_leadership())));

drop policy if exists bible_marks_own on bible_marks;
create policy bible_marks_own on bible_marks for all to authenticated
  using (auth_uid = (select auth.uid())) with check (auth_uid = (select auth.uid()));
drop policy if exists bible_state_own on bible_state;
create policy bible_state_own on bible_state for all to authenticated
  using (auth_uid = (select auth.uid())) with check (auth_uid = (select auth.uid()));

create index if not exists conversations_org_id_idx on conversations (org_id);
create index if not exists recipients_arrival_member_idx on recipients (arrival_member_id);
create index if not exists sequence_events_recipient_idx on sequence_events (recipient_id);
create index if not exists study_progress_study_idx on study_progress (study_id);
create index if not exists studies_series_idx on studies (series_id);
create index if not exists reading_progress_plan_idx on reading_progress (plan_id);
create index if not exists connection_checkins_recipient_idx on connection_checkins (recipient_id);
