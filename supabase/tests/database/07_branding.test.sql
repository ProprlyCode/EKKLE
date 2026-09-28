-- Branding (0024): leaders set their account's name, accent and logo; the
-- accent must read clearly; logos live in the account's own folder.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- A leader (Sarah) and a member (David) of the pilot account, signed in.
insert into auth.users (id, email) values
  ('70000000-0000-0000-0000-000000000001', 'brand-leader@test'),
  ('70000000-0000-0000-0000-000000000002', 'brand-member@test');
update users set auth_uid = '70000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-0000000000b1';
update users set auth_uid = '70000000-0000-0000-0000-000000000002' where id = '00000000-0000-0000-0000-0000000000b2';

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select set_account_branding('Mine now', null, null) $$,
  'P0001', 'forbidden', 'a member cannot change the branding');

set local "request.jwt.claims" to '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(set_account_branding('Grace Chapel', '#1D4ED8', '00000000-0000-0000-0000-0000000000a1/1/logo.png') ->> 'accent_color',
  '#1d4ed8', 'a leader sets name, accent (normalised) and logo');
select throws_ok($$ select set_account_branding('Grace Chapel', '#ffcc00', null) $$,
  'P0001', 'accent_unreadable', 'an accent too light to read is refused');
select throws_ok($$ select set_account_branding('Grace Chapel', 'blue', null) $$,
  'P0001', 'accent_unreadable', 'an accent that is not a colour is refused');
select throws_ok($$ select set_account_branding('  ', null, null) $$,
  'P0001', 'name_required', 'the name cannot be empty');
select throws_ok($$ select set_account_branding('Grace Chapel', null, '90000000-0000-0000-0000-00000000000b/1/logo.png') $$,
  'P0001', 'forbidden', 'a logo from another account''s folder is refused');

-- Logo uploads: own folder only.
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('branding', '00000000-0000-0000-0000-0000000000a1/2/logo.png') $$,
  'a leader uploads into their account''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('branding', '90000000-0000-0000-0000-00000000000b/2/logo.png') $$,
  '42501', null, 'a leader cannot upload into another account''s folder');

set local "request.jwt.claims" to '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('branding', '00000000-0000-0000-0000-0000000000a1/3/logo.png') $$,
  '42501', null, 'a member cannot upload branding');

-- The account's pages see the result.
reset role;
set local role anon;
select is(resolve_account('pilot.ekkle.org') ->> 'name', 'Grace Chapel', 'the new name shows on the account''s address');
select is(resolve_account('pilot.ekkle.org') ->> 'logo_path', '00000000-0000-0000-0000-0000000000a1/1/logo.png', 'and the logo');

-- Anyone may update an account directly where they're allowed to (the
-- service key, maintenance): the colour check itself needs no special rights.
reset role;
set local role service_role;
select lives_ok($$ update organizations set accent_color = null where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'the service key can update an account (the check needs no private rights)');
select throws_ok($$ update organizations set accent_color = '#ffcc00' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'and an unreadable accent is still refused on the table');

select * from finish();
rollback;
