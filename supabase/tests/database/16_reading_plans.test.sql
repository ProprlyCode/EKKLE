-- Reading plans (0038): starting and ticking off days, the daily email (once
-- a day, at their time), reading together, and ministries' own plans.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into organizations (id, slug, name, join_code) values
  ('a0000000-0000-0000-0000-0000000000a1', 'rp', 'Reading Ministry', 'RPRP01'),
  ('a0000000-0000-0000-0000-0000000000a2', 'rp2', 'Other Ministry', 'RPRP02');
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'leader@rp.test'),
  ('a1000000-0000-0000-0000-000000000002', 'member@rp.test'),
  ('a1000000-0000-0000-0000-000000000003', 'seeker@rp.test');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000001', 'Lia', 'leader', 'rp-lia'),
  ('a0000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000002', 'Max', 'member', 'rp-max');
insert into recipients (org_id, first_name, email, session_token, auth_uid) values
  ('a0000000-0000-0000-0000-0000000000a1', 'Sy', 'seeker@rp.test', 'rp-tok', 'a1000000-0000-0000-0000-000000000003');

select set_config('test.john', (select id::text from reading_plans where org_id is null and title = 'John in 21 days'), true);
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

set local role authenticated;
set local "request.headers" to '{"origin":"https://rp.ekkle.org"}';

-- ---- Someone exploring ----
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(jsonb_array_length(reading_plans()), 4, 'Ekklē''s four plans are offered');
select throws_ok($$ select mark_reading_day(current_setting('test.john')::uuid, 1, true) $$, 'P0001', 'not_started',
  'days are ticked off once the plan is started');
select lives_ok($$ select start_reading_plan(current_setting('test.john')::uuid, false, 'space') $$, 'they start John in 21 days');
select lives_ok($$ select mark_reading_day(current_setting('test.john')::uuid, 1, true),
                          mark_reading_day(current_setting('test.john')::uuid, 3, true) $$, '…and tick days 1 and 3');
select is((select (p -> 'mine' ->> 'next_day')::int from jsonb_array_elements(reading_plans()) p
            where p ->> 'id' = current_setting('test.john')), 2, 'today''s reading is the first day not yet read');
select throws_ok($$ select set_reading_reminder(current_setting('test.john')::uuid, '07:00', 'Nowhere/Nope') $$,
  'P0001', 'invalid_time_zone', 'the daily email needs a real time zone');
select lives_ok($$ select set_reading_reminder(current_setting('test.john')::uuid, '00:00', 'UTC') $$,
  'they turn on the daily email');

reset role;
select is(private.reading_reminders_due(), 0, 'turned on after today''s time: the first email comes tomorrow');
update reading_progress set last_reminded_on = current_date - 1
 where plan_id = current_setting('test.john')::uuid;
select is(private.reading_reminders_due(), 1, 'a new day: one email');
select is(private.reading_reminders_due(), 0, '…and only one');
set local role authenticated;

-- ---- The ministry: reading together, and its own plans ----
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select start_reading_together(current_setting('test.john')::uuid, current_date) $$,
  'P0001', 'forbidden', 'a Member can''t start a plan for everyone');
set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select start_reading_together(current_setting('test.john')::uuid, current_date - 2) $$,
  'a Leader starts reading John together, from two days ago');
select throws_ok($$ select save_reading_plan(null, 'Bad', null, '[["John 1"]]', 'published') $$,
  'P0001', 'invalid_reading', 'readings are checked');
insert into ids values ('own', save_reading_plan(null, 'Advent', 'Four weeks', '[["LUK.1:1-38"], ["LUK.2"]]', 'published'));
select throws_ok($$ select save_reading_plan(current_setting('test.john')::uuid, 'Mine', null, '[["JHN.1"]]', 'published') $$,
  'P0001', 'forbidden', 'a Leader can''t change Ekklē''s plans');

set local "request.jwt.claims" to '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$ select start_reading_plan(current_setting('test.john')::uuid, true, 'space') $$, 'they join the group');
select is((select (p -> 'together' ->> 'day')::int * 10 + (p -> 'together' ->> 'readers')::int
             from jsonb_array_elements(reading_plans()) p where p ->> 'id' = current_setting('test.john')), 31,
  'the group is on day 3, with one reader (a count, no names)');

set local "request.headers" to '{"origin":"https://rp2.ekkle.org"}';
select is(jsonb_array_length(reading_plans()), 4, 'another ministry''s address doesn''t offer this ministry''s plan');

select * from finish();
rollback;
