-- Your space knows a first visit (0051).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into organizations (id, slug, name, join_code, subdomain)
  values ('d9a00000-0000-0000-0000-0000000000a1', 'fv', 'First Visit', 'FVFV01', 'fv');
insert into auth.users (id, email) values ('d9a10000-0000-0000-0000-000000000001', 'sam@fv.test');
insert into recipients (org_id, first_name, session_token, auth_uid)
  values ('d9a00000-0000-0000-0000-0000000000a1', 'Sam', 'fv-tok', 'd9a10000-0000-0000-0000-000000000001');

set local role authenticated;
set local "request.headers" to '{"origin":"https://fv.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9a10000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(space_visit(), true, 'the first visit');
select is(space_visit(), false, 'then they''re back');

set local "request.jwt.claims" to '{"sub":"d9a10000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select is(space_visit(), null, 'someone without a space: unknown');

set local role anon;
select throws_ok($$ select space_visit() $$, '42501', null, 'signed out: closed');

select * from finish();
rollback;
