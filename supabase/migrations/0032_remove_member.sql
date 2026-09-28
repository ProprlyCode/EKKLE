-- 0032 — Remove someone from a ministry's team.
--
-- Deleting their row would delete their conversations with seekers (they
-- cascade), so removing is a retirement: they lose access (the login is
-- unlinked), their share link stops working, and they leave the team list.
-- Their conversations are handed to a teammate the remover chooses (required
-- when they have any). An invitation nobody has accepted is simply deleted.
--
-- Who may: Leaders remove Members; Admins remove anyone but themselves; a
-- ministry always keeps an active Admin.

alter table users add column if not exists removed_at timestamptz;

-- How many conversations someone has (for "hand them to…").
create or replace function member_conversation_count(p_user_id uuid)
returns int language sql stable security definer set search_path = public
as $$
  select case when is_leadership() then
    (select count(*)::int from conversations c join users u on u.id = c.member_id
      where c.member_id = p_user_id and u.org_id = app_user_org())
  end;
$$;

create or replace function remove_member(p_user_id uuid, p_hand_to uuid default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_target users;
  v_count int;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into v_target from users
   where id = p_user_id and org_id = app_user_org() and removed_at is null;
  if not found then raise exception 'member_not_found'; end if;
  if v_target.id = app_user_id() then raise exception 'forbidden'; end if;
  if v_target.role <> 'member' and not is_account_admin() then raise exception 'forbidden'; end if;
  if v_target.role = 'admin' and v_target.active and v_target.auth_uid is not null and not exists (
    select 1 from users where org_id = v_target.org_id and role = 'admin' and active
      and auth_uid is not null and removed_at is null and id <> v_target.id
  ) then raise exception 'last_admin'; end if;

  select count(*) into v_count from conversations where member_id = v_target.id;

  -- Nobody joined yet and nothing to keep: just delete the invitation.
  if v_target.auth_uid is null and v_count = 0 then
    update organizations set default_member_id = null where default_member_id = v_target.id;
    delete from users where id = v_target.id;
    return;
  end if;

  if v_count > 0 then
    if p_hand_to is null then raise exception 'has_conversations'; end if;
    if not exists (select 1 from users where id = p_hand_to and org_id = v_target.org_id
                    and active and auth_uid is not null and removed_at is null
                    and id <> v_target.id) then
      raise exception 'invalid_hand_to';
    end if;
    -- (One conversation per member and seeker: if the teammate already talks
    -- with the same seeker, that thread stays with the removed member.)
    update conversations c set member_id = p_hand_to
     where c.member_id = v_target.id
       and not exists (select 1 from conversations d
                        where d.member_id = p_hand_to and d.recipient_id = c.recipient_id);
  end if;

  update organizations set default_member_id = null where default_member_id = v_target.id;
  update users set removed_at = now(), active = false, auth_uid = null, email = null, role = 'member'
   where id = v_target.id;
end;
$$;

revoke execute on function member_conversation_count(uuid) from public, anon;
revoke execute on function remove_member(uuid, uuid) from public, anon;
grant execute on function member_conversation_count(uuid) to authenticated;
grant execute on function remove_member(uuid, uuid) to authenticated;
