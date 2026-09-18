-- Sprint 2: membership onboarding.
--
-- Two ways a church-side account comes to exist:
--   1. Leader invite  — leadership pre-creates a users row carrying an email;
--      at first magic-link sign-in the row is linked to the auth account.
--   2. Join code      — a person signs in, then claims membership with the org's
--      shared join_code + a display name; a fresh member row is created.
--
-- All of this runs through SECURITY DEFINER RPCs so we never open broad
-- insert/update table access. `email` is added to users purely for invite
-- matching (auth.users still owns the real credential).

alter table users add column if not exists email text;
create index if not exists users_email_idx on users (lower(email));

-- Slugify a display name into a unique, readable code_slug within an org.
create or replace function generate_member_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then base := 'friend'; end if;

  candidate := base;
  while exists (select 1 from users where code_slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

-- The signed-in auth email (helper).
create or replace function auth_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select email from auth.users where id = auth.uid();
$$;

-- Claim membership at first sign-in. Links an invite if one matches this email,
-- otherwise creates a member via the join code. Returns the users row.
create or replace function claim_membership(p_join_code text, p_name text)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth_email();
  v_org uuid;
  v_user users;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Already a member? Return the existing row (idempotent).
  select * into v_user from users where auth_uid = auth.uid() limit 1;
  if found then
    return v_user;
  end if;

  -- Invite path: an unlinked row with this email.
  update users
     set auth_uid = auth.uid()
   where auth_uid is null
     and v_email is not null
     and lower(email) = lower(v_email)
   returning * into v_user;
  if found then
    return v_user;
  end if;

  -- Join-code path.
  select id into v_org from organizations where join_code = p_join_code limit 1;
  if v_org is null then
    raise exception 'invalid_join_code';
  end if;

  insert into users (org_id, auth_uid, name, role, code_slug, email)
  values (v_org, auth.uid(), coalesce(nullif(trim(p_name), ''), 'Friend'),
          'member', generate_member_slug(p_name), v_email)
  returning * into v_user;

  return v_user;
end;
$$;

-- Leadership: pre-create an invited member (links on their first sign-in).
create or replace function invite_member(p_name text, p_email text)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := app_user_org();
  v_user users;
begin
  if not is_leadership() then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'email_required';
  end if;

  insert into users (org_id, name, role, code_slug, email)
  values (v_org, coalesce(nullif(trim(p_name), ''), 'Friend'),
          'member', generate_member_slug(p_name), lower(trim(p_email)))
  returning * into v_user;

  return v_user;
end;
$$;

-- Leadership: activate/deactivate a member (safety valve for self-signups).
create or replace function set_member_active(p_user_id uuid, p_active boolean)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
begin
  if not is_leadership() then
    raise exception 'forbidden';
  end if;

  update users set active = p_active
   where id = p_user_id and org_id = app_user_org()
   returning * into v_user;

  if not found then
    raise exception 'member_not_found';
  end if;
  return v_user;
end;
$$;
