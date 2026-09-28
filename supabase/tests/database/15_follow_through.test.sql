-- Follow-through (0035): moving a conversation (who may, what the person
-- exploring then sees), and the 24h / 48h nudges (each once per wait).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into organizations (id, slug, name, join_code) values
  ('f0000000-0000-0000-0000-00000000000f', 'ft', 'Follow Ministry', 'FTFT01'),
  ('f0000000-0000-0000-0000-0000000000f2', 'ft2', 'Other Ministry', 'FTFT02');
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'leader@ft.test'),
  ('f1000000-0000-0000-0000-000000000002', 'ann@ft.test'),
  ('f1000000-0000-0000-0000-000000000003', 'ben@ft.test'),
  ('f1000000-0000-0000-0000-000000000004', 'seeker@ft.test'),
  ('f1000000-0000-0000-0000-000000000005', 'other@ft2.test');
insert into users (id, org_id, auth_uid, name, role, code_slug, email) values
  ('f2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f', 'f1000000-0000-0000-0000-000000000001', 'Lia', 'leader', 'ft-lia', 'leader@ft.test'),
  ('f2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f', 'f1000000-0000-0000-0000-000000000002', 'Ann', 'member', 'ft-ann', 'ann@ft.test'),
  ('f2000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f', 'f1000000-0000-0000-0000-000000000003', 'Ben', 'member', 'ft-ben', 'ben@ft.test'),
  ('f2000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-00000000000f', null, 'Invited', 'member', 'ft-inv', 'inv@ft.test'),
  ('f2000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-0000000000f2', 'f1000000-0000-0000-0000-000000000005', 'Oz', 'leader', 'ft-oz', 'other@ft2.test');
insert into recipients (id, org_id, first_name, email, session_token, auth_uid, arrival_member_id) values
  ('f3000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f', 'Sy', 'seeker@ft.test', 'ft-tok',
   'f1000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002'),
  ('f3000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f', 'Wes', 'wes@ft.test', 'ft-tok2', null, null),
  ('f3000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f', 'Rae', 'rae@ft.test', 'ft-tok3', null, null);
insert into conversations (id, org_id, member_id, recipient_id) values
  ('f4000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f',
   'f2000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f',
   'f2000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000002'),
  ('f4000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f',
   'f2000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000003');
insert into messages (conversation_id, sender_type, body, created_at) values
  -- Sy: waiting 3 days. Wes: waiting 30 hours. Rae: Ben replied.
  ('f4000000-0000-0000-0000-000000000001', 'recipient', 'Hello?', now() - interval '3 days'),
  ('f4000000-0000-0000-0000-000000000002', 'recipient', 'Hi', now() - interval '30 hours'),
  ('f4000000-0000-0000-0000-000000000003', 'recipient', 'Hey', now() - interval '3 days'),
  ('f4000000-0000-0000-0000-000000000003', 'member', 'Hi Rae!', now() - interval '2 days');

-- ---- Nudges (the scheduled job) ----
select ok(private.follow_up_due() >= 3, 'emails are due: Sy (member + leaders), Wes (member)');
select ok((select nudged_at is not null and escalated_at is not null from conversations
            where id = 'f4000000-0000-0000-0000-000000000001'), 'after 48 hours: member and leaders');
select ok((select nudged_at is not null and escalated_at is null from conversations
            where id = 'f4000000-0000-0000-0000-000000000002'), 'after 24 hours: the member only');
select ok((select nudged_at is null from conversations where id = 'f4000000-0000-0000-0000-000000000003'),
  'nobody is nudged about a conversation that has a reply');
select is(private.follow_up_due(), 0, 'each wait is nudged only once');

set local role authenticated;
set local "request.headers" to '{"origin":"https://ft.ekkle.org"}';

-- ---- Leaders see metadata and move conversations ----
set local "request.jwt.claims" to '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select leadership_conversations() $$, 'P0001', 'forbidden', 'a Member doesn''t see every conversation');
select throws_ok($$ select reassign_conversation('f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000003') $$,
  'P0001', 'forbidden', 'a Member can''t move conversations');

set local "request.jwt.claims" to '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from jsonb_array_elements(leadership_conversations()) c
            where c ? 'body' or c ? 'messages'), 0, 'leaders see no message contents');
select throws_ok($$ select reassign_conversation('f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000004') $$,
  'P0001', 'invalid_member', 'not to someone who hasn''t joined');
select throws_ok($$ select reassign_conversation('f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000005') $$,
  'P0001', 'invalid_member', 'not to another ministry');
select lives_ok($$ select reassign_conversation('f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000003') $$,
  'a Leader moves Sy''s conversation from Ann to Ben');

-- ---- The person exploring ----
set local "request.jwt.claims" to '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(seeker_connection() -> 'member' ->> 'name', 'Ben', 'Sy now talks with Ben in Your space');
select is((select m ->> 'body' from jsonb_array_elements(seeker_connection() -> 'messages') m
            where m ->> 'sender_type' = 'note'), 'You’re now talking with Ben.', '…with a note in the conversation');
select is(jsonb_array_length(seeker_connection() -> 'messages'), 2, '…and the history came along');

-- ---- The member it moved to ----
set local "request.jwt.claims" to '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select from_name from conversation_handoffs where conversation_id = 'f4000000-0000-0000-0000-000000000001'),
  'Ann', 'Ben sees who passed it on');

select * from finish();
rollback;
