-- N4 (0042): outcomes — counts only, by ministry, by member, and for the
-- Ekklē team; the time range picks what counts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into organizations (id, slug, name, join_code)
  values ('d9300000-0000-0000-0000-0000000000f1', 'oc', 'Outcome Ministry', 'OCOC01');
insert into auth.users (id, email) values
  ('d9310000-0000-0000-0000-000000000001', 'mo@oc.test'),
  ('d9310000-0000-0000-0000-000000000002', 'lu@oc.test'),
  ('d9310000-0000-0000-0000-000000000003', 'team@oc.test');
delete from platform_team;
insert into platform_team (email, auth_uid, role) values ('team@oc.test', 'd9310000-0000-0000-0000-000000000003', 'support');
insert into users (id, org_id, auth_uid, name, role, code_slug) values
  ('d9320000-0000-0000-0000-000000000001', 'd9300000-0000-0000-0000-0000000000f1', 'd9310000-0000-0000-0000-000000000001', 'Mo', 'member', 'oc-mo'),
  ('d9320000-0000-0000-0000-000000000002', 'd9300000-0000-0000-0000-0000000000f1', 'd9310000-0000-0000-0000-000000000002', 'Lu', 'leader', 'oc-lu');
insert into recipients (id, org_id, first_name, session_token, arrival_member_id) values
  ('d9330000-0000-0000-0000-000000000001', 'd9300000-0000-0000-0000-0000000000f1', 'Ana', 'oc-t1', 'd9320000-0000-0000-0000-000000000001'),
  ('d9330000-0000-0000-0000-000000000002', 'd9300000-0000-0000-0000-0000000000f1', 'Ben', 'oc-t2', 'd9320000-0000-0000-0000-000000000001');
-- Mo's link: opened three times (one 100 days ago), finished twice.
insert into sequence_events (org_id, member_id, session_token, event, created_at) values
  ('d9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'oc-t1', 'started', now()),
  ('d9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'oc-t2', 'started', now()),
  ('d9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'oc-t3', 'started', now() - interval '100 days'),
  ('d9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'oc-t1', 'completed', now()),
  ('d9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'oc-t2', 'completed', now()),
  -- Lu's link, once.
  ('d9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000002', 'oc-t4', 'started', now());
-- Ana and Ben both wrote to Mo; Mo replied to Ana; they met.
insert into conversations (id, org_id, member_id, recipient_id) values
  ('d9340000-0000-0000-0000-000000000001', 'd9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'd9330000-0000-0000-0000-000000000001'),
  ('d9340000-0000-0000-0000-000000000002', 'd9300000-0000-0000-0000-0000000000f1', 'd9320000-0000-0000-0000-000000000001', 'd9330000-0000-0000-0000-000000000002');
insert into messages (conversation_id, sender_type, body) values
  ('d9340000-0000-0000-0000-000000000001', 'recipient', 'Hi'),
  ('d9340000-0000-0000-0000-000000000001', 'member', 'Hello Ana'),
  ('d9340000-0000-0000-0000-000000000002', 'recipient', 'Hey');
insert into connection_checkins (member_id, recipient_id, connected) values
  ('d9320000-0000-0000-0000-000000000001', 'd9330000-0000-0000-0000-000000000001', 'yes'),
  ('d9320000-0000-0000-0000-000000000001', 'd9330000-0000-0000-0000-000000000001', 'yes');
-- Ana finished a study.
insert into study_progress (recipient_id, study_id, completed_at)
  select 'd9330000-0000-0000-0000-000000000001', id, now() from studies where title = 'The Logic of Love';

set local role authenticated;
set local "request.headers" to '{"origin":"https://oc.ekkle.org"}';

-- ---- A member sees their own ----
set local "request.jwt.claims" to '{"sub":"d9310000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select ministry_outcomes(90) $$, 'P0001', 'forbidden', 'a member doesn''t see the ministry''s');
select is(my_outcomes(null),
  '{"opened":3,"finished":2,"reached_out":2,"replied":1,"met":1,"studies_started":1,"studies_completed":1}'::jsonb,
  'a member''s own, all time');
select is((my_outcomes(90) ->> 'opened')::int, 2, 'the last 90 days leaves out the older one');
select throws_ok($$ select my_outcomes(7) $$, 'P0001', 'invalid_range', '30, 90 or all time');

-- ---- Admins and Leaders see the ministry and each member ----
set local "request.jwt.claims" to '{"sub":"d9310000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((ministry_outcomes(90) -> 'ministry' ->> 'opened')::int, 3, 'the ministry: every link');
select is((ministry_outcomes(null) -> 'ministry' ->> 'met')::int, 1, 'meeting the same person twice counts once');
select is(jsonb_array_length(ministry_outcomes(90) -> 'members'), 2, 'a row per member');
select is((select m -> 'outcomes' ->> 'opened' from jsonb_array_elements(ministry_outcomes(90) -> 'members') m
            where m ->> 'name' = 'Lu')::int, 1, '…each with their own numbers');
select ok(ministry_outcomes(90)::text !~ 'Hello Ana', 'never message contents');
select throws_ok($$ select platform_outcomes(90) $$, 'P0001', 'forbidden', 'a Leader doesn''t see other ministries');

-- ---- The Ekklē team sees every ministry ----
set local "request.headers" to '{"origin":"https://ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9310000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select o -> 'outcomes' ->> 'reached_out' from jsonb_array_elements(platform_outcomes(null)) o
            where o ->> 'name' = 'Outcome Ministry')::int, 2, 'the Ekklē team sees every ministry');

select * from finish();
rollback;
