-- Seeker accounts (Phase B): a study-taker signs in (magic link, optionally a
-- password later) and gets their own account — a recipient row linked to an
-- auth user via auth_uid. Everything a signed-in seeker does resolves through
-- auth.uid(), not a device token, so progress + conversations follow the
-- person across devices.
--
-- The anonymous session-token study RPCs (0013) remain for any non-account use;
-- the gated /studies UI uses the seeker_* RPCs below.

-- ---------------------------------------------------------------------------
-- Account linking
-- ---------------------------------------------------------------------------
-- Ensure the current authenticated user has a recipient row (their seeker
-- account). Attribution: arrival member from ?ref, else the org's designated
-- responder / first active member. Adopts a prior anonymous lead with the same
-- email if one exists. Idempotent — safe to call on every dashboard load.
create or replace function link_seeker_account(p_first_name text, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_slug text;
  v_member users;
  v_org uuid;
  v_rec recipients;
  v_name text := nullif(trim(p_first_name), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select email into v_email from auth.users where id = v_uid;

  -- Already linked → just keep name/email fresh.
  select * into v_rec from recipients where auth_uid = v_uid limit 1;
  if found then
    update recipients
       set email = coalesce(email, v_email),
           first_name = coalesce(nullif(first_name, ''), v_name, '')
     where id = v_rec.id;
    return;
  end if;

  -- Resolve the arrival member for attribution.
  v_slug := resolve_offer_member(p_ref);
  if v_slug is not null then
    select * into v_member from users where code_slug = v_slug limit 1;
    v_org := v_member.org_id;
  else
    select id into v_org from organizations order by created_at asc limit 1;
  end if;

  -- Adopt a prior anonymous lead (same email, no account yet).
  select * into v_rec from recipients
   where email = v_email and auth_uid is null and deleted_at is null
   order by created_at asc limit 1;
  if found then
    update recipients
       set auth_uid = v_uid,
           first_name = coalesce(nullif(first_name, ''), v_name, ''),
           arrival_member_id = coalesce(arrival_member_id, v_member.id),
           consented_at = coalesce(consented_at, now())
     where id = v_rec.id;
    return;
  end if;

  insert into recipients (org_id, first_name, email, session_token,
                          auth_uid, arrival_member_id, consented_at)
  values (v_org, coalesce(v_name, ''), v_email, 'seeker:' || v_uid::text,
          v_uid, v_member.id, now());
end;
$$;
grant execute on function link_seeker_account(text, text) to authenticated;

-- The signed-in seeker's recipient row (helper).
create or replace function _seeker_rec()
returns recipients
language sql stable security definer set search_path = public
as $$
  select * from recipients where auth_uid = auth.uid() and deleted_at is null limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Seeker-keyed study RPCs (resolve by auth.uid())
-- ---------------------------------------------------------------------------
create or replace function seeker_studies()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return '[]'::jsonb; end if;

  with ordered as (
    select s.*,
           row_number() over (order by s.sort_order, s.created_at) as rn,
           (select p.completed_at is not null from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec.id) as completed,
           (select p.last_page from study_progress p
             where p.study_id = s.id and p.recipient_id = v_rec.id) as last_page
    from studies s where s.org_id = v_rec.org_id and s.status = 'approved'),
  flagged as (
    select o.*, coalesce(o.completed, false) as done,
           coalesce(lag(o.completed) over (order by o.rn), true) as prev_done
    from ordered o)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'number', number, 'title', title, 'tagline', tagline,
           'completed', done, 'locked', not (rn = 1 or prev_done),
           'started', last_page is not null, 'last_page', coalesce(last_page, 1)
         ) order by rn), '[]'::jsonb)
  into v_result from flagged;
  return v_result;
end;
$$;
grant execute on function seeker_studies() to authenticated;

