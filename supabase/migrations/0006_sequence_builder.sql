-- Sprint 3: sequence builder support.
--
-- Replacing a sequence's screens as one transactional operation (leadership
-- only), so a save can't half-apply. Status changes go through normal RLS
-- updates on `sequences`.

create or replace function replace_sequence_screens(
  p_sequence_id uuid, p_screens jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_screen jsonb;
  v_i int := 0;
begin
  if not is_leadership() then
    raise exception 'forbidden';
  end if;

  select org_id into v_org from sequences where id = p_sequence_id;
  if v_org is null or v_org <> app_user_org() then
    raise exception 'not_found';
  end if;

  delete from sequence_screens where sequence_id = p_sequence_id;

  for v_screen in select * from jsonb_array_elements(p_screens)
  loop
    insert into sequence_screens (sequence_id, sort_order, headline, body, icon)
    values (
      p_sequence_id,
      v_i,
      coalesce(v_screen->>'headline', ''),
      coalesce(v_screen->>'body', ''),
      nullif(v_screen->>'icon', '')
    );
    v_i := v_i + 1;
  end loop;
end;
$$;

grant execute on function replace_sequence_screens(uuid, jsonb) to authenticated;
