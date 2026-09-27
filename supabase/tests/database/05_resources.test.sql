-- Resources (0022): seekers read only their church's published resources,
-- only through the seeker functions; only leaders set topics.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- A seeker in the seeded pilot church.
insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-000000000001', 'res-seeker@test.local');
insert into recipients (org_id, first_name, email, session_token, auth_uid)
  values ('00000000-0000-0000-0000-0000000000a1', 'R', 'res-seeker@test.local',
          'seeker:80000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001');

-- Another church with its own published resource.
insert into organizations (id, slug, name, join_code)
  values ('80000000-0000-0000-0000-00000000000b', 'res-other', 'Other', 'RESOTH');
insert into resources (id, org_id, title, status)
  values ('80000000-0000-0000-0000-0000000000e9', '80000000-0000-0000-0000-00000000000b', 'Other church', 'approved');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(jsonb_array_length(seeker_resources()), 2,
  'seeker: sees their church''s two published resources');
select ok(not (seeker_resources()::text like '%Draft: not ready yet%'),
  'seeker: drafts are hidden');
select ok(not (seeker_resources()::text like '%Other church%'),
  'seeker: another church''s resources are hidden');
select is(seeker_resource('00000000-0000-0000-0000-0000000000e1') ->> 'kind', 'text',
  'seeker: can open a published resource');
select is(seeker_resource('00000000-0000-0000-0000-0000000000e3'), null,
  'seeker: cannot open a draft');
select is((select count(*)::int from resources), 0,
  'seeker: cannot read the resources table directly');

reset role;
set local role anon;
select throws_ok($$ select seeker_resources() $$, '42501', null,
  'anon: cannot list resources');

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select set_resource_topics('00000000-0000-0000-0000-0000000000e1', array['x']) $$,
  'P0001', 'forbidden', 'non-leaders cannot change topics');

select * from finish();
rollback;
