-- 0021 — re-apply get_recipient_landing() as 0008 defines it.
--
-- The live database never got 0008's version of this function (migrations
-- were pasted by hand before CI), so the landing it returns has no `connect`
-- block and the member-link flow's final screen ("someone here would love to
-- talk" / Message) crashed for seekers. Staging, built from migrations, was
-- fine. This re-creates the function unchanged; a no-op where it's current.
-- (A drift check on 2026-09-27 found no other schema, policy or grant drift.)

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
  select * into v_member from users where code_slug = p_slug and active = true limit 1;
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
