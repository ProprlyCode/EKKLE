-- 0048 — Flow templates: introductions written for everyday situations.
--
--   * The Ekklē team writes and publishes them in Platform → Flow templates
--     (situation, title, "when to use it", screens and ending). Personal ones
--     are for members to share face to face; public ones are for posters,
--     clothing and welcome tables (ministry codes, a later step).
--   * A ministry's Admins and Leaders see the published ones in Content and
--     copy one into their own flows to edit freely (0049). Later changes to a
--     template never touch a copy.
--   * Ekklē's starting set arrives as drafts: nobody sees them until they're
--     published.

create table if not exists flow_templates (
  id                uuid primary key default gen_random_uuid(),
  situation         text not null check (char_length(trim(situation)) between 1 and 40),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 30),
  title             text not null check (char_length(trim(title)) between 1 and 120),
  when_to_use       text not null default '' check (char_length(when_to_use) <= 300),
  audience          text not null default 'personal' check (audience in ('personal', 'public')),
  screens           jsonb not null default '[]'::jsonb check (jsonb_typeof(screens) = 'array'),
  connect_headline  text not null default '',
  connect_body      text not null default '',
  ctas              jsonb not null default '[]'::jsonb check (jsonb_typeof(ctas) = 'array'),
  status            text not null default 'draft' check (status in ('draft', 'published')),
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table flow_templates enable row level security;
revoke all on flow_templates from anon, authenticated;
drop trigger if exists flow_templates_updated_at on flow_templates;
create trigger flow_templates_updated_at before update on flow_templates
  for each row execute function set_updated_at();

create or replace function private.flow_template_json(t flow_templates)
returns jsonb language sql stable set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id, 'situation', t.situation, 'slug', t.slug, 'title', t.title,
    'when_to_use', t.when_to_use, 'audience', t.audience, 'screens', t.screens,
    'connect', jsonb_build_object('headline', t.connect_headline, 'body', t.connect_body, 'ctas', t.ctas),
    'status', t.status, 'sort_order', t.sort_order);
$$;
revoke execute on function private.flow_template_json(flow_templates) from public;

-- Screens as written: [{headline, body}], at least one with words.
create or replace function private.clean_screens(p_screens jsonb)
returns jsonb language sql immutable set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'headline', left(coalesce(s ->> 'headline', ''), 200),
           'body', left(coalesce(s ->> 'body', ''), 2000)) order by n), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_screens) = 'array' then p_screens else '[]'::jsonb end)
       with ordinality as x(s, n)
  where trim(coalesce(s ->> 'headline', '') || coalesce(s ->> 'body', '')) <> '';
$$;
revoke execute on function private.clean_screens(jsonb) from public;

-- Buttons as written: [{label, kind: message|link, url}].
create or replace function private.clean_ctas(p_ctas jsonb)
returns jsonb language sql immutable set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'label', left(coalesce(c ->> 'label', ''), 60),
           'kind', case when c ->> 'kind' = 'link' then 'link' else 'message' end,
           'url', case when c ->> 'kind' = 'link' then nullif(left(coalesce(c ->> 'url', ''), 500), '') end)
         order by n), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_ctas) = 'array' then p_ctas else '[]'::jsonb end)
       with ordinality as x(c, n);
$$;
revoke execute on function private.clean_ctas(jsonb) from public;

-- The Ekklē team: every template, drafts included.
create or replace function platform_flow_templates()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_platform_member() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(private.flow_template_json(t) order by t.audience, t.sort_order, t.created_at)
                   from flow_templates t), '[]'::jsonb);
end;
$$;

