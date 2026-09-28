-- 0035 — Follow-through (roadmap N2).
--
--   * Nobody left waiting: when the last message in a conversation is from the
--     person exploring and nobody has replied, the member is emailed after 24
--     hours, and the ministry's Admins and Leaders get a metadata-only note
--     after 48 hours (never the message). A scheduled job (pg_cron, every 15
--     minutes) finds them and calls the `notify` function; each wait is nudged
--     once.
--   * Admins and Leaders can move one conversation to another member. The
--     history moves with it; the person exploring sees a quiet note in the
--     conversation ("You're now talking with …"), no email.
--   * Fixed with it: after a conversation moves (here, or when someone is
--     removed — 0032), Your space now finds the person's conversation by who
--     it's with now, not by the member whose link they first came through.

-- ---------------------------------------------------------------------------
-- Handoffs: the note shown in the conversation
-- ---------------------------------------------------------------------------
create table if not exists conversation_handoffs (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  from_name        text not null,
  to_member_id     uuid not null references users (id) on delete cascade,
  to_name          text not null,
  created_at       timestamptz not null default now()
);
create index if not exists conversation_handoffs_conversation_idx
  on conversation_handoffs (conversation_id, created_at);
alter table conversation_handoffs enable row level security;
revoke all on conversation_handoffs from anon;
grant select on conversation_handoffs to authenticated;
drop policy if exists conversation_handoffs_read on conversation_handoffs;
create policy conversation_handoffs_read on conversation_handoffs for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_handoffs.conversation_id
                  and (c.member_id = app_user_id() or (is_leadership() and c.org_id = app_user_org()))));

-- ---------------------------------------------------------------------------
-- Which member a person exploring is talking with
-- ---------------------------------------------------------------------------
-- Their conversation's member first (it may have moved), then the member whose
-- link they came through, then the designated responder, then anyone active.
create or replace function _seeker_member(v_rec recipients)
returns users
language sql stable security definer set search_path = public
as $$
  select u.* from users u
  where u.id = coalesce(
      (select c.member_id from conversations c where c.recipient_id = v_rec.id
        order by c.updated_at desc limit 1),
      v_rec.arrival_member_id,
      (select default_member_id from organizations where id = v_rec.org_id),
      (select id from users where org_id = v_rec.org_id and active = true
        order by created_at asc limit 1))
  limit 1;
$$;

-- The conversation for a person exploring, with the handoff notes in place.
create or replace function private.conversation_items(p_conversation_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(item order by at), '[]'::jsonb) from (
    select m.created_at as at, jsonb_build_object(
      'sender_type', m.sender_type, 'body', m.body, 'created_at', m.created_at) as item
    from messages m where m.conversation_id = p_conversation_id
    union all
    select h.created_at, jsonb_build_object(
      'sender_type', 'note', 'body', 'You’re now talking with ' || h.to_name || '.', 'created_at', h.created_at)
    from conversation_handoffs h where h.conversation_id = p_conversation_id
  ) x;
$$;
revoke execute on function private.conversation_items(uuid) from public;

create or replace function seeker_connection()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_member users; v_convo conversations;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  v_member := _seeker_member(v_rec);
  if v_member.id is null then return jsonb_build_object('member', null); end if;

  select * into v_convo from conversations
    where member_id = v_member.id and recipient_id = v_rec.id limit 1;

  return jsonb_build_object(
    'member', jsonb_build_object('name', v_member.name, 'short_message', v_member.short_message),
    'status', coalesce(v_convo.status, 'active'),
    'messages', case when v_convo.id is null then '[]'::jsonb
                     else private.conversation_items(v_convo.id) end);
end;
$$;

