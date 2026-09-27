-- 0024 — Branding (docs/tenancy.md, phase 2): each account shows its own name,
-- logo and accent colour.
--
--   * organizations.accent_color: '#rrggbb', or null for Ekklē's sage. It must
--     read clearly: light page text sits on it (buttons) and it sits on the
--     light page (links, highlights), so it needs 4.5:1 contrast with the page.
--   * organizations.logo_path: the logo in the public `branding` bucket, at
--     <org id>/<version>/logo.<ext>; the app icons generated from it sit beside
--     it (icon-192.png, icon-512.png).
--   * set_account_branding(): leaders of an account set its name, accent and logo.
--   * resolve_account() also returns the accent and logo, for the account's pages.

-- WCAG contrast of a colour against the page background (#f4f1ea).
create or replace function private.contrast_on_page(p_hex text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  c numeric[];
  ch numeric;
  lum numeric := 0;
  page numeric := 0.8808; -- relative luminance of #f4f1ea
  w numeric[] := array[0.2126, 0.7152, 0.0722];
  i int;
begin
  if p_hex !~ '^#[0-9a-f]{6}$' then return 0; end if;
  for i in 0..2 loop
    ch := ('x' || substr(p_hex, 2 + i * 2, 2))::bit(8)::int / 255.0;
    ch := case when ch <= 0.03928 then ch / 12.92 else power((ch + 0.055) / 1.055, 2.4) end;
    lum := lum + w[i + 1] * ch;
  end loop;
  return (page + 0.05) / (lum + 0.05);
end;
$$;

alter table organizations
  add column if not exists accent_color text
    check (accent_color is null or (accent_color ~ '^#[0-9a-f]{6}$'
                                    and private.contrast_on_page(accent_color) >= 4.5)),
  add column if not exists logo_path text;

-- The logo and icons are public (they appear on public pages and home screens).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leaders write only inside their own account's folder.
drop policy if exists "branding: leaders upload" on storage.objects;
drop policy if exists "branding: leaders replace" on storage.objects;
drop policy if exists "branding: leaders remove" on storage.objects;
create policy "branding: leaders upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and public.is_leadership()
              and (storage.foldername(name))[1] = public.app_user_org()::text);
create policy "branding: leaders replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and public.is_leadership()
         and (storage.foldername(name))[1] = public.app_user_org()::text);
create policy "branding: leaders remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and public.is_leadership()
         and (storage.foldername(name))[1] = public.app_user_org()::text);

-- An account as its pages see it.
create or replace function private.account_json(o organizations)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'name', o.name, 'subdomain', o.subdomain,
                            'custom_domain', o.custom_domain, 'kind', o.kind,
                            'accent_color', o.accent_color, 'logo_path', o.logo_path);
$$;

create or replace function public.resolve_account(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select private.account_json(o) from organizations o where o.id = account_for_host(p_host);
$$;

-- Leaders: the account's name, accent colour and logo.
create or replace function public.set_account_branding(
  p_name text, p_accent_color text, p_logo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := app_user_org();
  v_accent text := nullif(lower(trim(p_accent_color)), '');
  v_row organizations;
begin
  if v_org is null or not is_leadership() then raise exception 'forbidden'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'name_required'; end if;
  if v_accent is not null and (v_accent !~ '^#[0-9a-f]{6}$'
                               or private.contrast_on_page(v_accent) < 4.5) then
    raise exception 'accent_unreadable';
  end if;
  if p_logo_path is not null and p_logo_path not like v_org::text || '/%' then
    raise exception 'forbidden';
  end if;

  update organizations set
    name = trim(p_name),
    accent_color = v_accent,
    logo_path = p_logo_path
  where id = v_org
  returning * into v_row;
  return private.account_json(v_row);
end;
$$;

revoke execute on function public.set_account_branding(text, text, text) from public, anon;
grant execute on function public.set_account_branding(text, text, text) to authenticated;
revoke execute on function private.contrast_on_page(text) from public;
revoke execute on function private.account_json(organizations) from public;
