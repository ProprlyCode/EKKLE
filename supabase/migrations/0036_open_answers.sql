-- 0036 — Blanks with no set answer.
--
-- Some blanks ask for the person's own thoughts, so there is no right answer.
-- The editor marks them "No set answer"; they publish as an empty answer, and
-- after submitting people see "Your own words" beside what they wrote. Publish
-- still needs exactly one entry per blank.

create or replace function publish_study(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_study studies;
  v_draft jsonb;
  v_answers text[];
  v_page jsonb;
  v_n int := 0;
begin
  v_study := private.editable_study(p_id);
  v_draft := v_study.draft;
  if v_draft is null then return; end if;
  if char_length(trim(coalesce(v_draft ->> 'title', ''))) = 0 then raise exception 'title_required'; end if;
  if jsonb_array_length(coalesce(v_draft -> 'pages', '[]'::jsonb)) = 0 then raise exception 'no_pages'; end if;
  select coalesce(array_agg(trim(a) order by ord), '{}') into v_answers
    from jsonb_array_elements_text(coalesce(v_draft -> 'answers', '[]'::jsonb)) with ordinality as t(a, ord);
  -- One answer per blank; '' is a blank with no set answer (their own words).
  if coalesce(array_length(v_answers, 1), 0) <> private.count_blanks(v_draft -> 'pages') then
    raise exception 'answers_mismatch';
  end if;

  update studies
     set title = trim(v_draft ->> 'title'), tagline = nullif(trim(v_draft ->> 'tagline'), ''),
         answers = v_answers, status = 'approved', draft = null
   where id = v_study.id;
  delete from study_pages where study_id = v_study.id;
  for v_page in select * from jsonb_array_elements(v_draft -> 'pages') loop
    v_n := v_n + 1;
    insert into study_pages (study_id, page_number, blocks)
    values (v_study.id, v_n, coalesce(v_page -> 'blocks', '[]'::jsonb));
  end loop;
end;
$$;

