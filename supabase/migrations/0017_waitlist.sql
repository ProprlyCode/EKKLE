-- Homepage waitlist: the one ask on ekkle.org/ ("Join the waitlist").
--
-- Anonymous visitors submit name + email + ministry through a SECURITY DEFINER RPC.
-- The table itself is deny-by-default (RLS on, no policies, no direct grants) — the
-- platform owner reviews it in the Supabase table editor and issues signup codes.
-- Re-submitting the same email updates the entry rather than duplicating it.

create table if not exists waitlist (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default '',
  email          text not null unique,          -- stored lowercased
  ministry_name  text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table waitlist enable row level security;

create or replace function join_waitlist(p_name text, p_email text, p_ministry text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;

  insert into waitlist (name, email, ministry_name)
  values (left(trim(coalesce(p_name, '')), 120), v_email,
          left(trim(coalesce(p_ministry, '')), 160))
  on conflict (email) do update
    set name = coalesce(nullif(excluded.name, ''), waitlist.name),
        ministry_name = coalesce(nullif(excluded.ministry_name, ''), waitlist.ministry_name),
        updated_at = now();
end;
$$;

grant execute on function join_waitlist(text, text, text) to anon, authenticated;
