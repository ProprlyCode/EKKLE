-- 0050 — Public codes: the ministry's own codes for posters, clothing and
-- welcome tables (situations, part 2).
--
--   * Admins make them in Leadership → Public codes: a name ("Lobby poster"),
--     a link name (/c/lobby) and the flow it opens. Printable as a poster or
--     downloaded as a large QR for clothing and merchandise.
--   * Someone who opens one sees the ministry — its name and logo, never a
--     member's photo. If they write, the conversation goes to the ministry's
--     designated responder (Account), else an Admin; Leaders can move it as
--     with any conversation.
--   * Opens, finishes and messages record the code (and its flow), so each
--     code shows how it's doing. They count toward the ministry, not any one
--     member.

create table if not exists public_codes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 60),
  code         text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(code) <= 30),
  sequence_id  uuid references sequences (id) on delete set null,
  active       boolean not null default true,
  created_by   uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (org_id, code)
);
alter table public_codes enable row level security;
revoke all on public_codes from anon, authenticated;
create index if not exists public_codes_sequence_idx on public_codes (sequence_id);

alter table sequence_events add column if not exists public_code_id uuid references public_codes (id) on delete set null;
alter table conversations add column if not exists public_code_id uuid references public_codes (id) on delete set null;
create index if not exists sequence_events_public_code_idx on sequence_events (public_code_id);
create index if not exists conversations_public_code_idx on conversations (public_code_id);

-- Who answers for the ministry: the designated responder, else the longest-
-- standing Admin.
create or replace function private.ministry_responder(p_org uuid)
returns users language sql stable security definer set search_path = public
as $$
  select u.* from users u
   where u.org_id = p_org and u.active and u.auth_uid is not null
     and (u.id = (select default_member_id from organizations where id = p_org) or u.role = 'admin')
   order by (u.id = (select default_member_id from organizations where id = p_org)) desc, u.created_at
   limit 1;
$$;
revoke execute on function private.ministry_responder(uuid) from public;

-- An active code on this address.
create or replace function private.public_code(p_code text)
returns public_codes language sql stable security definer set search_path = public
as $$
  select * from public_codes
   where code = lower(p_code) and active and org_id = request_account() limit 1;
$$;
revoke execute on function private.public_code(text) from public;

-- The flow a code opens: its own (published), else the ministry's first.
create or replace function private.public_code_flow(c public_codes)
returns uuid language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select s.id from sequences s where s.id = c.sequence_id and s.org_id = c.org_id and s.status = 'approved'),
    (select s.id from sequences s where s.org_id = c.org_id and s.status = 'approved' order by s.created_at limit 1));
$$;
revoke execute on function private.public_code_flow(public_codes) from public;

-- ---------------------------------------------------------------------------
-- The page (anyone): /c/:code
-- ---------------------------------------------------------------------------
create or replace function public_code_landing(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare c public_codes; v_seq sequences; v_org organizations; v_responder users;
begin
  c := private.public_code(p_code);
  if c.id is null then return null; end if;
  select * into v_seq from sequences where id = private.public_code_flow(c);
  if not found then return null; end if;
  select * into v_org from organizations where id = c.org_id;
  v_responder := private.ministry_responder(c.org_id);
  return jsonb_build_object(
    -- The ministry, in place of a member: no photo, no personal message.
    'member', jsonb_build_object('name', v_org.name, 'short_message', null, 'photo', null, 'ministry', null),
    'public', true,
    -- Where "keep this conversation" attributes them.
    'ref', v_responder.code_slug,
    'sequence', jsonb_build_object('id', v_seq.id, 'title', v_seq.title),
    'situation', null,
    'connect', jsonb_build_object('headline', v_seq.connect_headline, 'body', v_seq.connect_body, 'ctas', v_seq.ctas),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('headline', s.headline, 'body', s.body, 'icon', s.icon) order by s.sort_order)
      from sequence_screens s where s.sequence_id = v_seq.id), '[]'::jsonb));
end;
$$;

create or replace function log_public_code_event(p_session_token text, p_code text, p_event text)
returns void language plpgsql security definer set search_path = public
as $$
declare c public_codes;
begin
  if p_event not in ('started', 'completed') then raise exception 'invalid_event'; end if;
  c := private.public_code(p_code);
  if c.id is null then return; end if;
  insert into sequence_events (org_id, member_id, session_token, sequence_id, event, public_code_id)
  values (c.org_id, null, p_session_token, private.public_code_flow(c), p_event, c.id);
