-- Platform console: owner-only overview + settings (platform_admin).

alter table organizations
  add column if not exists offer_enabled boolean not null default true;

-- Cross-cutting overview for the platform owner.
create or replace function platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_result jsonb;
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  v_org := app_user_org();

  select jsonb_build_object(
    'started', (select count(*) from sequence_events where org_id = v_org and event = 'started'),
    'completed', (select count(*) from sequence_events where org_id = v_org and event = 'completed'),
    'messaged', (select count(*) from sequence_events where org_id = v_org and event = 'messaged'),
    'conversations', (select count(*) from conversations where org_id = v_org),
    'active_conversations', (select count(*) from conversations where org_id = v_org and status = 'active'),
    'recipients', (select count(*) from recipients where org_id = v_org and deleted_at is null),
    'checkins', jsonb_build_object(
      'yes', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id where u.org_id = v_org and cc.connected = 'yes'),
      'not_yet', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id where u.org_id = v_org and cc.connected = 'not_yet'),
      'no', (select count(*) from connection_checkins cc join users u on u.id = cc.member_id where u.org_id = v_org and cc.connected = 'no')
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', u.name,
        'code_slug', u.code_slug,
        'started', (select count(*) from sequence_events e where e.member_id = u.id and e.event = 'started'),
        'messaged', (select count(*) from sequence_events e where e.member_id = u.id and e.event = 'messaged'),
        'conversations', (select count(*) from conversations c where c.member_id = u.id)
      ) order by u.created_at asc)
      from users u where u.org_id = v_org and u.active = true
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function platform_overview() to authenticated;

-- Settings write (church name, designated responder, offer on/off).
create or replace function set_org_settings(
  p_name text, p_default_member_id uuid, p_offer_enabled boolean
)
returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare v_org organizations;
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  update organizations set
    name = coalesce(nullif(trim(p_name), ''), name),
    default_member_id = p_default_member_id,
    offer_enabled = coalesce(p_offer_enabled, offer_enabled)
  where id = app_user_org()
  returning * into v_org;
  return v_org;
end;
$$;
grant execute on function set_org_settings(text, uuid, boolean) to authenticated;

-- Regenerate the member join code.
create or replace function regenerate_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text;
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') for 6));
  update organizations set join_code = v_code where id = app_user_org();
  return v_code;
end;
$$;
grant execute on function regenerate_join_code() to authenticated;
