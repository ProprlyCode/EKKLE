-- Address change requests (0043): a ministry's Admin asks, the Ekklē team
-- decides; the old address keeps leading to the ministry and is never
-- given to anyone else.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into organizations (id, slug, name, join_code, subdomain) values
  ('d9400000-0000-0000-0000-0000000000a1', 'ar', 'Address Ministry', 'ARAR01', 'oldname'),
  ('d9400000-0000-0000-0000-0000000000a2', 'ar2', 'Other Ministry', 'ARAR02', 'otherone');
insert into auth.users (id, email) values
  ('d9410000-0000-0000-0000-000000000001', 'ada@ar.test'),
  ('d9410000-0000-0000-0000-000000000002', 'len@ar.test'),
  ('d9410000-0000-0000-0000-000000000003', 'owner@ar.test'),
  ('d9410000-0000-0000-0000-000000000004', 'sup@ar.test');
delete from platform_team;
insert into platform_team (email, auth_uid, role) values
  ('owner@ar.test', 'd9410000-0000-0000-0000-000000000003', 'owner'),
  ('sup@ar.test', 'd9410000-0000-0000-0000-000000000004', 'support');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('d9400000-0000-0000-0000-0000000000a1', 'd9410000-0000-0000-0000-000000000001', 'Ada', 'admin', 'ar-ada'),
  ('d9400000-0000-0000-0000-0000000000a1', 'd9410000-0000-0000-0000-000000000002', 'Len', 'leader', 'ar-len');

set local role authenticated;
set local "request.headers" to '{"origin":"https://oldname.ekkle.org"}';

-- ---- The ministry asks ----
set local "request.jwt.claims" to '{"sub":"d9410000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select request_address_change('newname', null) $$, 'P0001', 'forbidden', 'only Admins ask');

set local "request.jwt.claims" to '{"sub":"d9410000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(address_available('newname') and not address_available('otherone') and not address_available('admin'),
  'an Admin sees which names are free');
select throws_ok($$ select request_address_change('otherone', null) $$, 'P0001', 'subdomain_taken', 'not someone else''s');
select lives_ok($$ select request_address_change('NewName', 'We renamed the church') $$, 'an Admin asks');
select throws_ok($$ select request_address_change('another', null) $$, 'P0001', 'already_pending', 'one at a time');
select is(my_address_request() -> 'request' ->> 'subdomain', 'newname', 'and sees it waiting');
select lives_ok($$ select cancel_address_request() $$, 'they can cancel it');
select is(my_address_request() -> 'request', 'null'::jsonb, '…and it''s gone');
select request_address_change('newname', 'We renamed the church');
select throws_ok($$ select * from address_requests $$, '42501', null, 'the tables themselves are closed');

-- ---- The Ekklē team decides ----
set local "request.headers" to '{"origin":"https://ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9410000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(jsonb_array_length(platform_address_requests()), 1, 'Support sees requests');
select throws_ok($$ select decide_address_request((select (platform_address_requests() -> 0 ->> 'id')::uuid), true, null) $$,
  'P0001', 'forbidden', '…but can''t decide');

set local "request.jwt.claims" to '{"sub":"d9410000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$ select decide_address_request((select (platform_address_requests() -> 0 ->> 'id')::uuid), true, null) $$,
  'an Owner approves');

set local role anon;
select is(resolve_account('newname.ekkle.org') ->> 'subdomain', 'newname', 'the new address works');
select is(resolve_account('oldname.ekkle.org') ->> 'moved_to', 'newname', 'the old one says where it moved');
reset role;
select is(account_for_host('oldname.ekkle.org'), 'd9400000-0000-0000-0000-0000000000a1'::uuid,
  '…and still finds the ministry');

select throws_ok($$ update organizations set subdomain = 'oldname' where id = 'd9400000-0000-0000-0000-0000000000a2' $$,
  'P0001', 'subdomain_taken', 'an old address is never given to anyone else');
select ok(not private.address_free('oldname', null), 'nor offered to a new account');

select * from finish();
rollback;
