-- 0043 — Address change requests (accounts-and-roles.md, step 4).
--
--   * A ministry's Admin asks for a new address (<new>.ekkle.org), with an
--     optional note; one request waits at a time, and they can cancel it.
--   * The Ekklē team's Owners and Admins approve or decline (with a reason).
--   * Approving moves the ministry to the new address at once. The old one is
--     kept for good (previous_addresses): it keeps leading to the ministry —
--     printed codes, wallet cards, shared links and installed apps still work
--     — and it is never given to anyone else.
--   * Emails: the Ekklē team hears of a new request; the Admin who asked
--     hears the decision.

create table if not exists previous_addresses (
  subdomain   text primary key,
  org_id      uuid not null references organizations (id) on delete cascade,
  retired_at  timestamptz not null default now()
);
create index if not exists previous_addresses_org_idx on previous_addresses (org_id);
alter table previous_addresses enable row level security;
revoke all on previous_addresses from anon, authenticated;

create table if not exists address_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  subdomain       text not null,
  from_subdomain  text not null,
  note            text check (char_length(note) <= 500),
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'declined', 'cancelled')),
  reason          text check (char_length(reason) <= 500), -- why it was declined
  requested_by    uuid references users (id) on delete set null,
  decided_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);
create unique index if not exists address_requests_one_pending
  on address_requests (org_id) where status = 'pending';
alter table address_requests enable row level security;
revoke all on address_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Is an address free? Format, not reserved, not anyone's now, and not
-- anyone else's before. (A ministry may go back to one of its own.)
-- ---------------------------------------------------------------------------
create or replace function private.address_free(p_subdomain text, p_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
     and p_subdomain not in ('www', 'app', 'api', 'admin', 'staging', 'platform', 'mail',
                             'email', 'ekkle', 'static', 'assets', 'help', 'support', 'status')
     and not exists (select 1 from organizations where subdomain = p_subdomain)
     and not exists (select 1 from previous_addresses
                      where subdomain = p_subdomain and org_id is distinct from p_org);
$$;
revoke execute on function private.address_free(text, uuid) from public;

-- New accounts can't take an address someone had before.
create or replace function platform_subdomain_available(p_subdomain text)
returns boolean language sql stable security definer set search_path = public
as $$
  select is_platform_member() and private.address_free(lower(trim(p_subdomain)), null);
$$;

create or replace function private.guard_previous_address()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from previous_addresses
              where subdomain = new.subdomain and org_id <> new.id) then
    raise exception 'subdomain_taken';
  end if;
  return new;
end;
$$;
drop trigger if exists organizations_guard_previous_address on organizations;
create trigger organizations_guard_previous_address
  before insert or update of subdomain on organizations
  for each row execute function private.guard_previous_address();

-- ---------------------------------------------------------------------------
-- An old address still finds its ministry
-- ---------------------------------------------------------------------------
create or replace function private.host_subdomain(p_host text)
returns text language sql immutable
as $$
  with h as (select lower(split_part(trim(coalesce(p_host, '')), ':', 1)) as host)
  select case
           when h.host ~ '^[a-z0-9-]+\.(staging\.)?ekkle\.org$' then split_part(h.host, '.', 1)
           when h.host ~ '^[a-z0-9-]+\.localhost$' then split_part(h.host, '.', 1)
         end
  from h;
$$;

