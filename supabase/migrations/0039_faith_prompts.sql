-- 0039 — Faith in action: ideas and prompts beside a member's code.
--
--   * Prompts in three kinds: everyday moments, sharing your code, and
--     conversation starters. Ekklē's (org_id null) are written by the Ekklē
--     team; a ministry's Admins and Leaders add their own.
--   * Members see "This week" — one prompt, the same for everyone in the
--     ministry, changing each week — and can browse the rest.
--   * Ekklē's starting set (drafted for Jonathan to edit) arrives as drafts:
--     nobody sees them until they're published in Platform → Prompts.

create table if not exists faith_prompts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations (id) on delete cascade, -- null: Ekklē's
  kind        text not null check (kind in ('moment', 'share', 'starter')),
  body        text not null check (char_length(trim(body)) between 1 and 400),
  status      text not null default 'published' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now()
);
create index if not exists faith_prompts_org_idx on faith_prompts (org_id, created_at);
alter table faith_prompts enable row level security;
revoke all on faith_prompts from anon, authenticated;

-- For members of this address: this week's prompt and all of them.
create or replace function faith_prompts()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org(); v_list jsonb; v_n int;
begin
  if app_user_id() is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'body', p.body)
                            order by (p.org_id is null), p.created_at, p.id), '[]'::jsonb)
    into v_list
    from faith_prompts p
   where p.status = 'published' and (p.org_id is null or p.org_id = v_org);
  v_n := jsonb_array_length(v_list);
  return jsonb_build_object(
    -- The same for everyone, turning over each Monday.
    'this_week', case when v_n > 0 then
      v_list -> ((floor((extract(epoch from date_trunc('week', now())) / 604800))::int % v_n)) end,
    'prompts', v_list);
end;
$$;

-- For writing them (Admins and Leaders; the Ekklē team for Ekklē's).
create or replace function prompt_library()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'body', p.body, 'status', p.status,
      'source', case when p.org_id is null then 'ekkle' else 'ministry' end,
      'editable', p.org_id is not distinct from v_scope
    ) order by (p.org_id is not distinct from v_scope) desc, p.created_at, p.id)
    from faith_prompts p
    where p.org_id is not distinct from v_scope
       or (v_scope is not null and p.org_id is null and p.status = 'published')
  ), '[]'::jsonb);
end;
$$;

create or replace function save_faith_prompt(p_id uuid, p_kind text, p_body text, p_status text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean; v_id uuid;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  if p_kind not in ('moment', 'share', 'starter') then raise exception 'invalid_kind'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'body_required'; end if;
  if p_id is null then
    insert into faith_prompts (org_id, kind, body, status)
    values (v_scope, p_kind, trim(p_body), case when p_status = 'draft' then 'draft' else 'published' end)
    returning id into v_id;
  else
    update faith_prompts set kind = p_kind, body = trim(p_body),
           status = case when p_status = 'draft' then 'draft' else 'published' end
     where id = p_id and org_id is not distinct from v_scope
    returning id into v_id;
    if v_id is null then raise exception 'forbidden'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function delete_faith_prompt(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_scope uuid; v_ok boolean;
begin
  select true, a.org_id into v_ok, v_scope from private.author_scope() a limit 1;
  if v_ok is null then raise exception 'forbidden'; end if;
  delete from faith_prompts where id = p_id and org_id is not distinct from v_scope;
  if not found then raise exception 'forbidden'; end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['faith_prompts()', 'prompt_library()', 'save_faith_prompt(uuid, text, text, text)',
      'delete_faith_prompt(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Ekklē's starting set — drafts for the Ekklē team to edit and publish.
insert into faith_prompts (org_id, kind, body, status, created_at) values
  (null, 'moment', 'Think of one person you''ll see this week who is carrying something heavy. Ask how they''re really doing — then listen.', 'draft', now() + interval '1 second'),
  (null, 'share', 'Save your code to your phone''s photos, so it''s ready the moment a conversation opens up.', 'draft', now() + interval '2 seconds'),
  (null, 'starter', '“What gives you hope when things are hard?”', 'draft', now() + interval '3 seconds'),
  (null, 'moment', 'Pray for three people by name this week. If one of them comes to mind again, reach out.', 'draft', now() + interval '4 seconds'),
  (null, 'share', 'After a meaningful conversation, try: “There’s a short, free study I found helpful — can I send it to you?”', 'draft', now() + interval '5 seconds'),
  (null, 'starter', '“What’s something you’ve been thinking about lately that you don’t get to talk about much?”', 'draft', now() + interval '6 seconds'),
  (null, 'moment', 'Share a meal or a coffee with someone outside your usual circle.', 'draft', now() + interval '7 seconds'),
  (null, 'share', 'Print your code on a small card and keep it in your wallet or phone case.', 'draft', now() + interval '8 seconds'),
  (null, 'starter', '“Did you grow up with any faith? What was that like?”', 'draft', now() + interval '9 seconds'),
  (null, 'moment', 'Notice a small kindness someone does, and tell them it mattered.', 'draft', now() + interval '10 seconds'),
  (null, 'share', 'Text your link to a friend with one personal line about why it mattered to you.', 'draft', now() + interval '11 seconds'),
  (null, 'starter', '“If you could ask God one question, what would it be?”', 'draft', now() + interval '12 seconds'),
  (null, 'moment', 'When a conversation turns to worry or loss, it’s okay to say: “I’ve found hope in Jesus — can I tell you how?”', 'draft', now() + interval '13 seconds'),
  (null, 'share', 'Tuck your code into a thank-you note or a card for someone who’s going through a hard time.', 'draft', now() + interval '14 seconds'),
  (null, 'starter', '“Where do you find peace when life gets loud?”', 'draft', now() + interval '15 seconds'),
  (null, 'moment', 'Offer practical help to a neighbour this week — a lift, a meal, an hour of your time.', 'draft', now() + interval '16 seconds'),
  (null, 'share', 'When someone asks about your faith, you don’t have to explain everything at once. Share your code and offer to talk more.', 'draft', now() + interval '17 seconds'),
  (null, 'starter', '“What do you think makes someone truly loved?”', 'draft', now() + interval '18 seconds'),
  (null, 'moment', 'Write down the name of one person you’d love to know Jesus. Keep them in mind — and in prayer — through the week.', 'draft', now() + interval '19 seconds'),
  (null, 'share', 'Add your link to your email signature or social profile, with a line like “Exploring faith? Start here.”', 'draft', now() + interval '20 seconds'),
  (null, 'starter', '“Have you ever wondered whether God is real — and what it would mean if he is?”', 'draft', now() + interval '21 seconds'),
  (null, 'moment', 'When someone thanks you, try: “Can I tell you why that matters to me?” — and keep it short.', 'draft', now() + interval '22 seconds'),
  (null, 'share', 'In a group chat where big questions come up, share your link with a word about why it helped you.', 'draft', now() + interval '23 seconds'),
  (null, 'starter', '“Is there anything I could be praying about for you this week?”', 'draft', now() + interval '24 seconds');