end;
$$;

create or replace function start_public_conversation(
  p_session_token text, p_code text, p_first_name text, p_email text, p_body text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare c public_codes; v_responder users; v_recipient recipients; v_conversation_id uuid;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  c := private.public_code(p_code);
  if c.id is null then raise exception 'code_not_found'; end if;
  v_responder := private.ministry_responder(c.org_id);
  if v_responder.id is null then raise exception 'no_responder'; end if;

  select * into v_recipient from recipients
   where session_token = p_session_token and deleted_at is null limit 1;
  if not found then
    insert into recipients (org_id, first_name, email, session_token, arrival_member_id, consented_at)
    values (c.org_id, coalesce(trim(p_first_name), ''), nullif(trim(p_email), ''), p_session_token,
            v_responder.id, now())
    returning * into v_recipient;
  else
    update recipients
       set first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
           email = coalesce(nullif(trim(p_email), ''), email),
           consented_at = coalesce(consented_at, now())
     where id = v_recipient.id
    returning * into v_recipient;
  end if;

  select id into v_conversation_id from conversations
   where member_id = v_responder.id and recipient_id = v_recipient.id limit 1;
  if v_conversation_id is null then
    insert into conversations (org_id, member_id, recipient_id, public_code_id)
    values (c.org_id, v_responder.id, v_recipient.id, c.id)
    returning id into v_conversation_id;
  end if;

  insert into messages (conversation_id, sender_type, body)
  values (v_conversation_id, 'recipient', trim(p_body));

  insert into sequence_events (org_id, member_id, recipient_id, session_token, sequence_id, event, public_code_id)
  values (c.org_id, null, v_recipient.id, p_session_token, private.public_code_flow(c), 'messaged', c.id);

  return v_conversation_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public_code_landing(text)', 'log_public_code_event(text, text, text)',
      'start_public_conversation(text, text, text, text, text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Leadership: the list (Admins and Leaders), making them (Admins)
-- ---------------------------------------------------------------------------
create or replace function public_codes_list()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_responder users;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  v_responder := private.ministry_responder(v_org);
  return jsonb_build_object(
    'responder', case when v_responder.id is not null then v_responder.name end,
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'code', c.code, 'active', c.active, 'sequence_id', c.sequence_id,
        'flow', (select s.title from sequences s where s.id = private.public_code_flow(c)),
        'first_screen', (select jsonb_build_object('headline', x.headline, 'body', x.body)
                           from sequence_screens x where x.sequence_id = private.public_code_flow(c)
                          order by x.sort_order limit 1),
        'opened', (select count(*) from sequence_events e where e.public_code_id = c.id and e.event = 'started'),
        'wrote', (select count(*) from conversations k where k.public_code_id = c.id))
        order by c.created_at)
      from public_codes c where c.org_id = v_org), '[]'::jsonb));
end;
$$;

create or replace function save_public_code(p_id uuid, p_name text, p_code text, p_sequence uuid, p_active boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_id uuid; v_code text := lower(trim(coalesce(p_code, '')));
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'missing'; end if;
  if v_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_code) > 30 then raise exception 'invalid_code'; end if;
  if exists (select 1 from public_codes where org_id = v_org and code = v_code and id is distinct from p_id) then
    raise exception 'code_taken';
  end if;
  if p_sequence is not null and not exists (select 1 from sequences where id = p_sequence and org_id = v_org) then
    raise exception 'invalid_flow';
  end if;
  if p_id is null then
    insert into public_codes (org_id, name, code, sequence_id, active, created_by)
    values (v_org, trim(p_name), v_code, p_sequence, coalesce(p_active, true), app_user_id())
    returning id into v_id;
  else
    update public_codes set name = trim(p_name), code = v_code, sequence_id = p_sequence,
                            active = coalesce(p_active, true)
     where id = p_id and org_id = v_org
    returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function delete_public_code(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  delete from public_codes where id = p_id and org_id = app_user_org();
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public_codes_list()', 'save_public_code(uuid, text, text, uuid, boolean)',
      'delete_public_code(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
