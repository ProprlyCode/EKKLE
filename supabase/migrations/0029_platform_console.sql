-- 0029 — The platform console (docs/accounts-and-roles.md, slice 2):
-- create ministry accounts (with their first Admin invited), suspend them,
-- manage the Ekklē team, and read the waitlist.
--
-- Permissions (platform): everyone on the team sees accounts, team and
-- waitlist; Owners and Admins create and suspend accounts; only Owners manage
-- the team, and there is always at least one Owner.

-- ---------------------------------------------------------------------------
-- Suspended accounts
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended'));

-- A suspended account is offline: its address resolves to no account for
-- every lookup and every membership (so nothing works there), while the app
-- can still tell visitors it's paused (resolve_account below).
create or replace function public.account_for_host(p_host text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with h as (select lower(split_part(trim(coalesce(p_host, '')), ':', 1)) as host)
  select o.id
  from organizations o, h
  where o.status = 'active'
    and ((o.custom_domain is not null and lower(o.custom_domain) = h.host)
     or o.subdomain = case
          when h.host ~ '^[a-z0-9-]+\.(staging\.)?ekkle\.org$' then split_part(h.host, '.', 1)
          when h.host ~ '^[a-z0-9-]+\.localhost$' then split_part(h.host, '.', 1)
        end)
  limit 1;
$$;

create or replace function private.account_json(o organizations)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'name', o.name, 'subdomain', o.subdomain,
                            'custom_domain', o.custom_domain, 'kind', o.kind,
                            'accent_color', o.accent_color, 'logo_path', o.logo_path,
                            'status', o.status);
$$;

-- The app's lookup: includes suspended accounts (status says so), so the
-- address can show "paused" rather than "not set up".
create or replace function public.resolve_account(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with h as (select lower(split_part(trim(coalesce(p_host, '')), ':', 1)) as host)
  select private.account_json(o)
  from organizations o, h
  where (o.custom_domain is not null and lower(o.custom_domain) = h.host)
     or o.subdomain = case
          when h.host ~ '^[a-z0-9-]+\.(staging\.)?ekkle\.org$' then split_part(h.host, '.', 1)
          when h.host ~ '^[a-z0-9-]+\.localhost$' then split_part(h.host, '.', 1)
        end
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- Every ministry, metadata only; now with status and pending first-admin
-- invitations.
create or replace function platform_accounts()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', o.name, 'subdomain', o.subdomain, 'kind', o.kind,
      'custom_domain', o.custom_domain, 'status', o.status, 'created_at', o.created_at,
      'team', (select count(*) from users u where u.org_id = o.id and u.active and u.auth_uid is not null),
      'admins', (select count(*) from users u where u.org_id = o.id and u.active and u.role = 'admin' and u.auth_uid is not null),
      'invited_admins', coalesce((select jsonb_agg(u.email order by u.created_at) from users u
                          where u.org_id = o.id and u.role = 'admin' and u.auth_uid is null and u.email is not null), '[]'::jsonb),
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

-- Is this address free? (For the create form, as the name is typed.)
create or replace function platform_subdomain_available(p_subdomain text)
returns boolean language sql stable security definer set search_path = public
as $$
  select is_platform_member()
     and lower(trim(p_subdomain)) ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
     and lower(trim(p_subdomain)) not in ('www', 'app', 'api', 'admin', 'staging', 'platform', 'mail',
                                          'email', 'ekkle', 'static', 'assets', 'help', 'support', 'status')
     and not exists (select 1 from organizations where subdomain = lower(trim(p_subdomain)));
$$;

-- Create a ministry account: its address, a starter welcome flow (the
-- standard four screens, approved, editable by its leaders), and its first
-- Admin as an invitation (linked when they first sign in with that email).
create or replace function platform_create_account(
  p_name text, p_kind text, p_subdomain text, p_admin_name text, p_admin_email text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_sub text := lower(trim(p_subdomain));
  v_email text := lower(trim(p_admin_email));
  v_org organizations;
  v_seq uuid;
  v_code text;
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'name_required'; end if;
  if p_kind not in ('church', 'personal_ministry') then raise exception 'invalid_kind'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from organizations where subdomain = v_sub or slug = v_sub) then
    raise exception 'address_taken';
  end if;

  loop
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') for 6));
    exit when not exists (select 1 from organizations where join_code = v_code);
  end loop;

  insert into organizations (slug, name, join_code, subdomain, kind)
  values (v_sub, trim(p_name), v_code, v_sub, p_kind)
  returning * into v_org; -- the subdomain format/reserved check applies here

  insert into sequences (org_id, title, type, status)
  values (v_org.id, 'A gentle introduction', 'gospel', 'approved')
  returning id into v_seq;
  insert into sequence_screens (sequence_id, sort_order, headline, body) values
    (v_seq, 0, 'life carries a lot',
     'Fear, stress, the weight of not knowing how things will turn out — most of us carry more than we say out loud. Before anything else: that''s worth taking seriously.'),
    (v_seq, 1, 'you''re not the only one who''s felt it',
     'Jesus wasn''t distant from any of this. He knew exhaustion, grief, being let down by people close to him. Whatever you''re carrying, he''s been near it himself.'),
    (v_seq, 2, 'this is an invitation, not a pitch',
     'At the center of it is something simpler than a set of beliefs: the chance to actually know him — personally, honestly, as you are right now.'),
    (v_seq, 3, 'someone here would love to talk',
     'This was shared with you because they''d genuinely welcome a conversation — no pressure, no script. Or you can sit with it a while. Both are okay.');

  insert into users (org_id, name, role, code_slug, email)
  values (v_org.id, coalesce(nullif(trim(p_admin_name), ''), 'Admin'), 'admin',
          generate_member_slug(coalesce(nullif(trim(p_admin_name), ''), 'admin')), v_email);

  return private.account_json(v_org);
exception
  when check_violation then raise exception 'invalid_address';
  when unique_violation then raise exception 'address_taken';
end;
$$;

create or replace function platform_set_account_status(p_org_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status'; end if;
  update organizations set status = p_status where id = p_org_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The Ekklē team
-- ---------------------------------------------------------------------------
create or replace function platform_team_list()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'email', t.email, 'name', t.name, 'role', t.role,
      'joined', t.auth_uid is not null, 'me', t.auth_uid = auth.uid(),
      'created_at', t.created_at
    ) order by t.created_at)
    from platform_team t
  ), '[]'::jsonb);
