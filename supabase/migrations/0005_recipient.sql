-- Sprint 3: the anonymous recipient experience.
--
-- No login, no direct table access. Everything the recipient view does runs
-- through these SECURITY DEFINER RPCs, each scoped to the member resolved from
-- the /r/:slug handle. Execute is granted to the anon role explicitly.

-- Landing payload: the member's greeting + the org's approved sequence + screens.
-- Returns null when the slug is unknown/inactive or no approved sequence exists.
create or replace function get_recipient_landing(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member users;
  v_seq sequences;
  v_result jsonb;
begin
  select * into v_member
  from users
  where code_slug = p_slug and active = true
  limit 1;

  if not found then
    return null;
  end if;

  select * into v_seq
  from sequences
  where org_id = v_member.org_id and status = 'approved'
  order by created_at asc
  limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'member', jsonb_build_object('name', v_member.name, 'short_message', v_member.short_message),
    'sequence', jsonb_build_object('id', v_seq.id, 'title', v_seq.title),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'headline', s.headline, 'body', s.body, 'icon', s.icon
      ) order by s.sort_order)
      from sequence_screens s
      where s.sequence_id = v_seq.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Log a recipient telemetry event (started / completed / messaged) for a slug.
create or replace function log_sequence_event(
  p_session_token text, p_slug text, p_event text
)
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

  select id into v_seq_id from sequences
  where org_id = v_member.org_id and status = 'approved'
  order by created_at asc limit 1;

  insert into sequence_events (org_id, member_id, session_token, sequence_id, event)
  values (v_member.org_id, v_member.id, p_session_token, v_seq_id, p_event);
end;
$$;

-- The recipient chooses to message the member: create (or reuse) the recipient,
-- open the conversation, record consent + the first message, fire 'messaged'.
-- Returns the conversation id.
create or replace function start_conversation(
  p_session_token text,
  p_slug text,
  p_first_name text,
  p_email text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member users;
  v_recipient recipients;
  v_conversation_id uuid;
begin
  if coalesce(trim(p_body), '') = '' then
    raise exception 'empty_message';
  end if;

  select * into v_member from users where code_slug = p_slug and active = true limit 1;
  if not found then
    raise exception 'member_not_found';
  end if;

  -- Reuse the recipient for this device/session, else create one.
  select * into v_recipient from recipients
  where session_token = p_session_token and deleted_at is null limit 1;

  if not found then
    insert into recipients (org_id, first_name, email, session_token,
                            arrival_member_id, consented_at)
    values (v_member.org_id, coalesce(trim(p_first_name), ''),
            nullif(trim(p_email), ''), p_session_token, v_member.id, now())
    returning * into v_recipient;
  else
    update recipients
       set first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
           email = coalesce(nullif(trim(p_email), ''), email),
           consented_at = coalesce(consented_at, now())
     where id = v_recipient.id
     returning * into v_recipient;
  end if;

  -- One conversation per member+recipient.
  select id into v_conversation_id from conversations
  where member_id = v_member.id and recipient_id = v_recipient.id limit 1;

  if v_conversation_id is null then
    insert into conversations (org_id, member_id, recipient_id)
    values (v_member.org_id, v_member.id, v_recipient.id)
    returning id into v_conversation_id;
  end if;

  insert into messages (conversation_id, sender_type, body)
  values (v_conversation_id, 'recipient', trim(p_body));

  insert into sequence_events (org_id, member_id, recipient_id, session_token, event)
  values (v_member.org_id, v_member.id, v_recipient.id, p_session_token, 'messaged');

  return v_conversation_id;
end;
$$;

grant execute on function get_recipient_landing(text) to anon, authenticated;
grant execute on function log_sequence_event(text, text, text) to anon, authenticated;
grant execute on function start_conversation(text, text, text, text, text) to anon, authenticated;
