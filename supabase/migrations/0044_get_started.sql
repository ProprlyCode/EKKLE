-- 0044 — "Get started" checklists: a card for a ministry's Admins, for every
-- team member, and for seekers. Most steps tick themselves off from what the
-- person has done; the few that can't be seen from the data (previewing the
-- introduction, printing wallet cards, opening the installed app) are marked
-- by the app when they happen. Anyone can hide their card.

create table if not exists getting_started (
  auth_uid      uuid not null references auth.users (id) on delete cascade,
  org_id        uuid not null references organizations (id) on delete cascade,
  area          text not null check (area in ('admin', 'member', 'seeker')),
  marked        text[] not null default '{}',
  dismissed_at  timestamptz,
  primary key (auth_uid, org_id, area)
);
alter table getting_started enable row level security;
revoke all on getting_started from anon, authenticated;

-- The steps each card has, and which ones are marked by the app.
create or replace function private.getting_started_steps(p_area text)
returns text[] language sql immutable
as $$
  select case p_area
    when 'admin'  then array['brand', 'invite_leader', 'preview_intro', 'invite_members']
    when 'member' then array['photo', 'message', 'share', 'cards']
    when 'seeker' then array['study', 'bible', 'reminder', 'install']
  end;
$$;

create or replace function private.getting_started_marked_steps()
returns text[] language sql immutable
as $$ select array['preview_intro', 'cards', 'install']; $$;

-- Who they are here, for this card (null: the card isn't theirs).
create or replace function private.getting_started_scope(p_area text)
returns uuid language sql stable security definer set search_path = public
as $$
  select case p_area
    when 'admin' then case when is_account_admin() then app_user_org() end
    when 'member' then app_user_org()
    when 'seeker' then (_seeker_rec()).org_id
  end;
$$;

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
                                 and u.removed_at is null));
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

create or replace function mark_getting_started(p_area text, p_step text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org uuid := private.getting_started_scope(p_area);
begin
  if v_org is null then raise exception 'forbidden'; end if;
  if not (p_step = any (private.getting_started_steps(p_area)))
     or not (p_step = any (private.getting_started_marked_steps())) then
    raise exception 'invalid_step';
  end if;
  insert into getting_started (auth_uid, org_id, area, marked)
  values (auth.uid(), v_org, p_area, array[p_step])
  on conflict (auth_uid, org_id, area) do update
    set marked = case when p_step = any (getting_started.marked) then getting_started.marked
                      else getting_started.marked || p_step end;
end;
$$;

-- Hide the card (p_hide false shows it again).
create or replace function dismiss_getting_started(p_area text, p_hide boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org uuid := private.getting_started_scope(p_area);
begin
  if v_org is null then raise exception 'forbidden'; end if;
  insert into getting_started (auth_uid, org_id, area, dismissed_at)
  values (auth.uid(), v_org, p_area, case when p_hide then now() end)
  on conflict (auth_uid, org_id, area) do update
    set dismissed_at = case when p_hide then now() end;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['getting_started(text)', 'mark_getting_started(text, text)',
      'dismiss_getting_started(text, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
