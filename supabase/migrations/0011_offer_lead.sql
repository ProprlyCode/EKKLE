-- /offer email gate: capture the lead up front, then open the study.
--
-- The clean one-page offer collects first name + email before the study. This
-- creates/updates the recipient (email + consent) attributed to the resolved
-- member, and returns the member's slug so the client routes into /r/<slug>.

create or replace function register_offer_lead(
  p_session_token text, p_ref text, p_first_name text, p_email text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_member users;
  v_recipient recipients;
begin
  v_slug := resolve_offer_member(p_ref);
  if v_slug is null then return null; end if;

  select * into v_member from users where code_slug = v_slug limit 1;

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
           consented_at = coalesce(consented_at, now()),
           arrival_member_id = coalesce(arrival_member_id, v_member.id)
     where id = v_recipient.id;
  end if;

  return v_slug;
end;
$$;

grant execute on function register_offer_lead(text, text, text, text) to anon, authenticated;
