-- 0030 — The ministry team (docs/accounts-and-roles.md, slice 3).
--
--   * Invitations carry a role: Leaders invite Members; Admins invite anyone.
--   * Admins change roles; a ministry always keeps an active Admin.
--   * Pending invitations can be cancelled (Leaders: Members'; Admins: any).
--   * The join code can be turned off by Admins (invitations still work).

alter table organizations add column if not exists join_enabled boolean not null default true;

-- Invite someone to this ministry by email, with a role.
drop function if exists invite_member(text, text);
create or replace function invite_member(p_name text, p_email text, p_role text default 'member')
returns users language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid := app_user_org();
  v_email text := lower(trim(p_email));
  v_user users;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'leader', 'member') then raise exception 'invalid_role'; end if;
  if p_role <> 'member' and not is_account_admin() then raise exception 'forbidden'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from users where org_id = v_org and lower(email) = v_email) then
    raise exception 'already_member';
  end if;
  insert into users (org_id, name, role, code_slug, email)
  values (v_org, coalesce(nullif(trim(p_name), ''), 'Friend'), p_role,
          generate_member_slug(coalesce(nullif(trim(p_name), ''), 'friend')), v_email)
  returning * into v_user;
  return v_user;
end;
$$;
revoke execute on function invite_member(text, text, text) from public, anon;
grant execute on function invite_member(text, text, text) to authenticated;

-- Admins: change someone's role (never leaving the ministry without an Admin).
create or replace function set_member_role(p_user_id uuid, p_role text)
returns users language plpgsql security definer set search_path = public
as $$
declare
  v_target users;
  v_user users;
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'leader', 'member') then raise exception 'invalid_role'; end if;
  select * into v_target from users where id = p_user_id and org_id = app_user_org();
  if not found then raise exception 'member_not_found'; end if;
  if v_target.role = 'admin' and p_role <> 'admin' and v_target.active and not exists (
    select 1 from users where org_id = v_target.org_id and role = 'admin' and active
      and auth_uid is not null and id <> v_target.id
  ) then raise exception 'last_admin'; end if;
  update users set role = p_role where id = v_target.id returning * into v_user;
  return v_user;
end;
$$;
revoke execute on function set_member_role(uuid, text) from public, anon;
grant execute on function set_member_role(uuid, text) to authenticated;

-- Cancel an invitation that hasn't been accepted yet.
create or replace function cancel_invitation(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_target users;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into v_target from users
   where id = p_user_id and org_id = app_user_org() and auth_uid is null;
  if not found then raise exception 'invitation_not_found'; end if;
  if v_target.role <> 'member' and not is_account_admin() then raise exception 'forbidden'; end if;
  delete from users where id = v_target.id;
end;
$$;
revoke execute on function cancel_invitation(uuid) from public, anon;
grant execute on function cancel_invitation(uuid) to authenticated;

-- Admins: turn the join code on or off.
create or replace function set_join_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  update organizations set join_enabled = coalesce(p_enabled, true) where id = app_user_org();
end;
$$;
revoke execute on function set_join_enabled(boolean) from public, anon;
grant execute on function set_join_enabled(boolean) to authenticated;

-- Joining: an invitation always works; the join code only while it's on.
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

  select * into v_user from users
   where auth_uid = auth.uid() and (v_host_org is null or org_id = v_host_org)
   order by created_at limit 1;
  if found then return v_user; end if;

  update users set auth_uid = auth.uid()
   where id = (select id from users
                where auth_uid is null and v_email is not null
                  and lower(email) = lower(v_email)
                  and (v_host_org is null or org_id = v_host_org)
                order by created_at limit 1)
   returning * into v_user;
  if found then return v_user; end if;

  select id into v_org from organizations
   where join_code = upper(trim(p_join_code)) and join_enabled
     and (v_host_org is null or id = v_host_org)
   limit 1;
  if v_org is null then raise exception 'invalid_join_code'; end if;

  insert into users (org_id, auth_uid, name, role, code_slug, email)
  values (v_org, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Friend'),
          'member', generate_member_slug(p_name), v_email)
  returning * into v_user;
  return v_user;
end;
$$;
