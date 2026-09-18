-- Public offer front door: attribution + a designated responder.
--
-- The public home (/) and topic tiles start a study without a specific member.
-- resolve_offer_member() decides who the seeker connects to:
--   1. an explicit ?ref=<code_slug> (the member whose QR/link brought them),
--   2. else the org's designated responder (organizations.default_member_id),
--   3. else the first active member.
-- The client then routes to /r/<slug>, reusing the whole recipient flow, so a
-- connect is attributed correctly with no changes to messaging.

alter table organizations
  add column if not exists default_member_id uuid references users (id) on delete set null;

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
  select id into v_org from organizations order by created_at asc limit 1;
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

grant execute on function resolve_offer_member(text) to anon, authenticated;
