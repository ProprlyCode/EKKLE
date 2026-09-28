-- The Bible study bank (0031): Ekklē's shared studies reach every ministry;
-- each ministry chooses which its seekers get and in what order; seekers
-- follow that order; leaders preview; nobody edits the bank or another
-- ministry's studies.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- A second bank study, and a ministry (Hope) with its own study.
insert into studies (id, org_id, sort_order, number, title, status) values
  ('b5000000-0000-0000-0000-000000000002', null, 2, 2, 'Bank two', 'approved');
insert into organizations (id, slug, name, join_code)
  values ('b0000000-0000-0000-0000-00000000000b', 'hope-sb', 'Hope', 'HOPESB');
insert into studies (id, org_id, sort_order, title, status) values
  ('b5000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', 1, 'Hope''s own', 'approved');

insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-000000000001', 'leader@hope-sb.test'),
  ('b1000000-0000-0000-0000-000000000002', 'member@hope-sb.test'),
  ('b1000000-0000-0000-0000-000000000003', 'seeker@hope-sb.test');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000001', 'Lia', 'leader', 'sb-lia'),
  ('b0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000002', 'Max', 'member', 'sb-max');
insert into recipients (org_id, first_name, email, session_token, auth_uid) values
  ('b0000000-0000-0000-0000-00000000000b', 'Sy', 'seeker@hope-sb.test', 'sb-tok',
   'b1000000-0000-0000-0000-000000000003');

select set_config('test.love', (select id::text from studies where title = 'The Logic of Love'), true);
set local role authenticated;

-- ---- Seekers, before any choice: the bank (in order), then the ministry's own ----
set local "request.jwt.claims" to '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select jsonb_agg(s ->> 'title') from jsonb_array_elements(seeker_studies()) s),
  '["The Logic of Love", "Bank two", "Hope''s own"]'::jsonb,
  'by default a ministry gets the whole bank, then its own studies');
select is((seeker_studies() -> 1 ->> 'locked')::boolean, true, 'studies unlock one after another');

-- ---- Leaders choose and order ----
set local "request.jwt.claims" to '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(jsonb_array_length(ministry_study_bank()), 3, 'a Leader sees every study they can offer');
select is((ministry_study_bank() -> 0 ->> 'source'), 'ekkle', '…marked as Ekklē''s or the ministry''s own');
select lives_ok($$ select save_ministry_studies(jsonb_build_array(
    jsonb_build_object('id', 'b5000000-0000-0000-0000-00000000000c', 'enabled', true),
    jsonb_build_object('id', 'b5000000-0000-0000-0000-000000000002', 'enabled', false),
    jsonb_build_object('id', current_setting('test.love')::uuid, 'enabled', true))) $$,
  'a Leader saves an order and turns a study off');
select ok(preview_study('b5000000-0000-0000-0000-000000000002') -> 'pages' is not null, 'a Leader previews a bank study');
update studies set title = 'Mine now' where id = 'b5000000-0000-0000-0000-000000000002';
select is((select title from studies where id = 'b5000000-0000-0000-0000-000000000002'), 'Bank two',
  'a Leader cannot edit a bank study');

-- ---- Seekers follow the choice ----
set local "request.jwt.claims" to '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select jsonb_agg(s ->> 'title') from jsonb_array_elements(seeker_studies()) s),
  '["Hope''s own", "The Logic of Love"]'::jsonb, 'seekers get the chosen studies, in the chosen order');
select is(seeker_study('b5000000-0000-0000-0000-000000000002'), null, 'a study turned off can''t be opened');
select is((seeker_study(current_setting('test.love')::uuid) ->> 'locked')::boolean, true,
  'the second study stays locked until the first is finished');

-- ---- Boundaries ----
set local "request.jwt.claims" to '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select ministry_study_bank() $$, 'P0001', 'forbidden', 'a Member cannot manage studies');
set local "request.jwt.claims" to '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(preview_study((select id from studies where title = 'Hope''s own')) ->> 'title', 'Hope''s own',
  'a Leader previews their own ministry''s study');

select * from finish();
rollback;
