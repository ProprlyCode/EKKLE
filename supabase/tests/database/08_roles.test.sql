-- Roles (0026, docs/accounts-and-roles.md): the platform team vs each
-- ministry's Admins / Leaders / Members, memberships per ministry chosen by
-- the address, and the promises in the permission tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Two ministries: Hope (hope.ekkle.org) and the seeded pilot (pilot.ekkle.org).
insert into organizations (id, slug, name, join_code)
  values ('60000000-0000-0000-0000-00000000000b', 'hope', 'Hope', 'HOPE26');

insert into auth.users (id, email) values
  ('61000000-0000-0000-0000-000000000001', 'admin@hope.test'),
  ('61000000-0000-0000-0000-000000000002', 'leader@hope.test'),
  ('61000000-0000-0000-0000-000000000003', 'member@hope.test'),
  ('61000000-0000-0000-0000-000000000004', 'support@ekkle.test'),
  ('61000000-0000-0000-0000-000000000005', 'newcomer@hope.test');

insert into users (id, org_id, auth_uid, name, role, code_slug, email) values
  ('62000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-00000000000b',
   '61000000-0000-0000-0000-000000000001', 'Ada', 'admin', 'r-ada', 'admin@hope.test'),
  ('62000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-00000000000b',
   '61000000-0000-0000-0000-000000000002', 'Lee', 'leader', 'r-lee', 'leader@hope.test'),
  ('62000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-00000000000b',
   '61000000-0000-0000-0000-000000000003', 'Mo', 'member', 'r-mo', 'member@hope.test'),
  -- Ada is also a plain member of the pilot ministry.
  ('62000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1',
   '61000000-0000-0000-0000-000000000001', 'Ada', 'member', 'r-ada-pilot', 'admin@hope.test');

insert into platform_team (email, role) values ('support@ekkle.test', 'support');

select is((select role from platform_team where email = 'jonathan@proprly.io'), 'owner',
  'the founder is the platform Owner');
select is((select role from users where email = 'jwoodhall24@gmail.com' limit 1), null::text,
  '(no founder ministry row in a fresh database — production converts it to admin)');

set local role authenticated;

-- ---- Memberships follow the address ----
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local "request.headers" to '{"origin":"https://hope.ekkle.org"}';
select ok(is_account_admin(), 'on hope.ekkle.org, Ada is Hope''s Admin');
set local "request.headers" to '{"origin":"https://pilot.ekkle.org"}';
select ok(not is_leadership(), 'on pilot.ekkle.org, the same login is only a Member');
select is(app_user_org(), '00000000-0000-0000-0000-0000000000a1'::uuid, '…of the pilot ministry');
set local "request.headers" to '{"origin":"https://ekkle.org"}';
select is(app_user_id(), null, 'on ekkle.org, no ministry membership applies');
select ok(not is_leadership(), '…so no ministry rights either');

-- ---- The team list ----
set local "request.headers" to '{"origin":"https://hope.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from users), 1, 'a Member sees only their own membership');
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from users where org_id = '60000000-0000-0000-0000-00000000000b'), 3,
  'a Leader sees the whole team');

-- ---- Nobody promotes themselves ----
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$ update users set role = 'admin' where id = '62000000-0000-0000-0000-000000000003' $$,
  '42501', null, 'a Member cannot change their own role');
select lives_ok($$ update users set short_message = 'hi' where id = '62000000-0000-0000-0000-000000000003' $$,
  'a Member can change their own message');

-- ---- Leaders vs Admins ----
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(is_leadership() and not is_account_admin(), 'Lee is a Leader, not an Admin');
select throws_ok($$ select set_account_branding('Mine', null, null) $$, 'P0001', 'forbidden',
  'a Leader cannot change the branding');
select throws_ok($$ select set_org_settings('Mine', null, true) $$, 'P0001', 'forbidden',
  'a Leader cannot change the settings');
select throws_ok($$ select regenerate_join_code() $$, 'P0001', 'forbidden',
  'a Leader cannot regenerate the join code');
select lives_ok($$ select set_member_active('62000000-0000-0000-0000-000000000003', false) $$,
  'a Leader can deactivate a Member');
select throws_ok($$ select set_member_active('62000000-0000-0000-0000-000000000001', false) $$,
  'P0001', 'forbidden', 'a Leader cannot deactivate an Admin');
select lives_ok($$ select invite_member('Nia', 'nia@hope.test') $$, 'a Leader can invite a Member');

set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select set_member_active('62000000-0000-0000-0000-000000000001', false) $$,
  'P0001', 'last_admin', 'the last active Admin cannot be deactivated');

-- ---- Joining ----
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok($$ select claim_membership('GATHER', 'New') $$, 'P0001', 'invalid_join_code',
  'another ministry''s join code doesn''t work on this address');
select is((select claim_membership('HOPE26', 'New')).role,
  'member', 'joining with this ministry''s code makes you a Member');

set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select regenerate_join_code() $$, 'an Admin can regenerate the join code');

-- ---- The platform team ----
set local "request.headers" to '{"origin":"https://ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select platform_accounts() $$, 'P0001', 'forbidden',
  'a ministry Admin is not on the platform team');
set local "request.jwt.claims" to '{"sub":"61000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(claim_platform_seat(), 'support', 'an invited platform member claims their seat by email');
select ok(jsonb_array_length(platform_accounts()) >= 2, 'Support sees every ministry account (metadata)');
select ok(not is_platform_admin(), 'Support is not a platform Admin');

select * from finish();
rollback;
