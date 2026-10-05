-- Prayer (0052): times, a private list that rotates, answered prayers, and
-- the email at a chosen time.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into organizations (id, slug, name, join_code, subdomain)
  values ('d9b00000-0000-0000-0000-0000000000a1', 'pr', 'Prayer Ministry', 'PRPR01', 'pr');
insert into auth.users (id, email) values
  ('d9b10000-0000-0000-0000-000000000001', 'mia@pr.test'),
  ('d9b10000-0000-0000-0000-000000000002', 'lee@pr.test');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('d9b00000-0000-0000-0000-0000000000a1', 'd9b10000-0000-0000-0000-000000000001', 'Mia', 'member', 'pr-mia'),
  ('d9b00000-0000-0000-0000-0000000000a1', 'd9b10000-0000-0000-0000-000000000002', 'Lee', 'admin', 'pr-lee');

set local role authenticated;
set local "request.headers" to '{"origin":"https://pr.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9b10000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$ select save_prayer_person(null, 'Mum', 'Her surgery on the 14th') $$, 'Mia adds someone');
select save_prayer_person(null, 'Sam', '');
select save_prayer_person(null, 'Jo', 'New job');
select save_prayer_person(null, 'Ana', '');
select throws_ok($$ select save_prayer_person(null, '  ', '') $$, 'P0001', 'missing', 'a name is needed');
select is(jsonb_array_length(my_prayer() -> 'people'), 4, 'her list');
select throws_ok($$ select * from prayer_people $$, '42501', null, 'the table itself is closed');

-- A quiet moment: three names, then the rest, rotating after "Amen".
select is(jsonb_array_length(prayer_moment(current_date, null) -> 'people'), 3, 'a few names, not the whole list');
select ok((prayer_moment(current_date, null) ->> 'verse') ~ '^[1-3A-Z]{3}\.\d+:\d+-\d+$', 'and a verse for the day');
select prayer_amen(array(select (p ->> 'id')::uuid from jsonb_array_elements(prayer_moment(current_date, null) -> 'people') p));
select is(prayer_moment(current_date, null) -> 'people' -> 0 ->> 'name', 'Ana', 'after Amen, the one not yet held comes first');
select is(jsonb_array_length(prayer_moment(current_date,
            array(select (p ->> 'id')::uuid from jsonb_array_elements(my_prayer() -> 'people') p)) -> 'people'), 0,
  '"someone else" skips the ones already shown');

-- Answered.
select lives_ok($$ select answer_prayer((select (p ->> 'id')::uuid from jsonb_array_elements(my_prayer() -> 'people') p
                                          where p ->> 'name' = 'Jo'), true, 'Started on Monday') $$, 'Jo''s job: answered');
select is(my_prayer() -> 'answered' -> 0 ->> 'answered_note', 'Started on Monday', 'with a note, to look back on');
select is(jsonb_array_length(prayer_moment(current_date, null) -> 'people'), 3, 'answered ones leave the rotation');

-- Times.
select throws_ok($$ select save_prayer_time(null, 'Morning', '07:00', 'Not/AZone', true) $$, 'P0001', 'invalid_tz', 'a real time zone');
select lives_ok($$ select save_prayer_time(null, 'Now', (now() at time zone 'UTC')::time, 'UTC', true) $$, 'a time, with an email');

-- Another person, even an Admin, never sees her list.
set local "request.jwt.claims" to '{"sub":"d9b10000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(my_prayer() -> 'people'), 0, 'an Admin sees only their own (empty) list');

reset role;
select is(private.prayer_times_due(), 1, 'the email goes at her chosen time');
select is(private.prayer_times_due(), 0, 'once a day');

select * from finish();
rollback;
