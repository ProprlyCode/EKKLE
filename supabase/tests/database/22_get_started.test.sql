-- Get started checklists (0044): steps tick off from what people have done;
-- the app marks the rest; each card is only its own person's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into organizations (id, slug, name, join_code, subdomain)
  values ('d9500000-0000-0000-0000-0000000000b1', 'gs', 'Start Ministry', 'GSGS01', 'gs');
insert into auth.users (id, email) values
  ('d9510000-0000-0000-0000-000000000001', 'ad@gs.test'),
  ('d9510000-0000-0000-0000-000000000002', 'me@gs.test'),
  ('d9510000-0000-0000-0000-000000000003', 'sk@gs.test');
insert into users (id, org_id, auth_uid, name, role, code_slug, short_message) values
  ('d9520000-0000-0000-0000-000000000001', 'd9500000-0000-0000-0000-0000000000b1', 'd9510000-0000-0000-0000-000000000001', 'Ad', 'admin', 'gs-ad', ''),
  ('d9520000-0000-0000-0000-000000000002', 'd9500000-0000-0000-0000-0000000000b1', 'd9510000-0000-0000-0000-000000000002', 'Me', 'member', 'gs-me', 'Hi there');
insert into recipients (org_id, first_name, session_token, auth_uid) values
  ('d9500000-0000-0000-0000-0000000000b1', 'Sk', 'gs-tok', 'd9510000-0000-0000-0000-000000000003');

set local role authenticated;
set local "request.headers" to '{"origin":"https://gs.ekkle.org"}';

-- ---- An Admin ----
set local "request.jwt.claims" to '{"sub":"d9510000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(getting_started('admin') -> 'steps',
  '{"brand":false,"devotional":false,"invite_leader":false,"invite_members":true,"preview_intro":false}'::jsonb,
  'an Admin''s steps come from the ministry');
select lives_ok($$ select mark_getting_started('admin', 'preview_intro') $$, 'the app marks a step');
select is((getting_started('admin') -> 'steps' ->> 'preview_intro')::boolean, true, '…and it''s ticked');
select throws_ok($$ select mark_getting_started('admin', 'brand') $$, 'P0001', 'invalid_step',
  'steps that come from the data can''t be marked');

-- ---- A member ----
set local "request.jwt.claims" to '{"sub":"d9510000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(getting_started('admin'), null, 'a member has no Admin card');
select is((getting_started('member') -> 'steps' ->> 'message')::boolean, true, 'their short message counts');
select lives_ok($$ select dismiss_getting_started('member', true) $$, 'they hide their card');
select is((getting_started('member') ->> 'dismissed')::boolean, true, '…and it stays hidden');

-- ---- A seeker ----
set local "request.jwt.claims" to '{"sub":"d9510000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(getting_started('seeker') -> 'steps',
  '{"study":false,"bible":false,"reminder":false,"install":false}'::jsonb, 'a seeker''s card');
select throws_ok($$ select * from getting_started $$, '42501', null, 'the table itself is closed');

select * from finish();
rollback;
