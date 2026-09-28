-- 0027 — The Ekklē team signs in with a password (docs/accounts-and-roles.md).
-- The first sign-in on ekkle.org is by emailed code; right after, a team
-- member sets a password before reaching the console. password_set records
-- that they've done it (Supabase doesn't expose whether a login has one).

alter table platform_team add column if not exists password_set boolean not null default false;

-- My seat on the Ekklē team (claiming an invitation for this login): role and
-- whether a password has been set yet; null if not on the team.
drop function if exists claim_platform_seat();
create function claim_platform_seat()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_seat platform_team;
begin
  if auth.uid() is null then return null; end if;
  update platform_team set auth_uid = auth.uid()
   where auth_uid is null and lower(email) = lower(auth_email())
     and not exists (select 1 from platform_team where auth_uid = auth.uid());
  select * into v_seat from platform_team where auth_uid = auth.uid();
  if v_seat.id is null then return null; end if;
  return jsonb_build_object('role', v_seat.role, 'password_set', v_seat.password_set);
end;
$$;
revoke execute on function claim_platform_seat() from public, anon;
grant execute on function claim_platform_seat() to authenticated;

-- After the app has set the password on the login.
create or replace function platform_password_saved()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update platform_team set password_set = true where auth_uid = auth.uid();
end;
$$;
revoke execute on function platform_password_saved() from public, anon;
grant execute on function platform_password_saved() to authenticated;