create or replace function seeker_study(p_study_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_study studies; v_locked boolean; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;

  select * into v_study from studies
    where id = p_study_id and org_id = v_rec.org_id and status = 'approved' limit 1;
  if not found then return null; end if;

  v_locked := exists (
    select 1 from studies e
    where e.org_id = v_rec.org_id and e.status = 'approved'
      and (e.sort_order, e.created_at) < (v_study.sort_order, v_study.created_at)
      and not exists (select 1 from study_progress p
        where p.study_id = e.id and p.recipient_id = v_rec.id and p.completed_at is not null));
  if v_locked then return jsonb_build_object('locked', true); end if;

  select jsonb_build_object(
    'id', v_study.id, 'number', v_study.number, 'title', v_study.title,
    'tagline', v_study.tagline, 'locked', false,
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb),
    'progress', (select jsonb_build_object('last_page', p.last_page, 'answers', p.answers,
        'completed', p.completed_at is not null)
      from study_progress p where p.study_id = v_study.id and p.recipient_id = v_rec.id)
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function seeker_study(uuid) to authenticated;

create or replace function seeker_save_progress(p_study_id uuid, p_last_page int, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_rec recipients;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return; end if;
  if not exists (select 1 from studies where id = p_study_id and org_id = v_rec.org_id
                  and status = 'approved') then return; end if;

  insert into study_progress (recipient_id, study_id, last_page, answers)
  values (v_rec.id, p_study_id, greatest(coalesce(p_last_page, 1), 1), coalesce(p_answers, '{}'::jsonb))
  on conflict (recipient_id, study_id) do update
    set last_page = greatest(excluded.last_page, study_progress.last_page),
        answers = excluded.answers;
end;
$$;
grant execute on function seeker_save_progress(uuid, int, jsonb) to authenticated;

create or replace function seeker_complete_study(p_study_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_rec recipients;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return; end if;
  if not exists (select 1 from studies where id = p_study_id and org_id = v_rec.org_id
                  and status = 'approved') then return; end if;

  insert into study_progress (recipient_id, study_id, answers, completed_at)
  values (v_rec.id, p_study_id, coalesce(p_answers, '{}'::jsonb), now())
  on conflict (recipient_id, study_id) do update
    set answers = coalesce(excluded.answers, study_progress.answers),
        completed_at = coalesce(study_progress.completed_at, now());
end;
$$;
grant execute on function seeker_complete_study(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seeker connection (their member + 1:1 thread)
-- ---------------------------------------------------------------------------
-- Resolve which member a seeker connects to: their arrival member, else the
-- org's designated responder, else the first active member.
create or replace function _seeker_member(v_rec recipients)
returns users
language sql stable security definer set search_path = public
as $$
  select u.* from users u
  where u.id = coalesce(
      v_rec.arrival_member_id,
      (select default_member_id from organizations where id = v_rec.org_id),
      (select id from users where org_id = v_rec.org_id and active = true
        order by created_at asc limit 1))
  limit 1;
$$;

create or replace function seeker_connection()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_member users; v_convo conversations; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  v_member := _seeker_member(v_rec);
  if v_member.id is null then return jsonb_build_object('member', null); end if;

  select * into v_convo from conversations
    where member_id = v_member.id and recipient_id = v_rec.id limit 1;

  select jsonb_build_object(
    'member', jsonb_build_object('name', v_member.name, 'short_message', v_member.short_message),
    'status', coalesce(v_convo.status, 'active'),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sender_type', msg.sender_type, 'body', msg.body, 'created_at', msg.created_at)
        order by msg.created_at)
      from messages msg where msg.conversation_id = v_convo.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function seeker_connection() to authenticated;

create or replace function seeker_send_message(p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_rec recipients; v_member users; v_convo_id uuid;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_message'; end if;
  v_rec := _seeker_rec();
  if v_rec.id is null then raise exception 'no_account'; end if;
  v_member := _seeker_member(v_rec);
  if v_member.id is null then raise exception 'no_member'; end if;

  select id into v_convo_id from conversations
    where member_id = v_member.id and recipient_id = v_rec.id limit 1;
  if v_convo_id is null then
    insert into conversations (org_id, member_id, recipient_id)
    values (v_member.org_id, v_member.id, v_rec.id) returning id into v_convo_id;
    insert into sequence_events (org_id, member_id, recipient_id, session_token, event)
    values (v_member.org_id, v_member.id, v_rec.id, v_rec.session_token, 'messaged');
  end if;

  if (select status from conversations where id = v_convo_id) = 'blocked' then
    raise exception 'conversation_blocked';
  end if;

  insert into messages (conversation_id, sender_type, body)
  values (v_convo_id, 'recipient', trim(p_body));
end;
$$;
grant execute on function seeker_send_message(text) to authenticated;