create or replace function save_flow_template(
  p_id uuid, p_situation text, p_slug text, p_title text, p_when_to_use text, p_audience text,
  p_screens jsonb, p_connect_headline text, p_connect_body text, p_ctas jsonb, p_status text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_screens jsonb := private.clean_screens(p_screens);
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_situation, ''))) = 0 or char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'missing';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 30 then
    raise exception 'invalid_slug';
  end if;
  if exists (select 1 from flow_templates where slug = p_slug and id is distinct from p_id) then
    raise exception 'slug_taken';
  end if;
  if p_status = 'published' and jsonb_array_length(v_screens) = 0 then raise exception 'no_screens'; end if;
  if p_id is null then
    insert into flow_templates (situation, slug, title, when_to_use, audience, screens,
                                connect_headline, connect_body, ctas, status, sort_order)
    values (trim(p_situation), p_slug, trim(p_title), trim(coalesce(p_when_to_use, '')),
            case when p_audience = 'public' then 'public' else 'personal' end, v_screens,
            trim(coalesce(p_connect_headline, '')), trim(coalesce(p_connect_body, '')), private.clean_ctas(p_ctas),
            case when p_status = 'published' then 'published' else 'draft' end,
            coalesce((select max(sort_order) + 1 from flow_templates), 0))
    returning id into v_id;
  else
    update flow_templates
       set situation = trim(p_situation), slug = p_slug, title = trim(p_title),
           when_to_use = trim(coalesce(p_when_to_use, '')),
           audience = case when p_audience = 'public' then 'public' else 'personal' end,
           screens = v_screens, connect_headline = trim(coalesce(p_connect_headline, '')),
           connect_body = trim(coalesce(p_connect_body, '')), ctas = private.clean_ctas(p_ctas),
           status = case when p_status = 'published' then 'published' else 'draft' end
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function delete_flow_template(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not is_platform_admin() then raise exception 'forbidden'; end if;
  delete from flow_templates where id = p_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['platform_flow_templates()',
      'save_flow_template(uuid, text, text, text, text, text, jsonb, text, text, jsonb, text)',
      'delete_flow_template(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Ekklē's starting set, as drafts for the Ekklē team to edit and publish.
-- ---------------------------------------------------------------------------
insert into flow_templates (situation, slug, title, when_to_use, audience, screens,
                            connect_headline, connect_body, sort_order)
values
('Over coffee', 'coffee', 'Thanks for the conversation',
 'After a real conversation over coffee or a meal, when faith came up or nearly did.',
 'personal',
 '[{"headline":"thanks for the conversation","body":"Whatever we talked about, I’m glad we did. This is something I keep coming back to, and I wanted you to have it too."},
   {"headline":"most of us are looking for something","body":"Rest. Meaning. Someone who really sees us. Those longings aren’t a weakness — they point somewhere."},
   {"headline":"Jesus kept showing up at tables","body":"He ate with people others avoided, and asked the questions nobody else asked. He still meets people where they are — over coffee included."}]',
 'let’s keep talking',
 'If anything here stirred a question, I’d love to hear it. No pressure, no script — just the next conversation.',
 1),
('Just met', 'just-met', 'Good to meet you',
 'Someone you’ve only just met — on a train, at the gym, in a queue — who was open to more.',
 'personal',
 '[{"headline":"good to meet you","body":"We’ve only just met, so thank you for opening this. It’s short, and it’s something that matters a great deal to me."},
   {"headline":"why I carry this","body":"My faith isn’t a set of rules I keep. It’s a relationship with Jesus that changed how I see people — strangers included."},
   {"headline":"you’re not a project","body":"I’m not trying to win an argument. I just think you’re worth knowing, and so is he."}]',
 'if you’d like to talk',
 'Send me a message any time. I’ll reply personally — and if not, it was still good to meet you.',
 2),
('Someone grieving', 'grief', 'You don’t have to carry this alone',
 'Someone who has lost a person they love. Share gently, and only when it feels welcome.',
 'personal',
 '[{"headline":"I’m so sorry","body":"There are no right words for loss, and this isn’t trying to be them. I just didn’t want you to feel alone in it."},
   {"headline":"grief is love with nowhere to go","body":"However you’re feeling — numb, angry, exhausted, all of it at once — it makes sense. There’s no right way to do this."},
   {"headline":"Jesus wept too","body":"When his friend Lazarus died, Jesus stood at the grave and cried. He doesn’t hurry us past our grief. He comes close to it."},
   {"headline":"a promise worth holding","body":"“The Lord is close to the brokenhearted and saves those who are crushed in spirit.” — Psalm 34:18"}]',
 'I’m here',
 'If you’d like to talk — about them, about how you’re doing, or about any of this — I’d be glad to listen. Whenever you’re ready.',
 3),
