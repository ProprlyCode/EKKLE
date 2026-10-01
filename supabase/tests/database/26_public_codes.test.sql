-- Public codes (0050): the ministry's codes for posters and clothing open a
-- flow as the ministry, and messages go to the designated responder.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into organizations (id, slug, name, join_code, subdomain) values
  ('d9900000-0000-0000-0000-0000000000a1', 'pc', 'Poster Ministry', 'PCPC01', 'pc'),
  ('d9900000-0000-0000-0000-0000000000a2', 'po', 'Other Ministry', 'POPO01', 'po');
insert into auth.users (id, email) values
  ('d9910000-0000-0000-0000-000000000001', 'ann@pc.test'),
  ('d9910000-0000-0000-0000-000000000002', 'leo@pc.test'),
  ('d9910000-0000-0000-0000-000000000003', 'ros@pc.test');
insert into users (id, org_id, auth_uid, name, role, code_slug, photo) values
  ('d9920000-0000-0000-0000-000000000001', 'd9900000-0000-0000-0000-0000000000a1', 'd9910000-0000-0000-0000-000000000001', 'Ann', 'admin', 'pc-ann', null),
  ('d9920000-0000-0000-0000-000000000002', 'd9900000-0000-0000-0000-0000000000a1', 'd9910000-0000-0000-0000-000000000002', 'Leo', 'leader', 'pc-leo', null),
  ('d9920000-0000-0000-0000-000000000003', 'd9900000-0000-0000-0000-0000000000a1', 'd9910000-0000-0000-0000-000000000003', 'Ros', 'member', 'pc-ros', null);
insert into sequences (id, org_id, title, status) values
  ('d9930000-0000-0000-0000-000000000001', 'd9900000-0000-0000-0000-0000000000a1', 'Main', 'approved'),
  ('d9930000-0000-0000-0000-000000000002', 'd9900000-0000-0000-0000-0000000000a1', 'Welcome here', 'approved');
insert into sequence_screens (sequence_id, sort_order, headline, body) values
  ('d9930000-0000-0000-0000-000000000002', 0, 'you’re welcome here', 'Read on.');

set local role authenticated;
set local "request.headers" to '{"origin":"https://pc.ekkle.org"}';

-- ---- Admins make them; Leaders see them ----
set local "request.jwt.claims" to '{"sub":"d9910000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select save_public_code(null, 'Lobby', 'lobby', null, true) $$, 'P0001', 'forbidden', 'Leaders don''t make codes');

set local "request.jwt.claims" to '{"sub":"d9910000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select save_public_code(null, 'Lobby', 'Lobby Poster', null, true) $$, 'P0001', 'invalid_code', 'link names are checked');
select throws_ok($$ select save_public_code(null, 'Lobby', 'lobby', 'd9930000-0000-0000-0000-0000000000ff', true) $$,
  'P0001', 'invalid_flow', 'only the ministry''s own flows');
select lives_ok($$ select save_public_code(null, 'Lobby poster', 'LOBBY', 'd9930000-0000-0000-0000-000000000002', true) $$,
  'an Admin makes one');
select throws_ok($$ select save_public_code(null, 'Again', 'lobby', null, true) $$, 'P0001', 'code_taken', 'one per link name');
select throws_ok($$ select * from public_codes $$, '42501', null, 'the table itself is closed');

set local "request.jwt.claims" to '{"sub":"d9910000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(public_codes_list() -> 'codes' -> 0 ->> 'flow', 'Welcome here', 'Leaders see the list and the flow it opens');
select is(public_codes_list() ->> 'responder', 'Ann', 'with no designated responder, an Admin answers');

-- ---- Someone scans it ----
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
select is(public_code_landing('lobby') -> 'member' ->> 'name', 'Poster Ministry', 'the ministry speaks, not a member');
select ok((public_code_landing('lobby') -> 'member' -> 'photo') = 'null'::jsonb and (public_code_landing('lobby') ->> 'public')::boolean,
  'no member photo');
select is(public_code_landing('lobby') -> 'screens' -> 0 ->> 'headline', 'you’re welcome here', 'it opens the chosen flow');
select log_public_code_event('pc-tok', 'lobby', 'started');
select lives_ok($$ select start_public_conversation('pc-tok', 'lobby', 'Kim', 'kim@pc.test', 'Hello') $$, 'they write');

set local "request.headers" to '{"origin":"https://po.ekkle.org"}';
select is(public_code_landing('lobby'), null, 'a code only works on its own ministry''s address');

reset role;
select is((select u.name from conversations c join users u on u.id = c.member_id
            where c.public_code_id is not null), 'Ann', 'the conversation goes to the Admin');

update organizations set default_member_id = 'd9920000-0000-0000-0000-000000000003'
 where id = 'd9900000-0000-0000-0000-0000000000a1';
select is((private.ministry_responder('d9900000-0000-0000-0000-0000000000a1')).name, 'Ros',
  'the designated responder answers when there is one');
select is((select count(*)::int from sequence_events where public_code_id is not null and member_id is null), 2,
  'opens and messages count for the ministry, not a member');

select * from finish();
rollback;
