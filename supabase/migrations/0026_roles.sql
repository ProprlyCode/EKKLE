-- 0026 — Platform vs ministry accounts, and who can do what
-- (docs/accounts-and-roles.md, slice 1).
--
--   * The platform (Ekklē itself, ekkle.org/platform) has its own team:
--     platform_team, roles owner / admin / support. It is not a ministry.
--   * A ministry account's team (users) has roles admin / leader / member.
--     'leadership' becomes 'leader'; 'platform_admin' (a role *inside* a
--     ministry) is retired — the founder becomes that ministry's admin, and the
--     platform is run from platform_team.
--   * One person (login) can belong to more than one ministry: a membership per
--     ministry, unique per (ministry, person). Which membership applies comes
--     from the address the request came from (request_account(), 0023), so
--     every existing policy and function that asks "my org / my role" now
--     means "in this ministry". On ekkle.org, ministry memberships don't apply.
--   * Members can no longer edit their own role (or anything but their name
--     and message) directly: roles change only through checked functions.

-- ---------------------------------------------------------------------------
-- Ministry roles
-- ---------------------------------------------------------------------------
alter table users drop constraint if exists users_role_check;
update users set role = 'leader' where role = 'leadership';
update users set role = 'admin' where role = 'platform_admin';
alter table users add constraint users_role_check check (role in ('admin', 'leader', 'member'));

-- A membership per ministry: the same login can be in several.
alter table users drop constraint if exists users_auth_uid_key;
create unique index if not exists users_org_auth_uid_key on users (org_id, auth_uid)
  where auth_uid is not null;

-- Direct edits: only your own name and message. Everything else goes through
-- functions that check who you are (roles, activation, flows, invitations).
revoke update on users from authenticated, anon;
grant update (name, short_message) on users to authenticated;
drop policy if exists users_update_by_leadership on users;

-- ---------------------------------------------------------------------------
-- Which membership applies to this request
-- ---------------------------------------------------------------------------
-- The host of the page making the request, or null (server calls, tests).
create or replace function private.request_host()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare v_origin text;
begin
  begin
    v_origin := current_setting('request.headers', true)::json ->> 'origin';
  exception when others then
    return null;
  end;
  if v_origin is null then return null; end if;
  return lower(split_part(regexp_replace(v_origin, '^[a-z]+://', ''), '/', 1));
end;
$$;

-- My membership here: in the ministry of this address; none on ekkle.org (or
-- any address that isn't a ministry's). With no address at all (server-side
-- calls) — the only membership, as before.
create or replace function private.my_membership()
returns users
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_host text := private.request_host();
  v_org uuid;
  v_user users;
begin
  if auth.uid() is null then return null; end if;
  if v_host is null then
    select * into v_user from users where auth_uid = auth.uid()
      order by created_at limit 1;
    return v_user;
  end if;
  v_org := account_for_host(v_host);
  if v_org is null then return null; end if;
  select * into v_user from users where auth_uid = auth.uid() and org_id = v_org;
  return v_user;
end;
$$;
revoke execute on function private.my_membership() from public;

create or replace function app_user_id()
returns uuid language sql stable security definer set search_path = public
as $$ select (private.my_membership()).id; $$;

create or replace function app_user_org()
returns uuid language sql stable security definer set search_path = public
as $$ select (private.my_membership()).org_id; $$;

-- Admin or Leader of this ministry (active).
create or replace function is_leadership()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select m.role in ('admin', 'leader') and m.active
                   from private.my_membership() m where m.id is not null), false);
$$;

-- Admin of this ministry (active).
create or replace function is_account_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select m.role = 'admin' and m.active
                   from private.my_membership() m where m.id is not null), false);
$$;
grant execute on function is_account_admin() to authenticated;

