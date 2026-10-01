-- 0047 — Get started (0044): Admins get a fifth step, "Write a devotional"
-- (0046), ticked once the ministry has one.

create or replace function private.getting_started_steps(p_area text)
returns text[] language sql immutable
as $$
  select case p_area
    when 'admin'  then array['brand', 'invite_leader', 'preview_intro', 'invite_members', 'devotional']
    when 'member' then array['photo', 'message', 'share', 'cards']
    when 'seeker' then array['study', 'bible', 'reminder', 'install']
  end;
$$;
alter function private.getting_started_steps(text) set search_path = '';

create or replace function getting_started(p_area text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_org uuid := private.getting_started_scope(p_area);
  v_me users;
  v_rec recipients;
  v_row getting_started;
  v_done jsonb;
begin
  if v_org is null then return null; end if;
  select * into v_row from getting_started where auth_uid = auth.uid() and org_id = v_org and area = p_area;

  if p_area = 'admin' then
    v_done := jsonb_build_object(
      'brand', exists (select 1 from organizations o where o.id = v_org
                        and (o.logo_path is not null or o.accent_color is not null)),
      'invite_leader', exists (select 1 from users u where u.org_id = v_org and u.role in ('admin', 'leader')
                                and u.id <> app_user_id() and u.removed_at is null),
      'invite_members', exists (select 1 from users u where u.org_id = v_org and u.role = 'member'
                                 and u.removed_at is null),
      'devotional', exists (select 1 from devotionals d where d.org_id = v_org));
  elsif p_area = 'member' then
    select * into v_me from users where id = app_user_id();
    v_done := jsonb_build_object(
      'photo', v_me.photo is not null,
      'message', coalesce(trim(v_me.short_message), '') <> '',
      'share', exists (select 1 from sequence_events e where e.member_id = v_me.id and e.event = 'started'));
  else
    v_rec := _seeker_rec();
    v_done := jsonb_build_object(
      'study', exists (select 1 from study_progress p where p.recipient_id = v_rec.id),
      'bible', exists (select 1 from bible_state b where b.auth_uid = auth.uid()),
      'reminder', exists (select 1 from study_reminders s where s.auth_uid = auth.uid()));
  end if;

  -- Steps the app marks.
  select v_done || coalesce(jsonb_object_agg(s, s = any (coalesce(v_row.marked, '{}'))), '{}'::jsonb)
    into v_done
    from unnest(private.getting_started_steps(p_area)) s
   where s = any (private.getting_started_marked_steps());

  return jsonb_build_object('steps', v_done, 'dismissed', v_row.dismissed_at is not null);
end;
$$;
