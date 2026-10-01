-- Pilot readiness (0045): retired and signed-in-only functions are out of
-- reach; deleting details and study reminders cover every ministry a seeker
-- is known to.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(not has_function_privilege('anon', 'public.complete_study(text, uuid, jsonb)', 'execute')
      and not has_function_privilege('authenticated', 'public.save_study_progress(text, uuid, int, jsonb)', 'execute'),
  'the first study functions are closed');
select ok(not has_function_privilege('anon', 'public.seeker_connection()', 'execute')
      and not has_function_privilege('anon', 'public.erase_conversation(uuid)', 'execute'),
  'signed-in-only functions are out of reach without signing in');
select ok(has_function_privilege('anon', 'public.get_recipient_landing(text, text)', 'execute')
      and has_function_privilege('anon', 'public.resolve_account(text)', 'execute'),
  'the public pages still work');

-- A seeker known to two ministries.
insert into organizations (id, slug, name, join_code, subdomain) values
  ('d9600000-0000-0000-0000-0000000000c1', 'ph1', 'One', 'PHPH01', 'ph-one'),
  ('d9600000-0000-0000-0000-0000000000c2', 'ph2', 'Two', 'PHPH02', 'ph-two');
insert into auth.users (id, email) values ('d9610000-0000-0000-0000-000000000001', 'two@ph.test');
insert into recipients (org_id, first_name, email, session_token, auth_uid) values
  ('d9600000-0000-0000-0000-0000000000c1', 'Tess', 'two@ph.test', 'ph-t1', 'd9610000-0000-0000-0000-000000000001'),
  ('d9600000-0000-0000-0000-0000000000c2', 'Tess', 'two@ph.test', 'ph-t2', 'd9610000-0000-0000-0000-000000000001');
insert into study_reminders (auth_uid, org_id, weekday, remind_at, tz)
  values ('d9610000-0000-0000-0000-000000000001', 'd9600000-0000-0000-0000-0000000000c1',
          extract(dow from now() at time zone 'UTC')::int, '00:00', 'UTC');

select is(private.study_reminders_due(), 1, 'one reminder, one email');

set local role authenticated;
set local "request.headers" to '{"origin":"https://ph-one.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9610000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select delete_my_details() $$, 'they delete their details');
reset role;
select is((select count(*)::int from recipients where email = 'two@ph.test' or first_name = 'Tess'), 0,
  'both ministries forget their name and email');
select is((select count(*)::int from recipients where session_token in ('ph-t1', 'ph-t2')), 0,
  'and the old device links stop working');
select ok(not exists (select 1 from auth.users where id = 'd9610000-0000-0000-0000-000000000001'), 'and the sign-in is gone');

select * from finish();
rollback;
