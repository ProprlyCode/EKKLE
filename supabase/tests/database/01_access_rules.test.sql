-- Access rules: who can see and do what.
--
-- Two churches (A, B). In A: two members, a leader, and a recipient talking to
-- each member. In B: one member and a recipient. Every check below is a
-- safeguarding promise the product makes — if one of these fails, a real
-- person's conversation could be seen or touched by the wrong person.
--
-- Runs in CI via `supabase test db` against a fresh database (migrations +
-- seed). Everything happens inside a transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'a-member-1@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'a-member-2@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'a-leader@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'b-member@test.local');

insert into organizations (id, slug, name, join_code) values
  ('20000000-0000-0000-0000-00000000000a', 'test-church-a', 'Church A', 'TESTA'),
  ('20000000-0000-0000-0000-00000000000b', 'test-church-b', 'Church B', 'TESTB');

insert into users (id, org_id, auth_uid, name, role, code_slug, email) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a',
   '10000000-0000-0000-0000-000000000001', 'A member 1', 'member', 'test-a1', 'a-member-1@test.local'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a',
   '10000000-0000-0000-0000-000000000002', 'A member 2', 'member', 'test-a2', 'a-member-2@test.local'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000a',
   '10000000-0000-0000-0000-000000000003', 'A leader', 'leadership', 'test-alead', 'a-leader@test.local'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-00000000000b',
   '10000000-0000-0000-0000-000000000004', 'B member', 'member', 'test-b1', 'b-member@test.local');

insert into recipients (id, org_id, first_name, email, session_token) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', 'Rae', 'rae@test.local', 'tok-a1'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', 'Kit', 'kit@test.local', 'tok-a2'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000b', 'Lou', 'lou@test.local', 'tok-b1');

insert into conversations (id, org_id, member_id, recipient_id) values
  ('50000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a',
   '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a',
   '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-00000000000b',
   '30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003');

insert into messages (conversation_id, sender_type, body) values
  ('50000000-0000-0000-0000-0000000000a1', 'recipient', 'hello from Rae'),
  ('50000000-0000-0000-0000-0000000000a2', 'recipient', 'hello from Kit'),
  ('50000000-0000-0000-0000-0000000000b1', 'recipient', 'hello from Lou');

-- The waitlist is reachable only through join_waitlist(): row security on and
-- no policies at all, so no one can read or edit it over the API.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.waitlist'::regclass)
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'waitlist'),
  'waitlist: locked to everyone except join_waitlist()');

-- ---------------------------------------------------------------------------
-- Anonymous visitor (the public API, no sign-in)
-- ---------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select is((select count(*)::int from users), 0, 'anon: cannot list members');
select is((select count(*)::int from recipients), 0, 'anon: cannot list recipients');
select is((select count(*)::int from conversations), 0, 'anon: cannot list conversations');
select is((select count(*)::int from messages), 0, 'anon: cannot read messages');

select ok(
  get_recipient_conversation('tok-a1', '50000000-0000-0000-0000-0000000000a1') is not null,
  'recipient: can open their own conversation with their session token');
select ok(
  get_recipient_conversation('tok-a1', '50000000-0000-0000-0000-0000000000a2') is null,
  'recipient: cannot open someone else''s conversation');
select throws_ok(
  $$ select send_recipient_message('tok-a1', '50000000-0000-0000-0000-0000000000a2', 'hi') $$,
  'P0001', 'not_found',
  'recipient: cannot post into someone else''s conversation');
select lives_ok(
  $$ select join_waitlist('Test', 'waitlist-test@test.local', 'Test Church') $$,
  'anon: can join the waitlist');
select throws_ok(
  $$ select _seeker_rec() $$,
  '42501', null,
  'anon: internal helpers are not callable over the API (0018)');

-- ---------------------------------------------------------------------------
-- Member A1
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from conversations), 1, 'member: sees only their own conversation');
select is((select count(*)::int from messages), 1, 'member: reads only their own conversation''s messages');
select is((select count(*)::int from recipients), 1, 'member: sees only the recipient they are talking to');
select is(
  (select count(*)::int from users where org_id = '20000000-0000-0000-0000-00000000000b'), 0,
  'member: cannot see another church''s members');
select throws_ok(
  $$ insert into messages (conversation_id, sender_type, body)
     values ('50000000-0000-0000-0000-0000000000a2', 'member', 'hijack') $$,
  '42501', null,
  'member: cannot post into another member''s conversation');
select throws_ok(
  $$ select list_reports() $$,
  'P0001', 'forbidden',
  'member: cannot read incident reports');
select throws_ok(
  $$ select erase_conversation('50000000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'forbidden',
  'member: cannot erase another member''s conversation');

-- ---------------------------------------------------------------------------
-- Leader of church A — awareness, not access
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from conversations), 2,
  'leader: sees that their church''s conversations exist (metadata)');
select is((select count(*)::int from messages), 0,
  'leader: cannot read any message contents');
select is((select count(*)::int from recipients), 0,
  'leader: cannot read recipient contact details');
select lives_ok($$ select list_reports() $$, 'leader: can read incident reports');

-- ---------------------------------------------------------------------------
-- Member of church B
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::int from conversations where org_id = '20000000-0000-0000-0000-00000000000a'), 0,
  'other church: cannot see church A''s conversations');
select is(
  (select count(*)::int from users where org_id = '20000000-0000-0000-0000-00000000000a'), 0,
  'other church: cannot see church A''s members');

select * from finish();
rollback;
