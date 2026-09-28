-- 0028 — Platform → Settings: a team member's own name and password.
-- claim_platform_seat() also returns their email and name for the page.

create or replace function claim_platform_seat()
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
  return jsonb_build_object('role', v_seat.role, 'password_set', v_seat.password_set,
                            'email', v_seat.email, 'name', v_seat.name);
end;
$$;

create or replace function set_my_platform_name(p_name text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  update platform_team set name = nullif(trim(p_name), '') where auth_uid = auth.uid();
end;
$$;
revoke execute on function set_my_platform_name(text) from public, anon;
grant execute on function set_my_platform_name(text) to authenticated;
