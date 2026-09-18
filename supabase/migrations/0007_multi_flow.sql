-- Multiple invitation flows per church; each member picks an active one.
--
-- Admins already can CRUD sequences via RLS. This adds:
--  * users.active_sequence_id — the flow that rides a member's QR
--  * resolution: the member's chosen flow if it's approved, else the org's
--    first approved flow (so it always "just works")
--  * a validated RPC for a member to set their active flow.
-- get_recipient_landing / log_sequence_event are replaced to use this resolution.

alter table users
  add column if not exists active_sequence_id uuid references sequences (id) on delete set null;

-- Resolve which sequence a member's link should show.
create or replace function member_active_sequence_id(p_member users)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.id from sequences s
      where s.id = p_member.active_sequence_id
        and s.org_id = p_member.org_id
        and s.status = 'approved'),
    (select s.id from sequences s
      where s.org_id = p_member.org_id and s.status = 'approved'
      order by s.created_at asc limit 1)
  );
$$;

-- A member sets (or clears) their active flow. Must be an approved flow in
-- their own org.
create or replace function set_my_active_sequence(p_sequence_id uuid)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
begin
  select * into v_user from users where auth_uid = auth.uid() limit 1;
  if not found then raise exception 'not_a_member'; end if;

  if p_sequence_id is not null then
    if not exists (
      select 1 from sequences
      where id = p_sequence_id and org_id = v_user.org_id and status = 'approved'
    ) then
      raise exception 'invalid_sequence';
    end if;
  end if;

  update users set active_sequence_id = p_sequence_id
   where id = v_user.id returning * into v_user;
  return v_user;
end;
$$;

grant execute on function set_my_active_sequence(uuid) to authenticated;

-- Landing now resolves the member's active flow.
create or replace function get_recipient_landing(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member users;
  v_seq_id uuid;
  v_title text;
  v_result jsonb;
begin
  select * into v_member from users where code_slug = p_slug and active = true limit 1;
  if not found then return null; end if;

  v_seq_id := member_active_sequence_id(v_member);
  if v_seq_id is null then return null; end if;

  select title into v_title from sequences where id = v_seq_id;

  select jsonb_build_object(
    'member', jsonb_build_object('name', v_member.name, 'short_message', v_member.short_message),
    'sequence', jsonb_build_object('id', v_seq_id, 'title', v_title),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('headline', s.headline, 'body', s.body, 'icon', s.icon)
        order by s.sort_order)
      from sequence_screens s where s.sequence_id = v_seq_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function log_sequence_event(p_session_token text, p_slug text, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member users;
  v_seq_id uuid;
begin
  if p_event not in ('started', 'completed', 'messaged') then
    raise exception 'invalid_event';
  end if;
  select * into v_member from users where code_slug = p_slug and active = true limit 1;
  if not found then return; end if;

  v_seq_id := member_active_sequence_id(v_member);

  insert into sequence_events (org_id, member_id, session_token, sequence_id, event)
  values (v_member.org_id, v_member.id, p_session_token, v_seq_id, p_event);
end;
$$;
