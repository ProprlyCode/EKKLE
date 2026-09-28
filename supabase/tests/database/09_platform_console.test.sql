-- The platform console (0029): creating and suspending ministry accounts, the
-- Ekklē team, and the waitlist — with the platform permission table.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 'owner@ekkle.test'),
  ('91000000-0000-0000-0000-000000000002', 'admin@ekkle.test'),
  ('91000000-0000-0000-0000-000000000003', 'support@ekkle.test');
-- Only this test's team (the founder's seat is set aside, inside the rollback).
delete from platform_team;
insert into platform_team (email, auth_uid, role) values
  ('owner@ekkle.test', '91000000-0000-0000-0000-000000000001', 'owner'),
  ('admin@ekkle.test', '91000000-0000-0000-0000-000000000002', 'admin'),
  ('support@ekkle.test', '91000000-0000-0000-0000-000000000003', 'support');

set local role authenticated;

-- ---- Support: read-only ----
set local "request.jwt.claims" to '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$ select platform_accounts(), platform_team_list(), platform_waitlist() $$,
  'Support sees accounts, the team and the waitlist');
select throws_ok($$ select platform_create_account('X', 'church', 'x-church', 'A', 'a@x.test') $$,
  'P0001', 'forbidden', 'Support cannot create accounts');
select throws_ok($$ select platform_set_account_status('00000000-0000-0000-0000-0000000000a1', 'suspended') $$,
  'P0001', 'forbidden', 'Support cannot suspend accounts');

-- ---- Admin: creates and suspends accounts ----
set local "request.jwt.claims" to '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(platform_subdomain_available('hope-city'), 'a free address is available');
select ok(not platform_subdomain_available('pilot'), 'a used address is not');
select ok(not platform_subdomain_available('admin'), 'a reserved address is not');
select is(platform_create_account('Hope City', 'church', 'Hope-City', 'Ada', 'ADA@hope.test') ->> 'subdomain',
  'hope-city', 'an Admin creates an account at its address');
select throws_ok($$ select platform_create_account('Again', 'church', 'hope-city', 'B', 'b@x.test') $$,
  'P0001', 'address_taken', 'an address can''t be used twice');
select throws_ok($$ select platform_create_account('Bad', 'church', '-bad-', 'B', 'b@x.test') $$,
  'P0001', 'invalid_address', 'a malformed address is refused');
select throws_ok($$ select platform_invite_member('new@ekkle.test', 'New', 'support') $$,
  'P0001', 'forbidden', 'an Admin cannot manage the team');

reset role;
select is((select role from users u join organizations o on o.id = u.org_id
           where o.subdomain = 'hope-city' and u.email = 'ada@hope.test' and u.auth_uid is null),
  'admin', 'the first Admin is invited (linked at first sign-in)');
select is((select count(*)::int from sequences s join organizations o on o.id = s.org_id
           where o.subdomain = 'hope-city' and s.status = 'approved'), 1,
  'a new account starts with an approved welcome flow');
select ok(public.auth_email_is_invitation('ada@hope.test', (select id from organizations where subdomain = 'hope-city')),
  'the sign-in email hook sees the invitation');

-- Suspending takes the address offline (but it still says who it is).
select set_config('test.hope', (select id::text from organizations where subdomain = 'hope-city'), true);
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select platform_set_account_status(current_setting('test.hope')::uuid, 'suspended') $$,
  'an Admin suspends an account');
reset role;
select is(account_for_host('hope-city.ekkle.org'), null, 'a suspended address resolves to no account');
select is(resolve_account('hope-city.ekkle.org') ->> 'status', 'suspended', '…while the app can say it''s paused');
set local role authenticated;

-- ---- Owner: manages the team; always one Owner ----
reset role;
select set_config('test.owner', (select id::text from platform_team where email = 'owner@ekkle.test'), true);
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select platform_invite_member('New@ekkle.test', 'New', 'support') $$, 'the Owner invites a team member');
select throws_ok($$ select public.auth_email_is_invitation('new@ekkle.test', null) $$,
  '42501', null, 'checking invitations is for the email hook only');
select throws_ok($$ select platform_set_member_role(current_setting('test.owner')::uuid, 'admin') $$,
  'P0001', 'last_owner', 'the last Owner cannot be demoted');
select throws_ok($$ select platform_remove_member(current_setting('test.owner')::uuid) $$,
  'P0001', 'last_owner', 'the last Owner cannot be removed');

select * from finish();
rollback;
