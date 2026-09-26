-- Notification wiring (0019): triggers exist, never block inserts, and the
-- private config (function URL + shared secret) is unreachable from the API.

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_trigger('public', 'messages', 'messages_notify', 'messages fire the notify trigger');
select has_trigger('public', 'reports', 'reports_notify', 'reports fire the notify-report trigger');

-- With no config row (as in CI/local), inserts still succeed.
insert into organizations (id, slug, name, join_code)
  values ('60000000-0000-0000-0000-00000000000a', 'notify-test', 'Notify test', 'NOTIFYT');
insert into users (id, org_id, name, role, code_slug)
  values ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-00000000000a',
          'N member', 'member', 'notify-test-m');
insert into recipients (id, org_id, first_name, session_token)
  values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-00000000000a', 'N', 'tok-notify');
insert into conversations (id, org_id, member_id, recipient_id)
  values ('60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-00000000000a',
          '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002');

select lives_ok(
  $$ insert into messages (conversation_id, sender_type, body)
     values ('60000000-0000-0000-0000-000000000003', 'recipient', 'hi') $$,
  'a message saves even when email is not configured');
select lives_ok(
  $$ insert into reports (conversation_id, reporter_type, reason)
     values ('60000000-0000-0000-0000-000000000003', 'member', 'test') $$,
  'a report saves even when email is not configured');

-- The secret stays private.
set local role anon;
select throws_ok($$ select * from private.notify_config $$, '42501', null,
  'anon: cannot read the notification config');
reset role;
set local role authenticated;
select throws_ok($$ select * from private.notify_config $$, '42501', null,
  'signed-in users: cannot read the notification config');

select * from finish();
rollback;
