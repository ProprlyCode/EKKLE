-- N3 (0041): a member's photo, the "who you're talking to" card, a seeker
-- deleting their own details, and the weekly study reminder.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into organizations (id, slug, name, join_code)
  values ('d9200000-0000-0000-0000-0000000000e1', 'tr', 'Trust Ministry', 'TRTR01');
insert into auth.users (id, email) values
  ('d9210000-0000-0000-0000-000000000001', 'mia@tr.test'),
  ('d9210000-0000-0000-0000-000000000002', 'lee@tr.test'),
  ('d9210000-0000-0000-0000-000000000003', 'sy@tr.test'),
  ('d9210000-0000-0000-0000-000000000004', 'max@tr.test');
insert into users (id, org_id, auth_uid, name, role, code_slug) values
  ('d9220000-0000-0000-0000-000000000001', 'd9200000-0000-0000-0000-0000000000e1', 'd9210000-0000-0000-0000-000000000001', 'Mia', 'member', 'tr-mia'),
  ('d9220000-0000-0000-0000-000000000002', 'd9200000-0000-0000-0000-0000000000e1', 'd9210000-0000-0000-0000-000000000002', 'Lee', 'leader', 'tr-lee'),
  -- Max is on the team and also reads as a seeker.
  ('d9220000-0000-0000-0000-000000000004', 'd9200000-0000-0000-0000-0000000000e1', 'd9210000-0000-0000-0000-000000000004', 'Max', 'member', 'tr-max');
insert into recipients (id, org_id, first_name, email, session_token, auth_uid, arrival_member_id) values
  ('d9230000-0000-0000-0000-000000000003', 'd9200000-0000-0000-0000-0000000000e1', 'Sy', 'sy@tr.test', 'tr-tok', 'd9210000-0000-0000-0000-000000000003', 'd9220000-0000-0000-0000-000000000001'),
  ('d9230000-0000-0000-0000-000000000004', 'd9200000-0000-0000-0000-0000000000e1', 'Max', 'max@tr.test', 'tr-tok2', 'd9210000-0000-0000-0000-000000000004', 'd9220000-0000-0000-0000-000000000001');
insert into conversations (id, org_id, member_id, recipient_id) values
  ('d9240000-0000-0000-0000-000000000003', 'd9200000-0000-0000-0000-0000000000e1', 'd9220000-0000-0000-0000-000000000001', 'd9230000-0000-0000-0000-000000000003');
insert into messages (conversation_id, sender_type, body) values
  ('d9240000-0000-0000-0000-000000000003', 'recipient', 'Hello');

set local role authenticated;
set local "request.headers" to '{"origin":"https://tr.ekkle.org"}';

-- ---- A member's photo ----
set local "request.jwt.claims" to '{"sub":"d9210000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('photos', 'd9220000-0000-0000-0000-000000000001/me.jpg') $$,
  'a member uploads into their own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('photos', 'd9220000-0000-0000-0000-000000000002/me.jpg') $$,
  '42501', null, '…and not into anyone else''s');
select throws_ok($$ select set_my_photo('d9220000-0000-0000-0000-000000000002/me.jpg') $$, 'P0001', 'invalid_photo',
  'a member can''t point at someone else''s photo');
select lives_ok($$ select set_my_photo('d9220000-0000-0000-0000-000000000001/me.jpg') $$, 'a member sets their photo');
select throws_ok($$ update users set photo = null where id = 'd9220000-0000-0000-0000-000000000001' $$, '42501', null,
  'only through the function');
select throws_ok($$ select remove_member_photo('d9220000-0000-0000-0000-000000000001') $$, 'P0001', 'forbidden',
  'a member can''t remove photos');

-- ---- The card ----
reset role;
select is((select private.member_card(u) - 'name' - 'short_message' from users u
            where id = 'd9220000-0000-0000-0000-000000000001'),
  '{"photo":"d9220000-0000-0000-0000-000000000001/me.jpg","ministry":"Trust Ministry"}'::jsonb,
  'the card carries the photo and the ministry');
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d9210000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(seeker_connection() -> 'member' ->> 'photo', 'd9220000-0000-0000-0000-000000000001/me.jpg',
  'so does the seeker''s connection');

-- ---- A Leader takes a photo down ----
set local "request.jwt.claims" to '{"sub":"d9210000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select remove_member_photo('d9220000-0000-0000-0000-000000000001') $$, 'a Leader removes a photo');
select is((select photo from users where id = 'd9220000-0000-0000-0000-000000000001'), null, '…and it''s gone');

-- ---- The weekly study reminder ----
set local "request.jwt.claims" to '{"sub":"d9210000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$ select set_study_reminder(1, '19:00', 'Mars/Olympus') $$, 'P0001', 'invalid_reminder',
  'a real time zone only');
select lives_ok($$ select set_study_reminder(extract(dow from now() at time zone 'UTC')::int, '00:00', 'UTC') $$,
  'a seeker turns it on');
select is(my_study_reminder() ->> 'at', '00:00', 'and sees it');
select throws_ok($$ select * from study_reminders $$, '42501', null, 'the table itself is closed');

reset role;
select is(private.study_reminders_due(), 1, 'due today, with a study to do: one email');
select is(private.study_reminders_due(), 0, '…and only one');

-- ---- Delete my details ----
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d9210000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$ select delete_my_details() $$, 'a seeker deletes their details');
reset role;
select ok(
  (select deleted_at is not null and email is null and first_name = '' and auth_uid is null
     from recipients where id = 'd9230000-0000-0000-0000-000000000003')
  and not exists (select 1 from messages where conversation_id = 'd9240000-0000-0000-0000-000000000003')
  and not exists (select 1 from study_reminders where auth_uid = 'd9210000-0000-0000-0000-000000000003')
  and not exists (select 1 from auth.users where id = 'd9210000-0000-0000-0000-000000000003'),
  'their name, email, messages, reminder and sign-in are gone');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d9210000-0000-0000-0000-000000000004","role":"authenticated"}';
select delete_my_details();
reset role;
select ok(exists (select 1 from auth.users where id = 'd9210000-0000-0000-0000-000000000004'),
  'someone also on the team keeps their sign-in');

select * from finish();
rollback;