-- For the app: my membership on this address (or nothing).
create or replace function public.my_membership()
returns users language sql stable security definer set search_path = public
as $$ select m.* from private.my_membership() m where m.id is not null; $$;
revoke execute on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- ---------------------------------------------------------------------------
-- The platform team
-- ---------------------------------------------------------------------------
create table if not exists platform_team (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  auth_uid    uuid unique references auth.users (id) on delete set null,
  name        text,
  role        text not null check (role in ('owner', 'admin', 'support')),
  invited_by  uuid references platform_team (id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists platform_team_email_key on platform_team (lower(email));
alter table platform_team enable row level security;
-- No direct access; everything through the functions below.
revoke all on platform_team from anon, authenticated;

-- My platform role: by login, or by a verified email that was invited.
create or replace function platform_role()
returns text language sql stable security definer set search_path = public
as $$
  select role from platform_team
  where auth_uid = auth.uid()
     or (auth_uid is null and lower(email) = lower(auth_email()))
  order by auth_uid nulls last
  limit 1;
$$;

-- Owner or Admin of the platform. (Retires the old in-ministry meaning.)
create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(platform_role() in ('owner', 'admin'), false); $$;

create or replace function is_platform_member()
returns boolean language sql stable security definer set search_path = public
as $$ select platform_role() is not null; $$;

-- Signing in on ekkle.org: link an invitation to this login; returns my role.
create or replace function claim_platform_seat()
returns text language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return null; end if;
  update platform_team set auth_uid = auth.uid()
   where auth_uid is null and lower(email) = lower(auth_email())
     and not exists (select 1 from platform_team where auth_uid = auth.uid());
  return platform_role();
end;
$$;
revoke execute on function claim_platform_seat() from public, anon;
grant execute on function claim_platform_seat() to authenticated;
revoke execute on function platform_role() from public, anon;
grant execute on function platform_role() to authenticated;

-- The founder: platform Owner (jonathan@proprly.io); his personal ministry
-- stays under his existing login as its Admin (converted above).
insert into platform_team (email, name, role)
values ('jonathan@proprly.io', 'Jonathan', 'owner')
on conflict ((lower(email))) do nothing;

-- Platform: every ministry account, metadata only (docs: never message
-- contents, never seekers' names or emails).
create or replace function platform_accounts()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', o.name, 'subdomain', o.subdomain, 'kind', o.kind,
      'custom_domain', o.custom_domain, 'created_at', o.created_at,
      'team', (select count(*) from users u where u.org_id = o.id and u.active),
      'admins', (select count(*) from users u where u.org_id = o.id and u.active and u.role = 'admin'),
      'seekers', (select count(*) from recipients r where r.org_id = o.id and r.deleted_at is null),
      'studies_started', (select count(*) from sequence_events e where e.org_id = o.id and e.event = 'started'),
      'conversations', (select count(*) from conversations c where c.org_id = o.id),
      'connections', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id
                       where u.org_id = o.id and cc.connected = 'yes')
    ) order by o.created_at)
    from organizations o
  ), '[]'::jsonb);
end;
$$;
revoke execute on function platform_accounts() from public, anon;
grant execute on function platform_accounts() to authenticated;

-- ---------------------------------------------------------------------------
-- Ministry functions, re-checked for the new roles and per-ministry scope
-- ---------------------------------------------------------------------------

-- The ministry overview (was the platform console's): Admins and Leaders.
create or replace function platform_overview()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_org uuid;
  v_result jsonb;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  v_org := app_user_org();
  select jsonb_build_object(
    'started', (select count(*) from sequence_events where org_id = v_org and event = 'started'),
    'completed', (select count(*) from sequence_events where org_id = v_org and event = 'completed'),
    'messaged', (select count(*) from sequence_events where org_id = v_org and event = 'messaged'),
    'conversations', (select count(*) from conversations where org_id = v_org),
    'active_conversations', (select count(*) from conversations where org_id = v_org and status = 'active'),
    'recipients', (select count(*) from recipients where org_id = v_org and deleted_at is null),
    'checkins', jsonb_build_object(
      'yes', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id where u.org_id = v_org and cc.connected = 'yes'),
      'not_yet', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id where u.org_id = v_org and cc.connected = 'not_yet'),
      'no', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id where u.org_id = v_org and cc.connected = 'no')
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', u.name,
        'code_slug', u.code_slug,
        'started', (select count(*) from sequence_events e where e.member_id = u.id and e.event = 'started'),
        'messaged', (select count(*) from sequence_events e where e.member_id = u.id and e.event = 'messaged'),
        'conversations', (select count(*) from conversations c where c.member_id = u.id)
      ) order by u.created_at asc)
      from users u where u.org_id = v_org and u.active = true
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Ministry settings (name, designated responder, offer page): Admins.
create or replace function set_org_settings(
  p_name text, p_default_member_id uuid, p_offer_enabled boolean
)
returns organizations language plpgsql security definer set search_path = public
as $$
declare v_org organizations;
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  if p_default_member_id is not null and not exists (
    select 1 from users where id = p_default_member_id and org_id = app_user_org()
  ) then raise exception 'forbidden'; end if;
  update organizations set
    name = coalesce(nullif(trim(p_name), ''), name),
    default_member_id = p_default_member_id,
    offer_enabled = coalesce(p_offer_enabled, offer_enabled)
  where id = app_user_org()
  returning * into v_org;
  return v_org;
end;
$$;

create or replace function regenerate_join_code()
returns text language plpgsql security definer set search_path = public
as $$
declare v_code text;
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') for 6));
  update organizations set join_code = v_code where id = app_user_org();
  return v_code;
end;
$$;

