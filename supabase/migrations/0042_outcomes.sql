-- 0042 — N4: outcomes. Counts only, never message contents.
--
--   The path, for a time range (last 30 / 90 days, or all time):
--     opened      someone opened a member's link (flow started)
--     finished    they went through the flow
--     reached_out they wrote to the member
--     replied     the member wrote back
--     met         the member marked "we connected"
--   and studies: people who started one, and studies completed.
--
--   Admins and Leaders see their ministry and each member; a member sees
--   their own; the Ekklē team sees every ministry.

-- When a study was first opened (for "started in this range").
alter table study_progress add column if not exists created_at timestamptz;
update study_progress set created_at = updated_at where created_at is null;
alter table study_progress alter column created_at set default now();
alter table study_progress alter column created_at set not null;

-- One ministry (or one member of it) since a moment (null: all time).
create or replace function private.outcomes(p_org uuid, p_member uuid, p_since timestamptz)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'opened', (select count(*) from sequence_events e
                where e.org_id = p_org and e.event = 'started'
                  and (p_member is null or e.member_id = p_member)
                  and (p_since is null or e.created_at >= p_since)),
    'finished', (select count(*) from sequence_events e
                  where e.org_id = p_org and e.event = 'completed'
                    and (p_member is null or e.member_id = p_member)
                    and (p_since is null or e.created_at >= p_since)),
    'reached_out', (select count(*) from conversations c
                     where c.org_id = p_org
                       and (p_member is null or c.member_id = p_member)
                       and (p_since is null or c.created_at >= p_since)),
    'replied', (select count(*) from conversations c
                 where c.org_id = p_org
                   and (p_member is null or c.member_id = p_member)
                   and (p_since is null or c.created_at >= p_since)
                   and exists (select 1 from messages m
                                where m.conversation_id = c.id and m.sender_type = 'member')),
    'met', (select count(distinct (k.member_id, k.recipient_id)) from connection_checkins k
             join users u on u.id = k.member_id
             where u.org_id = p_org and k.connected = 'yes'
               and (p_member is null or k.member_id = p_member)
               and (p_since is null or k.created_at >= p_since)),
    'studies_started', (select count(distinct p.recipient_id) from study_progress p
                         join recipients r on r.id = p.recipient_id
                         where r.org_id = p_org
                           and (p_member is null or r.arrival_member_id = p_member)
                           and (p_since is null or p.created_at >= p_since)),
    'studies_completed', (select count(*) from study_progress p
                           join recipients r on r.id = p.recipient_id
                           where r.org_id = p_org and p.completed_at is not null
                             and (p_member is null or r.arrival_member_id = p_member)
                             and (p_since is null or p.completed_at >= p_since)));
$$;
revoke execute on function private.outcomes(uuid, uuid, timestamptz) from public;

-- Admins and Leaders: the ministry, and each member on the team.
create or replace function ministry_outcomes(p_days int)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_since timestamptz;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if p_days is not null and p_days not in (30, 90) then raise exception 'invalid_range'; end if;
  v_since := case when p_days is null then null else now() - make_interval(days => p_days) end;
  return jsonb_build_object(
    'ministry', private.outcomes(v_org, null, v_since),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'photo', u.photo,
                                          'outcomes', private.outcomes(v_org, u.id, v_since))
                       order by u.name)
      from users u
      where u.org_id = v_org and u.auth_uid is not null and u.removed_at is null), '[]'::jsonb));
end;
$$;

-- A member: their own link.
create or replace function my_outcomes(p_days int)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_me uuid := app_user_id();
begin
  if v_me is null then raise exception 'forbidden'; end if;
  if p_days is not null and p_days not in (30, 90) then raise exception 'invalid_range'; end if;
  return private.outcomes(app_user_org(), v_me,
    case when p_days is null then null else now() - make_interval(days => p_days) end);
end;
$$;

-- The Ekklē team: every ministry.
create or replace function platform_outcomes(p_days int)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_since timestamptz;
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  if p_days is not null and p_days not in (30, 90) then raise exception 'invalid_range'; end if;
  v_since := case when p_days is null then null else now() - make_interval(days => p_days) end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name,
                                        'outcomes', private.outcomes(o.id, null, v_since))
                     order by o.name)
    from organizations o), '[]'::jsonb);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['ministry_outcomes(int)', 'my_outcomes(int)', 'platform_outcomes(int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