end;
$$;

create or replace function platform_invite_member(p_email text, p_name text, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_email text := lower(trim(p_email));
begin
  if platform_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('owner', 'admin', 'support') then raise exception 'invalid_role'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from platform_team where lower(email) = v_email) then
    raise exception 'already_on_team';
  end if;
  insert into platform_team (email, name, role, invited_by)
  values (v_email, nullif(trim(p_name), ''), p_role,
          (select id from platform_team where auth_uid = auth.uid()));
end;
$$;

-- Owners change roles and remove people; the team always keeps an Owner.
create or replace function platform_set_member_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if platform_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if p_role not in ('owner', 'admin', 'support') then raise exception 'invalid_role'; end if;
  if p_role <> 'owner' and (select role from platform_team where id = p_id) = 'owner'
     and (select count(*) from platform_team where role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;
  update platform_team set role = p_role where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

create or replace function platform_remove_member(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if platform_role() is distinct from 'owner' then raise exception 'forbidden'; end if;
  if (select role from platform_team where id = p_id) = 'owner'
     and (select count(*) from platform_team where role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;
  delete from platform_team where id = p_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The waitlist (ekkle.org's "Join the waitlist")
-- ---------------------------------------------------------------------------
create or replace function platform_waitlist()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id, 'name', w.name, 'email', w.email, 'ministry_name', w.ministry_name,
      'created_at', w.created_at
    ) order by w.created_at desc)
    from waitlist w
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- For the sign-in email hook: is this an invitation?
-- ---------------------------------------------------------------------------
-- Pending invitation for this email: to a ministry (its id), or to the Ekklē
-- team (p_org null). Service role only (the hook).
create or replace function private.pending_invitation(p_email text, p_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when p_org is null then exists (
      select 1 from platform_team where lower(email) = lower(p_email) and auth_uid is null)
    else exists (
      select 1 from users where org_id = p_org and lower(email) = lower(p_email) and auth_uid is null)
  end;
$$;
create or replace function public.auth_email_is_invitation(p_email text, p_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select private.pending_invitation(p_email, p_org); $$;
revoke execute on function public.auth_email_is_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.auth_email_is_invitation(text, uuid) to service_role;

-- Grants
do $$
declare f text;
begin
  foreach f in array array[
    'platform_subdomain_available(text)',
    'platform_create_account(text, text, text, text, text)',
    'platform_set_account_status(uuid, text)',
    'platform_team_list()',
    'platform_invite_member(text, text, text)',
    'platform_set_member_role(uuid, text)',
    'platform_remove_member(uuid)',
    'platform_waitlist()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
