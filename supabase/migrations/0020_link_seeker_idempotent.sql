-- 0020 — linking a seeker account is safe to call twice at once.
--
-- Arriving from a sign-in link fires more than one auth event, and each can
-- call link_seeker_account() before the other has inserted the seeker's row.
-- The second insert then hit recipients_session_token_key and the seeker saw
-- "We couldn't open your account". The insert now yields to the row that won.

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
          v_uid, v_member.id, now())
  -- Two sign-in events can call this at the same moment; the loser of that
  -- race finds the winner's row here instead of failing.
  on conflict (session_token) do nothing;
end;
$$;
