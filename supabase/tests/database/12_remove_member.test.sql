-- Removing someone from a ministry's team (0032): access ends, the link stops,
-- conversations are handed on (never deleted), invitations just go.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into organizations (id, slug, name, join_code)
  values ('c0000000-0000-0000-0000-00000000000b', 'rm', 'Remove Ministry', 'RMRM01');
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'admin@rm.test'),
  ('c1000000-0000-0000-0000-000000000002', 'leader@rm.test'),
  ('c1000000-0000-0000-0000-000000000003', 'member@rm.test'),
  ('c1000000-0000-0000-0000-000000000004', 'talker@rm.test');
insert into users (id, org_id, auth_uid, name, role, code_slug, email) values
  ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000001', 'Ada', 'admin', 'rm-ada', 'admin@rm.test'),
  ('c2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000002', 'Lee', 'leader', 'rm-lee', 'leader@rm.test'),
  ('c2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000003', 'Mo', 'member', 'rm-mo', 'member@rm.test'),
  ('c2000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000004', 'Tal', 'member', 'rm-tal', 'talker@rm.test'),
  ('c2000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000b', null, 'Invited', 'member', 'rm-inv', 'inv@rm.test');
insert into recipients (id, org_id, first_name, email, session_token)
  values ('c3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b', 'Sy', 'sy@rm.test', 'rm-tok');
insert into conversations (id, org_id, member_id, recipient_id)
  values ('c4000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000b',
          'c2000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000001');
update organizations set default_member_id = 'c2000000-0000-0000-0000-000000000004'
 where id = 'c0000000-0000-0000-0000-00000000000b';

set local role authenticated;
set local "request.headers" to '{"origin":"https://rm.ekkle.org"}';

-- ---- A Leader ----
set local "request.jwt.claims" to '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select remove_member('c2000000-0000-0000-0000-000000000003') $$, 'a Leader removes a Member');
select throws_ok($$ select remove_member('c2000000-0000-0000-0000-000000000001') $$, 'P0001', 'forbidden',
  'a Leader cannot remove an Admin');
select is(member_conversation_count('c2000000-0000-0000-0000-000000000004'), 1, 'a Leader sees who has conversations');
select throws_ok($$ select remove_member('c2000000-0000-0000-0000-000000000004') $$, 'P0001', 'has_conversations',
  'someone with conversations needs a teammate to hand them to');
select lives_ok($$ select remove_member('c2000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000002') $$,
  '…and with one, they''re removed');
select lives_ok($$ select remove_member('c2000000-0000-0000-0000-000000000005') $$, 'an unaccepted invitation is removed');

-- ---- An Admin ----
set local "request.jwt.claims" to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select remove_member('c2000000-0000-0000-0000-000000000001') $$, 'P0001', 'forbidden',
  'nobody removes themselves');

reset role;
select is((select member_id from conversations where id = 'c4000000-0000-0000-0000-000000000001'),
  'c2000000-0000-0000-0000-000000000002'::uuid, 'the conversation now belongs to the chosen teammate (not deleted)');
select ok((select removed_at is not null and auth_uid is null and not active from users
            where id = 'c2000000-0000-0000-0000-000000000003'),
  'a removed person loses access and their link');
select is((select count(*)::int from users where id = 'c2000000-0000-0000-0000-000000000005'), 0,
  'the unaccepted invitation is gone');
select is((select default_member_id from organizations where id = 'c0000000-0000-0000-0000-00000000000b'), null,
  'a removed designated responder is cleared');

select * from finish();
rollback;
