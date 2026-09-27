-- Demo resources for Your space (staging, CI and local). A separate file so
-- databases that already ran seed.sql still pick these up.
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
