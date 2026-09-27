-- 0023 — accounts on their own addresses (docs/tenancy.md, phase 1).
--
-- Each church or ministry account is reached at <subdomain>.ekkle.org, or its
-- own connected domain. The browser's Origin header on every API call names
-- the address the page was opened on; request_account() turns it into the
-- account, and the public lookups below stay inside it:
--   member links (landing, first message), the offer page, studies, and a
--   seeker's own space (a person can have a space with more than one account).
-- No Origin (server-side calls, ekkle.org itself) → unscoped, as before.

-- ---------------------------------------------------------------------------
-- Addresses and kinds
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists subdomain text,
  add column if not exists custom_domain text,
  add column if not exists kind text not null default 'church'
    check (kind in ('church', 'personal_ministry'));

-- New accounts default their subdomain to their slug.
create or replace function private.default_subdomain()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.subdomain is null then
    new.subdomain := lower(regexp_replace(new.slug, '[^a-zA-Z0-9-]', '', 'g'));
  end if;
  return new;
end;
$$;
drop trigger if exists organizations_default_subdomain on public.organizations;
create trigger organizations_default_subdomain
  before insert on public.organizations
  for each row execute function private.default_subdomain();

update organizations
   set subdomain = lower(regexp_replace(slug, '[^a-zA-Z0-9-]', '', 'g'))
 where subdomain is null;

-- Jonathan's test account becomes his personal ministry (live database only).
update organizations set subdomain = 'jonathan', kind = 'personal_ministry'
 where id = '00000000-0000-0000-0000-0000000000a1' and name = 'Storyline';

alter table organizations alter column subdomain set not null;
alter table organizations drop constraint if exists organizations_subdomain_format;
alter table organizations add constraint organizations_subdomain_format check (
  subdomain ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
  and subdomain not in ('www', 'app', 'api', 'admin', 'staging', 'platform', 'mail',
                        'email', 'ekkle', 'static', 'assets', 'help', 'support', 'status')
);
create unique index if not exists organizations_subdomain_key on organizations (subdomain);
create unique index if not exists organizations_custom_domain_key
  on organizations (lower(custom_domain)) where custom_domain is not null;

-- A seeker can have a space with more than one account.
alter table recipients drop constraint if exists recipients_auth_uid_key;
create unique index if not exists recipients_org_auth_uid_key
  on recipients (org_id, auth_uid) where auth_uid is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Address → account