create or replace function get_recipient_conversation(p_session_token text, p_conversation_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_member_name text; v_status text;
begin
  select c.status, u.name into v_status, v_member_name
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
    'messages', private.conversation_items(p_conversation_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins and Leaders: every conversation (metadata only), and moving one
-- ---------------------------------------------------------------------------
create or replace function leadership_conversations()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'first_name', coalesce(nullif(r.first_name, ''), 'Someone'),
      'member_id', u.id, 'member_name', u.name, 'member_active', u.active and u.removed_at is null,
      'status', c.status, 'started_at', c.created_at,
      'last_at', lm.created_at,
      -- Waiting: the last message is theirs and nobody has replied.
      'waiting_since', case when lm.sender_type = 'recipient' then lm.created_at end
    ) order by (lm.sender_type = 'recipient') desc, lm.created_at desc nulls last)
    from conversations c
    join users u on u.id = c.member_id
    join recipients r on r.id = c.recipient_id and r.deleted_at is null
    left join lateral (select m.sender_type, m.created_at from messages m
                        where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
    where c.org_id = app_user_org()
  ), '[]'::jsonb);
end;
$$;

create or replace function reassign_conversation(p_conversation_id uuid, p_to_member uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_convo conversations; v_from users; v_to users;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into v_convo from conversations where id = p_conversation_id and org_id = app_user_org();
  if v_convo.id is null then raise exception 'not_found'; end if;
  select * into v_to from users
   where id = p_to_member and org_id = v_convo.org_id and active and auth_uid is not null and removed_at is null;
  if v_to.id is null then raise exception 'invalid_member'; end if;
  if v_to.id = v_convo.member_id then return; end if;
  if exists (select 1 from conversations where member_id = v_to.id and recipient_id = v_convo.recipient_id) then
    raise exception 'already_talking';
  end if;
  select * into v_from from users where id = v_convo.member_id;

  update conversations
     set member_id = v_to.id, member_last_read_at = null, nudged_at = null, escalated_at = null
   where id = v_convo.id;
  update recipients set arrival_member_id = v_to.id where id = v_convo.recipient_id;
  insert into conversation_handoffs (conversation_id, from_name, to_member_id, to_name)
  values (v_convo.id, coalesce(v_from.name, 'Someone'), v_to.id, v_to.name);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['leadership_conversations()', 'reassign_conversation(uuid, uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Nudges
-- ---------------------------------------------------------------------------
alter table conversations add column if not exists nudged_at timestamptz;     -- member emailed (24h)
alter table conversations add column if not exists escalated_at timestamptz;  -- leaders told (48h)

-- Find waits that are due, email about each once, and return how many.
create or replace function private.follow_up_due()
returns int language plpgsql security definer set search_path = public
as $$
declare v_row record; v_n int := 0;
begin
  for v_row in
    select c.id, lm.created_at as waiting_since, c.nudged_at, c.escalated_at
    from conversations c
    join recipients r on r.id = c.recipient_id and r.deleted_at is null
    join lateral (select m.sender_type, m.created_at from messages m
                   where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
    where c.status = 'active' and lm.sender_type = 'recipient'
      and lm.created_at < now() - interval '24 hours'
  loop
    if v_row.waiting_since < now() - interval '48 hours'
       and (v_row.escalated_at is null or v_row.escalated_at < v_row.waiting_since) then
      perform private.notify_edge('notify', jsonb_build_object('kind', 'escalate', 'conversation_id', v_row.id));
      update conversations set escalated_at = now() where id = v_row.id;
      v_n := v_n + 1;
    end if;
    if v_row.nudged_at is null or v_row.nudged_at < v_row.waiting_since then
      perform private.notify_edge('notify', jsonb_build_object('kind', 'nudge', 'conversation_id', v_row.id));
      update conversations set nudged_at = now() where id = v_row.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.follow_up_due() from public;

-- Waits older than a week when this ships count as already handled (no burst
-- of stale emails on the first run).
update conversations c set nudged_at = now(), escalated_at = now()
 where (select m.sender_type = 'recipient' and m.created_at < now() - interval '7 days'
          from messages m where m.conversation_id = c.id order by m.created_at desc limit 1);

-- Every 15 minutes. (Where pg_cron isn't available the job simply isn't
-- scheduled; the function can still be run by hand.)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('ekkle-follow-up', '*/15 * * * *', 'select private.follow_up_due()');
exception when others then
  raise notice 'follow-up job not scheduled: %', sqlerrm;
end $$;
