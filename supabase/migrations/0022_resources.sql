-- 0022 — Resources: church-approved reading, video and links for Your space.
--
-- The tables have existed since 0001 (Phase B). This adds what a resource
-- needs to be more than text — a kind and a URL — plus:
--   * set_resource_topics(): leaders tag a resource with topics by name.
--   * seeker_resources() / seeker_resource(): a signed-in seeker reads the
--     *published* resources of their own church. Seekers aren't church users,
--     so table policies don't reach them; these functions are the only way in.
-- Leaders keep writing through the existing table policies (0002).

alter table resources
  add column if not exists kind text not null default 'text'
    check (kind in ('text', 'video', 'link')),
  add column if not exists url text;

-- Leaders: replace a resource's topics with this list of names.
create or replace function public.set_resource_topics(p_resource_id uuid, p_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_name text;
  v_tag uuid;
begin
  select org_id into v_org from resources where id = p_resource_id;
  if v_org is null or v_org <> app_user_org() or not is_leadership() then
    raise exception 'forbidden';
  end if;

  delete from resource_tags where resource_id = p_resource_id;
  foreach v_name in array coalesce(p_names, '{}') loop
    v_name := nullif(trim(v_name), '');
    continue when v_name is null;
    insert into tags (org_id, name) values (v_org, v_name)
      on conflict (org_id, name) do update set name = excluded.name
      returning id into v_tag;
    insert into resource_tags (resource_id, tag_id) values (p_resource_id, v_tag)
      on conflict do nothing;
  end loop;

  -- Topics nothing uses any more.
  delete from tags t where t.org_id = v_org
    and not exists (select 1 from resource_tags rt where rt.tag_id = t.id);
end;
$$;
revoke execute on function public.set_resource_topics(uuid, text[]) from public, anon;
grant execute on function public.set_resource_topics(uuid, text[]) to authenticated;

-- Seekers: the published library of their church (no bodies — see below).
create or replace function public.seeker_resources()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rec recipients;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'title', r.title, 'blurb', r.blurb, 'kind', r.kind,
      'topics', coalesce((
        select jsonb_agg(t.name order by t.name)
        from resource_tags rt join tags t on t.id = rt.tag_id
        where rt.resource_id = r.id), '[]'::jsonb)
    ) order by r.sort_order, r.created_at desc)
    from resources r
    where r.org_id = v_rec.org_id and r.status = 'approved'
  ), '[]'::jsonb);
end;
$$;

-- Seekers: one published resource, in full.
create or replace function public.seeker_resource(p_resource_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rec recipients;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  return (
    select jsonb_build_object(
      'id', r.id, 'title', r.title, 'blurb', r.blurb, 'kind', r.kind,
      'url', r.url, 'body', r.body,
      'topics', coalesce((
        select jsonb_agg(t.name order by t.name)
        from resource_tags rt join tags t on t.id = rt.tag_id
        where rt.resource_id = r.id), '[]'::jsonb))
    from resources r
    where r.id = p_resource_id and r.org_id = v_rec.org_id and r.status = 'approved'
  );
end;
$$;

revoke execute on function public.seeker_resources() from public, anon;
revoke execute on function public.seeker_resource(uuid) from public, anon;
grant execute on function public.seeker_resources() to authenticated;
grant execute on function public.seeker_resource(uuid) to authenticated;