create or replace function public.account_for_host(p_host text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with h as (select lower(split_part(trim(coalesce(p_host, '')), ':', 1)) as host,
                    private.host_subdomain(p_host) as sub)
  select o.id
  from organizations o, h
  where o.status = 'active'
    and ((o.custom_domain is not null and lower(o.custom_domain) = h.host)
      or o.subdomain = h.sub
      or o.id = (select p.org_id from previous_addresses p where p.subdomain = h.sub))
  order by (o.subdomain = h.sub) desc
  limit 1;
$$;

-- The app's start-up lookup. On an old address it says where the ministry
-- moved (`moved_to`), and the page goes there — same path.
create or replace function public.resolve_account(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with h as (select lower(split_part(trim(coalesce(p_host, '')), ':', 1)) as host,
                    private.host_subdomain(p_host) as sub)
  select coalesce(
    (select private.account_json(o) from organizations o, h
      where (o.custom_domain is not null and lower(o.custom_domain) = h.host) or o.subdomain = h.sub
      limit 1),
    (select private.account_json(o) || jsonb_build_object('moved_to', o.subdomain)
       from organizations o join previous_addresses p on p.org_id = o.id, h
      where p.subdomain = h.sub
      limit 1));
$$;

-- ---------------------------------------------------------------------------
-- The ministry's side (Admins)
-- ---------------------------------------------------------------------------
create or replace function address_available(p_subdomain text)
returns boolean language sql stable security definer set search_path = public
as $$
  select is_account_admin() and private.address_free(lower(trim(p_subdomain)), app_user_org());
$$;

create or replace function private.address_request_json(r address_requests)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', r.id, 'subdomain', r.subdomain, 'from_subdomain', r.from_subdomain,
                            'note', r.note, 'status', r.status, 'reason', r.reason,
                            'created_at', r.created_at, 'decided_at', r.decided_at);
$$;
revoke execute on function private.address_request_json(address_requests) from public;

-- The latest request (waiting, or the last decision) and the old addresses.
create or replace function my_address_request()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_req address_requests;
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  select * into v_req from address_requests
   where org_id = v_org and status <> 'cancelled'
   order by created_at desc limit 1;
  return jsonb_build_object(
    'request', case when v_req.id is null then null else private.address_request_json(v_req) end,
    'previous', coalesce((select jsonb_agg(subdomain order by retired_at desc)
                            from previous_addresses where org_id = v_org), '[]'::jsonb));
end;
$$;

create or replace function request_address_change(p_subdomain text, p_note text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_org organizations;
  v_sub text := lower(trim(p_subdomain));
  v_id uuid;
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  select * into v_org from organizations where id = app_user_org();
  if v_sub = v_org.subdomain then raise exception 'same_address'; end if;
  if not private.address_free(v_sub, v_org.id) then raise exception 'subdomain_taken'; end if;
  if exists (select 1 from address_requests where org_id = v_org.id and status = 'pending') then
    raise exception 'already_pending';
  end if;
  insert into address_requests (org_id, subdomain, from_subdomain, note, requested_by)
  values (v_org.id, v_sub, v_org.subdomain, nullif(trim(p_note), ''), app_user_id())
  returning id into v_id;
  perform private.notify_edge('notify', jsonb_build_object('kind', 'address_request', 'request_id', v_id));
  return v_id;
end;
$$;

create or replace function cancel_address_request()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_account_admin() then raise exception 'forbidden'; end if;
  update address_requests set status = 'cancelled', decided_at = now()
   where org_id = app_user_org() and status = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- The Ekklē team's side
-- ---------------------------------------------------------------------------
create or replace function platform_address_requests()
returns jsonb language sql stable security definer set search_path = public
as $$
  select case when not is_platform_member() then null else coalesce((
    select jsonb_agg(private.address_request_json(r) || jsonb_build_object(
             'ministry', o.name,
             'requested_by', (select u.name from users u where u.id = r.requested_by))
           order by (r.status = 'pending') desc, r.created_at desc)
    from (select * from address_requests where status <> 'cancelled'
           order by (status = 'pending') desc, created_at desc limit 30) r
    join organizations o on o.id = r.org_id), '[]'::jsonb) end;
$$;

create or replace function decide_address_request(p_id uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_req address_requests; v_org organizations;
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  select * into v_req from address_requests where id = p_id and status = 'pending' for update;
  if v_req.id is null then raise exception 'not_found'; end if;

  if p_approve then
    select * into v_org from organizations where id = v_req.org_id for update;
    if not private.address_free(v_req.subdomain, v_org.id) then raise exception 'subdomain_taken'; end if;
    -- Going back to one of its own old addresses frees it from the list.
    delete from previous_addresses where subdomain = v_req.subdomain and org_id = v_org.id;
    insert into previous_addresses (subdomain, org_id) values (v_org.subdomain, v_org.id)
      on conflict (subdomain) do nothing;
    update organizations set subdomain = v_req.subdomain where id = v_org.id;
  end if;

  update address_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         reason = case when p_approve then null else nullif(trim(p_reason), '') end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  perform private.notify_edge('notify', jsonb_build_object('kind', 'address_decided', 'request_id', p_id));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['address_available(text)', 'my_address_request()',
      'request_address_change(text, text)', 'cancel_address_request()',
      'platform_address_requests()', 'decide_address_request(uuid, boolean, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
