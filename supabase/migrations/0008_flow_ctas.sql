-- Editable ending + CTAs per flow.
--
-- A flow's final screen is no longer hardcoded to "message the member". Each
-- flow carries its own ending headline/body and a list of CTAs, so a flow can
-- aim at a conversation, a video, a song, a resource — whatever the admin wants.
--
-- ctas shape: [{ "label": text, "kind": "message" | "link", "url": text|null }]
-- Empty ctas / blank headline → the recipient view falls back to sensible
-- defaults (a single "message the member" action).

alter table sequences
  add column if not exists connect_headline text not null default '',
  add column if not exists connect_body text not null default '',
  add column if not exists ctas jsonb not null default '[]'::jsonb;

-- Landing now also returns the flow's ending config.
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