-- ---------------------------------------------------------------------------
create or replace function public.account_for_host(p_host text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with h as (select lower(split_part(trim(coalesce(p_host, '')), ':', 1)) as host)
  select o.id
  from organizations o, h
  where (o.custom_domain is not null and lower(o.custom_domain) = h.host)
     or o.subdomain = case
          when h.host ~ '^[a-z0-9-]+\.(staging\.)?ekkle\.org$' then split_part(h.host, '.', 1)
          when h.host ~ '^[a-z0-9-]+\.localhost$' then split_part(h.host, '.', 1)
        end
  limit 1;
$$;

-- The account of the page making this request (from its Origin), or null.
create or replace function public.request_account()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_origin text;
begin
  begin
    v_origin := current_setting('request.headers', true)::json ->> 'origin';
  exception when others then
    return null;
  end;
  if v_origin is null then return null; end if;
  return account_for_host(regexp_replace(v_origin, '^[a-z]+://', ''));
end;
$$;

-- For the app: which account is this address? (public facts only)
create or replace function public.resolve_account(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', o.id, 'name', o.name, 'subdomain', o.subdomain,
                            'custom_domain', o.custom_domain, 'kind', o.kind)
  from organizations o where o.id = account_for_host(p_host);
$$;

-- For old ekkle.org links: the account a member link belongs to.
create or replace function public.member_account(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('subdomain', o.subdomain, 'custom_domain', o.custom_domain)
  from users u join organizations o on o.id = u.org_id
  where u.code_slug = p_slug limit 1;
$$;

-- "Find your church" on ekkle.org.
create or replace function public.find_accounts(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', o.name, 'subdomain', o.subdomain, 'custom_domain', o.custom_domain)
           order by o.name), '[]'::jsonb)
  from (select * from organizations
        where length(trim(coalesce(p_query, ''))) >= 2
          and name ilike '%' || trim(p_query) || '%'
        order by name limit 10) o;
$$;

grant execute on function public.resolve_account(text) to anon, authenticated;
grant execute on function public.member_account(text) to anon, authenticated;
grant execute on function public.find_accounts(text) to anon, authenticated;
revoke execute on function public.account_for_host(text) from public, anon, authenticated;
revoke execute on function public.request_account() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public lookups stay inside the account (definitions otherwise unchanged)
-- ---------------------------------------------------------------------------
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
  select * into v_member from users where code_slug = p_slug and active = true
    and (request_account() is null or org_id = request_account()) limit 1;
  if not found then return null; end if;

  select * into v_seq from sequences
  where id = member_active_sequence_id(v_member);
  if not found then return null; end if;

  select jsonb_build_object(
    'member', jsonb_build_object('name', v_member.name, 'short_message', v_member.short_message),
    'sequence', jsonb_build_object('id', v_seq.id, 'title', v_seq.title),
    'connect', jsonb_build_object(
      'headline', v_seq.connect_headline,
      'body', v_seq.connect_body,
      'ctas', v_seq.ctas
    ),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('headline', s.headline, 'body', s.body, 'icon', s.icon)
        order by s.sort_order)
      from sequence_screens s where s.sequence_id = v_seq.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

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

  select * into v_member from users where code_slug = p_slug and active = true
    and (request_account() is null or org_id = request_account()) limit 1;
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

create or replace function resolve_offer_member(p_ref text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_slug text;
begin
  v_org := coalesce(request_account(), (select id from organizations order by created_at asc limit 1));
  if v_org is null then return null; end if;

  -- 1. explicit referral
  if coalesce(p_ref, '') <> '' then
    select code_slug into v_slug
    from users where org_id = v_org and code_slug = p_ref and active = true limit 1;
    if v_slug is not null then return v_slug; end if;
  end if;

  -- 2. designated responder
  select u.code_slug into v_slug
  from organizations o join users u on u.id = o.default_member_id
  where o.id = v_org and u.active = true limit 1;
  if v_slug is not null then return v_slug; end if;

  -- 3. fallback: first active member
  select code_slug into v_slug
  from users where org_id = v_org and active = true
  order by created_at asc limit 1;
  return v_slug;
end;
$$;

create or replace function _study_org(p_session_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select org_id from recipients
      where session_token = p_session_token and deleted_at is null
        and (request_account() is null or org_id = request_account()) limit 1),
    request_account(),
    (select id from organizations order by created_at asc limit 1)
  );
$$;

create or replace function _seeker_rec()
returns recipients
language sql stable security definer set search_path = public
as $$
  select * from recipients where auth_uid = auth.uid() and deleted_at is null
    and (request_account() is null or org_id = request_account())
  order by created_at asc limit 1;
$$;

create or replace function public.link_seeker_account(p_first_name text, p_ref text)
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
  select * into v_rec from recipients where auth_uid = v_uid
    and (request_account() is null or org_id = request_account()) limit 1;
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
    v_org := coalesce(request_account(), (select id from organizations order by created_at asc limit 1));
  end if;

  -- Adopt a prior anonymous lead (same email, no account yet).
  select * into v_rec from recipients
   where email = v_email and auth_uid is null and deleted_at is null
     and org_id = v_org
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
  values (v_org, coalesce(v_name, ''), v_email, 'seeker:' || v_uid::text || '@' || v_org::text,
          v_uid, v_member.id, now())
  -- Two sign-in events can call this at the same moment; the loser of that
  -- race finds the winner's row here instead of failing.
  on conflict do nothing;
end;
$$;
