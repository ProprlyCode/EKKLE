-- Accounts by address (0023): the address a page was opened on picks the
-- account, and public lookups stay inside it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- A second account with its own member and custom domain.
insert into organizations (id, slug, name, join_code, custom_domain)
  values ('90000000-0000-0000-0000-00000000000b', 'hope', 'Hope Church', 'HOPE01', 'space.hope.test');
insert into users (id, org_id, name, role, code_slug, active)
  values ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-00000000000b',
          'Hana', 'member', 'hana', true);
insert into sequences (id, org_id, title, status)
  values ('90000000-0000-0000-0000-0000000000c1', '90000000-0000-0000-0000-00000000000b', 'Hope flow', 'approved');
update users set active_sequence_id = '90000000-0000-0000-0000-0000000000c1'
  where id = '90000000-0000-0000-0000-000000000001';

-- Addresses → accounts
select is(account_for_host('pilot.ekkle.org'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'subdomain on ekkle.org');
select is(account_for_host('pilot.staging.ekkle.org'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'subdomain on staging');
select is(account_for_host('pilot.localhost:5173'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'subdomain on localhost (dev)');
select is(account_for_host('SPACE.hope.test'), '90000000-0000-0000-0000-00000000000b'::uuid, 'connected custom domain');
select is(account_for_host('ekkle.org'), null, 'ekkle.org itself is no account');
select is(account_for_host('staging.ekkle.org'), null, 'staging.ekkle.org itself is no account');
select is(account_for_host('nobody.ekkle.org'), null, 'unknown subdomain');

select throws_ok($$ insert into organizations (slug, name, join_code, subdomain) values ('w', 'W', 'WWW001', 'www') $$,
  '23514', null, 'reserved subdomains are refused');

-- Member links stay inside their account
set local role anon;
set local "request.headers" to '{"origin":"https://pilot.ekkle.org"}';
select ok(get_recipient_landing('david') is not null, 'pilot address: its own member link opens');
select is(get_recipient_landing('hana'), null, 'pilot address: another account''s link does not');

set local "request.headers" to '{"origin":"https://space.hope.test"}';
select ok(get_recipient_landing('hana') is not null, 'custom domain: its member link opens');
select is(get_recipient_landing('david'), null, 'custom domain: another account''s link does not');

-- The offer page's person comes from the address's account
select is(resolve_offer_member(null), 'hana', 'offer on Hope''s address → Hope''s person');

-- Public facts for the app
select is(resolve_account('pilot.ekkle.org') ->> 'subdomain', 'pilot', 'resolve_account returns the account');

select * from finish();
rollback;
