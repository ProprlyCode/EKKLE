-- The ministry team (0030): invitations by role, role changes, cancelling
-- invitations, and the join code switch — the ministry permission table.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into organizations (id, slug, name, join_code)
  values ('a0000000-0000-0000-0000-00000000000b', 'mt', 'Mount Tabor', 'TABOR1');
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'admin@mt.test'),
  ('a1000000-0000-0000-0000-000000000002', 'leader@mt.test'),
  ('a1000000-0000-0000-0000-000000000003', 'joiner@mt.test'),
  ('a1000000-0000-0000-0000-000000000004', 'invitee@mt.test');
insert into users (id, org_id, auth_uid, name, role, code_slug, email) values
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000b',
   'a1000000-0000-0000-0000-000000000001', 'Ann', 'admin', 'mt-ann', 'admin@mt.test'),
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000b',
   'a1000000-0000-0000-0000-000000000002', 'Leo', 'leader', 'mt-leo', 'leader@mt.test');

set local role authenticated;
set local "request.headers" to '{"origin":"https://mt.ekkle.org"}';

-- ---- Leaders ----
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((invite_member('Mia', 'mia@mt.test')).role, 'member', 'a Leader invites a Member');
select throws_ok($$ select invite_member('Lou', 'lou@mt.test', 'leader') $$, 'P0001', 'forbidden',
  'a Leader cannot invite a Leader');
select throws_ok($$ select invite_member('Mia again', 'MIA@mt.test') $$, 'P0001', 'already_member',
  'the same email can''t be invited twice');
select throws_ok($$ select set_member_role('a2000000-0000-0000-0000-000000000002', 'admin') $$, 'P0001', 'forbidden',
  'a Leader cannot change roles (not even their own)');
select throws_ok($$ select set_join_enabled(false) $$, 'P0001', 'forbidden', 'a Leader cannot turn off the join code');

-- ---- Admins ----
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((invite_member('Ivy', 'invitee@mt.test', 'leader')).role, 'leader', 'an Admin invites a Leader');
select throws_ok($$ select set_member_role('a2000000-0000-0000-0000-000000000001', 'leader') $$, 'P0001', 'last_admin',
  'the last Admin cannot step down');
select is((set_member_role('a2000000-0000-0000-0000-000000000002', 'admin')).role, 'admin', 'an Admin makes a Leader an Admin');
select is((set_member_role('a2000000-0000-0000-0000-000000000001', 'member')).role, 'member',
  '…and then can step down, since another Admin remains');

-- Cancelling invitations (now Leo is the Admin).
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select cancel_invitation((select id from users where email = 'mia@mt.test')) $$,
  'an invitation can be cancelled');
select throws_ok($$ select cancel_invitation('a2000000-0000-0000-0000-000000000001') $$, 'P0001', 'invitation_not_found',
  'someone who has joined can''t be "cancelled"');

-- ---- The join code switch ----
select lives_ok($$ select set_join_enabled(false) $$, 'an Admin turns off the join code');
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$ select claim_membership('TABOR1', 'Jo') $$, 'P0001', 'invalid_join_code',
  'with the join code off, the code doesn''t let anyone in');
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((claim_membership('', 'Ivy')).role, 'leader', '…but an invitation still works, with its role');

-- Members still can't see the team.
select is((select count(*)::int from users where org_id = 'a0000000-0000-0000-0000-00000000000b'), 3,
  '(as a Leader, Ivy now sees the team)');

select * from finish();
rollback;
