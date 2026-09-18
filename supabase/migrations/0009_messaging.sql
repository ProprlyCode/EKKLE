-- Sprint 4: 1:1 messaging (member inbox + recipient thread) and read-tracking.
--
-- Member side uses RLS-backed reads/writes + realtime. Recipient side (anon)
-- goes through SECURITY DEFINER RPCs keyed by session token, and polls.

alter table conversations
  add column if not exists member_last_read_at timestamptz;

-- Member inbox: one row per conversation with the recipient's name, the last
-- message, and whether there's something unread by the member.
create or replace function my_conversations()
returns table (
  conversation_id uuid,
  recipient_id uuid,
  recipient_first_name text,
  last_body text,
  last_at timestamptz,
  last_sender text,
  unread boolean,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.recipient_id,
    r.first_name,
    m.body,
    m.created_at,
    m.sender_type,
    (m.sender_type = 'recipient'
      and (c.member_last_read_at is null or m.created_at > c.member_last_read_at)) as unread,
    c.status
  from conversations c
  join recipients r on r.id = c.recipient_id and r.deleted_at is null
  left join lateral (
    select body, created_at, sender_type
    from messages where conversation_id = c.id
    order by created_at desc limit 1
  ) m on true
  where c.member_id = app_user_id()
  order by m.created_at desc nulls last;
$$;
grant execute on function my_conversations() to authenticated;

-- Recipient reads their own conversation (validated by session token).
create or replace function get_recipient_conversation(
  p_session_token text, p_conversation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member_name text;
  v_status text;
  v_ok boolean;
begin
  select (c.status), u.name into v_status, v_member_name
  from conversations c
  join users u on u.id = c.member_id
  join recipients r on r.id = c.recipient_id
  where c.id = p_conversation_id
    and r.session_token = p_session_token
    and r.deleted_at is null
  limit 1;

  if v_member_name is null then return null; end if;

  return jsonb_build_object(
    'member_name', v_member_name,
    'status', v_status,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sender_type', m.sender_type, 'body', m.body, 'created_at', m.created_at
      ) order by m.created_at asc)
      from messages m where m.conversation_id = p_conversation_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Recipient replies in their own conversation.
create or replace function send_recipient_message(
  p_session_token text, p_conversation_id uuid, p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;

  select c.status into v_status
  from conversations c
  join recipients r on r.id = c.recipient_id
  where c.id = p_conversation_id
    and r.session_token = p_session_token
    and r.deleted_at is null
  limit 1;

  if v_status is null then raise exception 'not_found'; end if;
  if v_status <> 'active' then raise exception 'conversation_closed'; end if;

  insert into messages (conversation_id, sender_type, body)
  values (p_conversation_id, 'recipient', trim(p_body));
end;
$$;

grant execute on function get_recipient_conversation(text, uuid) to anon, authenticated;
grant execute on function send_recipient_message(text, uuid, text) to anon, authenticated;

-- Live updates for the member side.
alter publication supabase_realtime add table messages;
