-- 0025 — The accent colour's contrast check (0024) lived in the locked-down
-- `private` schema, so the table's CHECK failed with "permission denied" for
-- anyone but the owner — even the service key couldn't update an account.
-- It's plain arithmetic on a colour, so it moves to a public, immutable
-- function anyone may call; set_account_branding() keeps using it.

create or replace function public.accent_contrast_on_page(p_hex text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  ch numeric;
  lum numeric := 0;
  page numeric := 0.8808; -- relative luminance of the page, #f4f1ea
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
grant execute on function public.accent_contrast_on_page(text) to public;

alter table organizations drop constraint if exists organizations_accent_color_check;
alter table organizations add constraint organizations_accent_color_check
  check (accent_color is null or (accent_color ~ '^#[0-9a-f]{6}$'
                                  and public.accent_contrast_on_page(accent_color) >= 4.5));

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
                               or accent_contrast_on_page(v_accent) < 4.5) then
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

drop function if exists private.contrast_on_page(text);
