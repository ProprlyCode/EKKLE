-- 0049 — Situations: one code, with situations a tap away.
--
--   * A member's main code is unchanged (their chosen flow). Under it, the
--     situations their ministry offers ("Over coffee", "Someone grieving"):
--     tapping one shows the same personal link with the situation added,
--     /r/david/grief, which opens that situation's flow and still connects
--     to David. Nothing for members to set up.
--   * A situation is a flow with a short name and a link name, switched on
--     with "Offer to members". No limit on how many a ministry offers.
--   * Admins and Leaders copy one of Ekklē's templates (0048) into their
--     flows to start from, then edit it like any other flow.
--   * Opens, finishes and messages record which flow they came through, so
--     outcomes can be split by situation.

alter table sequences
  add column if not exists situation text check (char_length(trim(situation)) between 1 and 40),
  add column if not exists situation_slug text
    check (situation_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(situation_slug) <= 30),
  add column if not exists offered boolean not null default false,
  add column if not exists template_id uuid references flow_templates (id) on delete set null;
alter table sequences drop constraint if exists sequences_offered_needs_situation;
alter table sequences add constraint sequences_offered_needs_situation
  check (not offered or (situation is not null and situation_slug is not null));
create unique index if not exists sequences_situation_slug_idx
  on sequences (org_id, situation_slug) where situation_slug is not null;
create index if not exists sequences_template_idx on sequences (template_id);
create index if not exists sequence_events_sequence_idx on sequence_events (sequence_id, created_at);

-- The flow a member's link opens: the situation's, when the ministry offers
-- it (published), else their main flow — so an old situation link still works.
create or replace function private.link_flow(p_member users, p_situation text)
returns uuid language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select s.id from sequences s
      where p_situation is not null and s.org_id = p_member.org_id and s.situation_slug = p_situation
        and s.offered and s.status = 'approved'),
    member_active_sequence_id(p_member));
$$;
revoke execute on function private.link_flow(users, text) from public;

create or replace function private.link_member(p_slug text)
returns users language sql stable security definer set search_path = public
as $$
  select * from users where code_slug = p_slug and active = true
    and (request_account() is null or org_id = request_account()) limit 1;
$$;
revoke execute on function private.link_member(text) from public;

-- ---------------------------------------------------------------------------
-- The link page (anyone): landing, events, first message — now situation-aware
-- ---------------------------------------------------------------------------
drop function if exists get_recipient_landing(text);
create or replace function get_recipient_landing(p_slug text, p_situation text default null)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_member users; v_seq sequences;
begin
  v_member := private.link_member(p_slug);
  if v_member.id is null then return null; end if;
  select * into v_seq from sequences where id = private.link_flow(v_member, p_situation);
  if not found then return null; end if;
  return jsonb_build_object(
    'member', private.member_card(v_member),
    'sequence', jsonb_build_object('id', v_seq.id, 'title', v_seq.title),
    'situation', case when v_seq.offered and v_seq.situation_slug = p_situation
                      then jsonb_build_object('slug', v_seq.situation_slug, 'name', v_seq.situation) end,
    'connect', jsonb_build_object('headline', v_seq.connect_headline, 'body', v_seq.connect_body,
                                  'ctas', v_seq.ctas),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('headline', s.headline, 'body', s.body, 'icon', s.icon)
        order by s.sort_order)
      from sequence_screens s where s.sequence_id = v_seq.id), '[]'::jsonb));
end;
$$;

drop function if exists log_sequence_event(text, text, text);
create or replace function log_sequence_event(p_session_token text, p_slug text, p_event text,
                                              p_situation text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_member users;
begin
  if p_event not in ('started', 'completed', 'messaged') then raise exception 'invalid_event'; end if;
  v_member := private.link_member(p_slug);
  if v_member.id is null then return; end if;
  insert into sequence_events (org_id, member_id, session_token, sequence_id, event)
  values (v_member.org_id, v_member.id, p_session_token, private.link_flow(v_member, p_situation), p_event);
end;
$$;

drop function if exists start_conversation(text, text, text, text, text);
create or replace function start_conversation(
  p_session_token text, p_slug text, p_first_name text, p_email text, p_body text,
  p_situation text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_member users;
  v_recipient recipients;
  v_conversation_id uuid;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  v_member := private.link_member(p_slug);
  if v_member.id is null then raise exception 'member_not_found'; end if;

  -- Reuse the recipient for this device/session, else create one.
  select * into v_recipient from recipients
   where session_token = p_session_token and deleted_at is null limit 1;
  if not found then
    insert into recipients (org_id, first_name, email, session_token, arrival_member_id, consented_at)
    values (v_member.org_id, coalesce(trim(p_first_name), ''), nullif(trim(p_email), ''),
            p_session_token, v_member.id, now())
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

  insert into sequence_events (org_id, member_id, recipient_id, session_token, sequence_id, event)
  values (v_member.org_id, v_member.id, v_recipient.id, p_session_token,
          private.link_flow(v_member, p_situation), 'messaged');

  return v_conversation_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['get_recipient_landing(text, text)', 'log_sequence_event(text, text, text, text)',
      'start_conversation(text, text, text, text, text, text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Members: the situations their ministry offers
-- ---------------------------------------------------------------------------
create or replace function my_situations()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_me users := private.my_membership();
begin
  if v_me.id is null then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('slug', s.situation_slug, 'name', s.situation, 'title', s.title)
                     order by lower(s.situation), s.created_at)
    from sequences s
    where s.org_id = v_me.org_id and s.offered and s.status = 'approved'), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins and Leaders: templates, and a flow's situation
-- ---------------------------------------------------------------------------
create or replace function flow_templates_for_ministry()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org();
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(private.flow_template_json(t) || jsonb_build_object(
             'copy_id', (select s.id from sequences s where s.org_id = v_org and s.template_id = t.id
                          order by s.created_at desc limit 1))
           order by t.audience, t.sort_order, t.created_at)
    from flow_templates t where t.status = 'published'), '[]'::jsonb);
