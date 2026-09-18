-- Platform admin: a super-role above per-church leadership.
--
-- In v1 (single church) a platform admin behaves as leadership + everything —
-- it exists from the start so the founder account has full permissions, and so
-- multi-tenant later has a natural cross-org owner without a reshape.
--
-- is_leadership() now returns true for platform_admin too, so every existing
-- leadership policy/RPC covers admins with no further changes.

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('member', 'leadership', 'platform_admin'));

create or replace function is_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('leadership', 'platform_admin')
       from users where auth_uid = auth.uid() limit 1),
    false
  );
$$;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'platform_admin' from users where auth_uid = auth.uid() limit 1),
    false
  );
$$;

-- Provision the founder as platform admin. No auth_uid yet — it links to the
-- Supabase auth account on first magic-link sign-in (email match).
insert into users (id, org_id, name, role, code_slug, email, short_message)
values (
  '00000000-0000-0000-0000-0000000000b0',
  '00000000-0000-0000-0000-0000000000a1',
  'Jonathan',
  'platform_admin',
  'jonathan',
  'jwoodhall24@gmail.com',
  'Would love to talk whenever you’re ready.'
) on conflict (id) do nothing;
