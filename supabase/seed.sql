-- Seed data for local development and the pilot.
--
-- Members/leaders here have no auth_uid yet — they link to a Supabase auth
-- account on first magic-link sign-in (matched by email in the Sprint 2 signup
-- flow). The approved gospel sequence + a member with a code_slug is enough to
-- exercise the recipient experience (/r/:slug) immediately.

-- Deterministic IDs so re-seeding is idempotent and easy to reference.
insert into organizations (id, slug, name, join_code)
values ('00000000-0000-0000-0000-0000000000a1', 'pilot', 'Grace Chapel (pilot)', 'GATHER')
on conflict (id) do nothing;

-- Leadership user (also a member: has their own code_slug + message).
insert into users (id, org_id, name, role, code_slug, short_message)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1',
  'Sarah (leader)',
  'leadership',
  'sarah',
  'Would love to grab a coffee and talk.'
) on conflict (id) do nothing;

-- Ordinary member.
insert into users (id, org_id, name, role, code_slug, short_message)
values (
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000a1',
  'David',
  'member',
  'david',
  'Thought of you — no pressure at all.'
) on conflict (id) do nothing;

-- The one v1 sequence: gospel introduction, approved.
insert into sequences (id, org_id, title, type, status)
values (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1',
  'A gentle introduction',
  'gospel',
  'approved'
) on conflict (id) do nothing;

-- Four screens (placeholder copy, on-brand — leadership edits in the builder).
insert into sequence_screens (sequence_id, sort_order, headline, body, icon)
values
  ('00000000-0000-0000-0000-0000000000c1', 0,
   'life carries a lot',
   'Fear, stress, the weight of not knowing how things will turn out — most of us carry more than we say out loud. Before anything else: that''s worth taking seriously.',
   null),
  ('00000000-0000-0000-0000-0000000000c1', 1,
   'you''re not the only one who''s felt it',
   'Jesus wasn''t distant from any of this. He knew exhaustion, grief, being let down by people close to him. Whatever you''re carrying, he''s been near it himself.',
   null),
  ('00000000-0000-0000-0000-0000000000c1', 2,
   'this is an invitation, not a pitch',
   'At the center of it is something simpler than a set of beliefs: the chance to actually know him — personally, honestly, as you are right now.',
   null),
  ('00000000-0000-0000-0000-0000000000c1', 3,
   'someone here would love to talk',
   'This was shared with you because they''d genuinely welcome a conversation — no pressure, no script. Or you can sit with it a while. Both are okay.',
   null)
on conflict do nothing;

-- Resources (Your space): a published reading and link, one draft.
insert into resources (id, org_id, title, blurb, body, kind, url, status, sort_order) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
   'Where to start reading',
   'A gentle first path through the Bible, if you''ve never known where to begin.',
   'Start with the Gospel of John. It was written so that you might believe — and it reads like a friend telling you about someone they knew.

Read a chapter a day. Notice what surprises you, and write down one question. Bring it to your next conversation.',
   'text', null, 'approved', 1),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1',
   'BibleProject',
   'Short animated videos that walk through every book of the Bible.',
   'A good companion to the studies — pick the book you''re reading.', 'link', 'https://bibleproject.com', 'approved', 2),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1',
   'Draft: not ready yet', 'Leaders only.', '', 'text', null, 'draft', 3)
on conflict do nothing;

insert into tags (id, org_id, name) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Getting started'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'The big picture')
on conflict do nothing;

insert into resource_tags (resource_id, tag_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f2')
on conflict do nothing;