end;
$$;

-- A free link name in the ministry: the template's, else with -2, -3 …
create or replace function private.free_situation_slug(p_org uuid, p_slug text, p_except uuid)
returns text language plpgsql stable security definer set search_path = public
as $$
declare v_try text := p_slug; v_n int := 1;
begin
  while exists (select 1 from sequences where org_id = p_org and situation_slug = v_try
                  and id is distinct from p_except) loop
    v_n := v_n + 1;
    v_try := left(p_slug, 27) || '-' || v_n;
  end loop;
  return v_try;
end;
$$;
revoke execute on function private.free_situation_slug(uuid, text, uuid) from public;

-- Copy a published template into the ministry's flows, as a draft to edit.
create or replace function use_flow_template(p_template uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); t flow_templates; v_id uuid; v_screen jsonb; v_i int := 0;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into t from flow_templates where id = p_template and status = 'published';
  if not found then raise exception 'not_found'; end if;
  insert into sequences (org_id, title, status, connect_headline, connect_body, ctas,
                         situation, situation_slug, offered, template_id)
  values (v_org, t.title, 'draft', t.connect_headline, t.connect_body, t.ctas,
          t.situation, private.free_situation_slug(v_org, t.slug, null), false, t.id)
  returning id into v_id;
  for v_screen in select * from jsonb_array_elements(t.screens) loop
    insert into sequence_screens (sequence_id, sort_order, headline, body)
    values (v_id, v_i, coalesce(v_screen ->> 'headline', ''), coalesce(v_screen ->> 'body', ''));
    v_i := v_i + 1;
  end loop;
  return v_id;
end;
$$;

-- Name a flow's situation and offer it to members (or not). A blank name
-- clears it.
create or replace function set_flow_situation(p_sequence uuid, p_situation text, p_slug text, p_offered boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_name text := nullif(trim(coalesce(p_situation, '')), '');
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if not exists (select 1 from sequences where id = p_sequence and org_id = v_org) then
    raise exception 'not_found';
  end if;
  if v_name is null then
    update sequences set situation = null, situation_slug = null, offered = false where id = p_sequence;
    return;
  end if;
  if char_length(v_name) > 40 then raise exception 'too_long'; end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 30 then
    raise exception 'invalid_slug';
  end if;
  if exists (select 1 from sequences where org_id = v_org and situation_slug = p_slug and id <> p_sequence) then
    raise exception 'slug_taken';
  end if;
  update sequences set situation = v_name, situation_slug = p_slug, offered = coalesce(p_offered, false)
   where id = p_sequence;
end;
$$;

-- How each flow is doing: opened, finished, wrote (for the time range).
create or replace function flow_outcomes(p_days int)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_since timestamptz;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if p_days is not null and p_days not in (30, 90) then raise exception 'invalid_range'; end if;
  v_since := case when p_days is null then null else now() - make_interval(days => p_days) end;
  return coalesce((
    select jsonb_agg(r order by (r ->> 'opened')::int desc, r ->> 'title')
    from (
      select jsonb_build_object(
        'id', s.id, 'title', s.title, 'situation', case when s.offered then s.situation end,
        'opened', count(*) filter (where e.event = 'started'),
        'finished', count(*) filter (where e.event = 'completed'),
        'wrote', count(*) filter (where e.event = 'messaged')) as r
      from sequences s
      left join sequence_events e on e.sequence_id = s.id and (v_since is null or e.created_at >= v_since)
      where s.org_id = v_org and (s.status = 'approved' or e.id is not null)
      group by s.id
    ) x), '[]'::jsonb);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['my_situations()', 'flow_templates_for_ministry()', 'use_flow_template(uuid)',
      'set_flow_situation(uuid, text, text, boolean)', 'flow_outcomes(int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
