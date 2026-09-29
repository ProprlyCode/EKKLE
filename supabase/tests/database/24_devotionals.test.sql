-- Daily devotionals (0046): leaders write them by date; everyone on the
-- address reads today's (never ahead); an opt-in daily email.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into organizations (id, slug, name, join_code, subdomain)
  values ('d9700000-0000-0000-0000-0000000000d1', 'dv', 'Devotion Ministry', 'DVDV01', 'dv');
insert into auth.users (id, email) values
  ('d9710000-0000-0000-0000-000000000001', 'lea@dv.test'),
  ('d9710000-0000-0000-0000-000000000002', 'mem@dv.test'),
  ('d9710000-0000-0000-0000-000000000003', 'sek@dv.test');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('d9700000-0000-0000-0000-0000000000d1', 'd9710000-0000-0000-0000-000000000001', 'Lea', 'leader', 'dv-lea'),
  ('d9700000-0000-0000-0000-0000000000d1', 'd9710000-0000-0000-0000-000000000002', 'Mem', 'member', 'dv-mem');
insert into recipients (org_id, first_name, session_token, auth_uid) values
  ('d9700000-0000-0000-0000-0000000000d1', 'Sek', 'dv-tok', 'd9710000-0000-0000-0000-000000000003');

set local role authenticated;
set local "request.headers" to '{"origin":"https://dv.ekkle.org"}';

-- ---- A Leader writes ----
set local "request.jwt.claims" to '{"sub":"d9710000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select save_devotional(null, current_date, 'Abide', 'JHN.15:1-99999', 'Stay close.', null, null, 'published') $$,
  'P0001', 'invalid_passage', 'a passage must be a real reference');
select lives_ok($$ select save_devotional(null, current_date, 'Abide', 'JHN.15:1-11', 'Stay close to him.', 'Where do you rest?', 'Lord, keep us near.', 'draft') $$,
  'a Leader writes today''s as a draft');
select throws_ok($$ select save_devotional(null, current_date, 'Again', null, 'Two in a day.', null, null, 'draft') $$,
  'P0001', 'day_taken', 'one per day');
select lives_ok($$ select save_devotional(null, current_date + 7, 'Next week', null, 'Not yet.', null, null, 'published') $$,
  'and one for next week');
select lives_ok($$ select save_devotional(null, current_date - 1, 'Yesterday', 'PSA.23', 'The Lord is my shepherd.', null, null, 'published') $$,
  'and yesterday''s');
select is(jsonb_array_length(devotional_library()), 3, 'the library shows all of them, drafts too');

-- ---- A member reads ----
set local "request.jwt.claims" to '{"sub":"d9710000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(todays_devotional(current_date) ->> 'title', 'Yesterday', 'a draft doesn''t show: the latest published one does');
select throws_ok($$ select devotional_library() $$, 'P0001', 'forbidden', 'members don''t see the library');
select throws_ok($$ select save_devotional(null, current_date + 2, 'Mine', null, 'x', null, null, 'published') $$,
  'P0001', 'forbidden', 'or write');

set local "request.jwt.claims" to '{"sub":"d9710000-0000-0000-0000-000000000001","role":"authenticated"}';
select save_devotional((select (d ->> 'id')::uuid from jsonb_array_elements(devotional_library()) d where d ->> 'title' = 'Abide'),
  current_date, 'Abide', 'JHN.15:1-11', 'Stay close to him.', 'Where do you rest?', 'Lord, keep us near.', 'published');

-- ---- A seeker reads ----
set local "request.jwt.claims" to '{"sub":"d9710000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(todays_devotional(current_date) ->> 'title', 'Abide', 'a seeker sees today''s once published');
select is(todays_devotional(current_date + 7) ->> 'title', 'Abide', 'nobody reads ahead');
select is(jsonb_array_length(past_devotionals(current_date, null)), 2, 'past ones: today''s and yesterday''s');
select lives_ok($$ select set_devotional_reminder('00:00', 'UTC', 'space') $$, 'they ask for the daily email');

reset role;
select is(private.devotional_reminders_due(), 1, 'there''s one today, so one email');

select * from finish();
rollback;
