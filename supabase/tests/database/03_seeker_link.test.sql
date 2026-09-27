-- Seeker accounts (0020): linking is safe to repeat, and never makes a second
-- recipient row for the same person — including when a row for them already
-- exists (the loser of two simultaneous calls).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('70000000-0000-0000-0000-000000000001', 'seeker-link@test.local'),
  ('70000000-0000-0000-0000-000000000002', 'seeker-race@test.local');

-- The race: the other call's row lands between this call's checks and its
-- insert (simulated by a row it can't find by auth_uid or email).
insert into recipients (org_id, first_name, session_token)
  select id, 'Winner', 'seeker:70000000-0000-0000-0000-000000000002'
  from organizations order by created_at limit 1;

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$ select link_seeker_account('Sam', null) $$, 'first link creates the seeker');
select lives_ok($$ select link_seeker_account('Sam', null) $$, 'linking again is fine');

set local "request.jwt.claims" to '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select link_seeker_account('Kit', null) $$,
  'the losing call of a simultaneous pair does not fail');

reset role;
select is(
  (select count(*)::int from recipients where session_token = 'seeker:70000000-0000-0000-0000-000000000001'),
  1, 'still exactly one recipient row for the seeker');

select * from finish();
rollback;