-- Branding: Admins (was Admins + Leaders).
create or replace function public.set_account_branding(
  p_name text, p_accent_color text, p_logo_path text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid := app_user_org();
  v_accent text := nullif(lower(trim(p_accent_color)), '');
  v_row organizations;
begin
  if v_org is null or not is_account_admin() then raise exception 'forbidden'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'name_required'; end if;
  if v_accent is not null and (v_accent !~ '^#[0-9a-f]{6}$'
                               or accent_contrast_on_page(v_accent) < 4.5) then
    raise exception 'accent_unreadable';
  end if;
  if p_logo_path is not null and p_logo_path not like v_org::text || '/%' then
    raise exception 'forbidden';
  end if;
  update organizations set name = trim(p_name), accent_color = v_accent, logo_path = p_logo_path
  where id = v_org returning * into v_row;
  return private.account_json(v_row);
end;
$$;

-- Logos: Admins only (was Admins + Leaders).
drop policy if exists "branding: leaders upload" on storage.objects;
drop policy if exists "branding: leaders replace" on storage.objects;
drop policy if exists "branding: leaders remove" on storage.objects;
create policy "branding: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and public.is_account_admin()
              and (storage.foldername(name))[1] = public.app_user_org()::text);
create policy "branding: admins replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and public.is_account_admin()
         and (storage.foldername(name))[1] = public.app_user_org()::text);
create policy "branding: admins remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and public.is_account_admin()
         and (storage.foldername(name))[1] = public.app_user_org()::text);

-- The team list: Admins and Leaders see everyone in their ministry; everyone
-- sees their own membership.
drop policy if exists users_select_same_org on users;
create policy users_select_team on users
  for select to authenticated
  using (auth_uid = auth.uid() or (org_id = app_user_org() and is_leadership()));

-- Joining (at first sign-in on a ministry's address): an invitation for this
-- email in this ministry, else the ministry's join code. Members only.
create or replace function claim_membership(p_join_code text, p_name text)
returns users language plpgsql security definer set search_path = public
as $$
declare
  v_email text := auth_email();
  v_host_org uuid := request_account();
  v_org uuid;
  v_user users;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Already a member here? (idempotent)
  select * into v_user from users
   where auth_uid = auth.uid() and (v_host_org is null or org_id = v_host_org)
   order by created_at limit 1;
  if found then return v_user; end if;

  -- An invitation for this email (in this ministry).
  update users set auth_uid = auth.uid()
   where id = (select id from users
                where auth_uid is null and v_email is not null
                  and lower(email) = lower(v_email)
                  and (v_host_org is null or org_id = v_host_org)
                order by created_at limit 1)
   returning * into v_user;
  if found then return v_user; end if;

  -- The join code (it must be this ministry's, when on its address).
  select id into v_org from organizations
   where join_code = upper(trim(p_join_code)) and (v_host_org is null or id = v_host_org)
   limit 1;
  if v_org is null then raise exception 'invalid_join_code'; end if;

  insert into users (org_id, auth_uid, name, role, code_slug, email)
  values (v_org, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Friend'),
          'member', generate_member_slug(p_name), v_email)
  returning * into v_user;
  return v_user;
end;
$$;

-- Invitations: Admins and Leaders invite Members (roles for Leaders/Admins
-- arrive with the team tools, slice 3).
create or replace function invite_member(p_name text, p_email text)
returns users language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid := app_user_org();
  v_user users;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email_required'; end if;
  insert into users (org_id, name, role, code_slug, email)
  values (v_org, coalesce(nullif(trim(p_name), ''), 'Friend'),
          'member', generate_member_slug(p_name), lower(trim(p_email)))
  returning * into v_user;
  return v_user;
end;
$$;

-- Activation: Leaders manage Members; Admins manage anyone; a ministry always
-- keeps at least one active Admin.
create or replace function set_member_active(p_user_id uuid, p_active boolean)
returns users language plpgsql security definer set search_path = public
as $$
declare
  v_target users;
  v_user users;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into v_target from users where id = p_user_id and org_id = app_user_org();
  if not found then raise exception 'member_not_found'; end if;
  if v_target.role <> 'member' and not is_account_admin() then raise exception 'forbidden'; end if;
  if not p_active and v_target.role = 'admin' and v_target.active and not exists (
    select 1 from users where org_id = v_target.org_id and role = 'admin' and active and id <> v_target.id
  ) then raise exception 'last_admin'; end if;
  update users set active = p_active where id = v_target.id returning * into v_user;
  return v_user;
end;
$$;

-- A member's active flow: their membership here.
create or replace function set_my_active_sequence(p_sequence_id uuid)
returns users language plpgsql security definer set search_path = public
as $$
declare v_user users;
begin
  v_user := private.my_membership();
  if v_user.id is null then raise exception 'not_a_member'; end if;
  if p_sequence_id is not null and not exists (
    select 1 from sequences
     where id = p_sequence_id and org_id = v_user.org_id and status = 'approved'
  ) then raise exception 'invalid_sequence'; end if;
  update users set active_sequence_id = p_sequence_id where id = v_user.id returning * into v_user;
  return v_user;
end;
$$;