('Going through a hard time', 'hard-time', 'For a heavy season',
 'Someone carrying stress, illness, a broken relationship or a season that won’t lift.',
 'personal',
 '[{"headline":"life carries a lot","body":"Fear, stress, the weight of not knowing how things will turn out. Most of us carry more than we say out loud."},
   {"headline":"you don’t have to be okay","body":"This isn’t a pep talk. Some seasons are just hard, and pretending otherwise doesn’t help."},
   {"headline":"he isn’t distant from this","body":"Jesus knew exhaustion, rejection and being let down by people close to him. Whatever you’re carrying, he’s been near it himself."},
   {"headline":"an invitation","body":"“Come to me, all you who are weary and burdened, and I will give you rest.” — Matthew 11:28"}]',
 'can I walk with you?',
 'If it would help to talk, or if you’d like someone to pray for you, send me a message. I mean it.',
 4),
('Curious about faith', 'curious', 'Questions are welcome',
 'Someone with honest questions about God, the Bible or why you believe.',
 'personal',
 '[{"headline":"questions are welcome","body":"You don’t need to have it figured out to explore faith. Honest questions are a good place to start."},
   {"headline":"what Christians actually believe","body":"At the centre isn’t a religion of trying harder. It’s Jesus — who lived, died and rose again — offering to know us as we are."},
   {"headline":"you can look for yourself","body":"The Bible invites testing, not blind trust. There are free, short studies here if you’d like to read it with someone."}]',
 'ask me anything',
 'I don’t have every answer, but I’d love to explore your questions together. Send me one, big or small.',
 5),
('Poster or notice board', 'poster', 'You’re welcome here',
 'Printed on a poster, flyer or notice board — read by someone passing by, often alone.',
 'public',
 '[{"headline":"you’re welcome here","body":"Whoever you are and whatever brought you to this page, you’re welcome — no strings, no sign-up needed to read on."},
   {"headline":"what we’re about","body":"We’re ordinary people who have found real hope in Jesus, and we’d love to share it — and to hear your story too."},
   {"headline":"a different kind of hope","body":"Not a quick fix or a slogan. A relationship with God that holds up when life doesn’t."}]',
 'someone here would love to hear from you',
 'Send a message and a real person from our community will reply. Or simply look around — the free studies are here whenever you want them.',
 6),
('Worn on clothing', 'clothing', 'You scanned my shirt',
 'Printed on a T-shirt, hoodie or bag — someone was curious enough to scan it.',
 'public',
 '[{"headline":"you scanned it","body":"Curiosity is a good thing. Thanks for stopping to look."},
   {"headline":"why we wear this","body":"We wear it because something changed our lives, and we’re not embarrassed about that. It’s Jesus — and he’s not just for religious people."},
   {"headline":"the short version","body":"God made us, loves us and came close in Jesus, so we could know him — not because we earn it, but because he gives it."}]',
 'want to talk?',
 'Send a message and someone will reply personally. No pressure — and it was good of you to scan.',
 7),
('Event or welcome table', 'welcome-table', 'Glad you came',
 'At a welcome table, outreach event or church gathering — for someone who wants to stay in touch.',
 'public',
 '[{"headline":"glad you came","body":"Thanks for stopping by. We hope you felt welcome, whether this is your first time or your fiftieth."},
   {"headline":"what happens next","body":"Nothing you don’t want. If you’d like to stay in touch, ask a question or find out more, it’s one message away."},
   {"headline":"something to take with you","body":"There are free, short Bible studies here, at your own pace — and real people to talk them through with."}]',
 'stay in touch',
 'Send us a message and one of our team will reply personally.',
 8)
on conflict (slug) do nothing;
