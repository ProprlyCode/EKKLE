-- Sprint 5: safeguarding + connection check-in.
--
-- Actions the member (and, for erasure, leadership) can take on a conversation,
-- plus the one-tap "did you connect?" self-report. All SECURITY DEFINER and
-- guarded so a member only touches their own conversations. Leader visibility
-- of reports rides the existing reports_select_leadership RLS policy.

-- Everything the member thread needs about a conversation, in one guarded call:
-- the recipient's name, status, and the member's last check-in answer.
create or replace function conversation_meta(p_conversation_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_convo conversations; v_rec recipients; v_last text;
begin
  select * into v_convo from conversations where id = p_conversation_id limit 1;
  if not found then return null; end if;
  if v_convo.member_id <> app_user_id()
     and not (is_leadership() and v_convo.org_id = app_user_org()) then
    raise exception 'forbidden';
  end if;

  select * into v_rec from recipients where id = v_convo.recipient_id limit 1;

  select connected into v_last from connection_checkins
   where member_id = v_convo.member_id and recipient_id = v_convo.recipient_id
   order by created_at desc limit 1;

  return jsonb_build_object(
    'recipient_first_name', coalesce(v_rec.first_name, 'Someone'),
    'status', v_convo.status,
    'erased', v_rec.deleted_at is not null,
    'last_checkin', v_last
  );
end;
$$;
grant execute on function conversation_meta(uuid) to authenticated;

-- Member blocks + reports a conversation. Flips it to blocked (both sides can no
-- longer post) and records the report for leadership visibility.
create or replace function report_conversation(p_conversation_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_convo conversations;
begin
  select * into v_convo from conversations where id = p_conversation_id limit 1;
  if not found then raise exception 'not_found'; end if;
  if v_convo.member_id <> app_user_id() then raise exception 'forbidden'; end if;

  insert into reports (conversation_id, reporter_type, reason)
  values (p_conversation_id, 'member', coalesce(trim(p_reason), ''));
  update conversations set status = 'blocked' where id = p_conversation_id;
end;
$$;
grant execute on function report_conversation(uuid, text) to authenticated;

-- Erase a recipient's data on request: soft-delete the recipient and hard-delete
-- their messages. The member who holds the conversation, or org leadership, may
-- do this. Deleted recipients drop out of every read (my_conversations filters
-- deleted_at); their conversations block so nothing new can be sent.
create or replace function erase_conversation(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_convo conversations;
begin
  select * into v_convo from conversations where id = p_conversation_id limit 1;
  if not found then raise exception 'not_found'; end if;
  if v_convo.member_id <> app_user_id()
     and not (is_leadership() and v_convo.org_id = app_user_org()) then
    raise exception 'forbidden';
  end if;

  -- Redact message contents across all of this recipient's conversations.
  delete from messages m using conversations c
   where m.conversation_id = c.id and c.recipient_id = v_convo.recipient_id;
  update conversations set status = 'blocked' where recipient_id = v_convo.recipient_id;
  update recipients set deleted_at = now(), email = null, first_name = ''
   where id = v_convo.recipient_id;
end;
$$;
grant execute on function erase_conversation(uuid) to authenticated;

-- One-tap connection check-in ("Did you connect with <name>?").
create or replace function record_checkin(p_conversation_id uuid, p_value text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_convo conversations;
begin
  if p_value not in ('yes', 'not_yet', 'no') then raise exception 'bad_value'; end if;
  select * into v_convo from conversations where id = p_conversation_id limit 1;
  if not found then raise exception 'not_found'; end if;
  if v_convo.member_id <> app_user_id() then raise exception 'forbidden'; end if;

  insert into connection_checkins (member_id, recipient_id, connected)
  values (v_convo.member_id, v_convo.recipient_id, p_value);
end;
$$;
grant execute on function record_checkin(uuid, text) to authenticated;

-- Seeker blocks their own conversation (writes a recipient report + blocks it).
create or replace function seeker_block_conversation(p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_rec recipients; v_convo conversations;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then raise exception 'no_account'; end if;
  select * into v_convo from conversations where recipient_id = v_rec.id limit 1;
  if not found then return; end if;

  insert into reports (conversation_id, reporter_type, reason)
  values (v_convo.id, 'recipient', coalesce(trim(p_reason), ''));
  update conversations set status = 'blocked' where id = v_convo.id;
end;
$$;
grant execute on function seeker_block_conversation(text) to authenticated;
