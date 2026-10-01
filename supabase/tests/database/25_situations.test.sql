-- Situations (0048–0049): Ekklē's flow templates, a ministry's copies, and
-- a member's link for a situation (/r/mo/grief).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into organizations (id, slug, name, join_code, subdomain) values
  ('d9800000-0000-0000-0000-0000000000a1', 'si', 'Situation Ministry', 'SISI01', 'si'),
  ('d9800000-0000-0000-0000-0000000000a2', 'so', 'Other Ministry', 'SOSO01', 'so');
insert into auth.users (id, email) values
  ('d9810000-0000-0000-0000-000000000001', 'lia@si.test'),
  ('d9810000-0000-0000-0000-000000000002', 'mo@si.test'),
  ('d9810000-0000-0000-0000-000000000003', 'owner@si.test'),
  ('d9810000-0000-0000-0000-000000000004', 'sup@si.test'),
  ('d9810000-0000-0000-0000-000000000005', 'ola@so.test');
delete from platform_team;
insert into platform_team (email, auth_uid, role) values
  ('owner@si.test', 'd9810000-0000-0000-0000-000000000003', 'owner'),
  ('sup@si.test', 'd9810000-0000-0000-0000-000000000004', 'support');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('d9800000-0000-0000-0000-0000000000a1', 'd9810000-0000-0000-0000-000000000001', 'Lia', 'leader', 'si-lia'),
  ('d9800000-0000-0000-0000-0000000000a1', 'd9810000-0000-0000-0000-000000000002', 'Mo', 'member', 'si-mo'),
  ('d9800000-0000-0000-0000-0000000000a2', 'd9810000-0000-0000-0000-000000000005', 'Ola', 'leader', 'so-ola');
insert into sequences (id, org_id, title, status) values
  ('d9820000-0000-0000-0000-000000000001', 'd9800000-0000-0000-0000-0000000000a1', 'Main', 'approved');
insert into sequence_screens (sequence_id, sort_order, headline, body) values
  ('d9820000-0000-0000-0000-000000000001', 0, 'hello', 'The main flow.');

select throws_ok($$ update sequences set offered = true where id = 'd9820000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a flow can''t be offered without a situation');

set local role authenticated;

-- ---- The Ekklē team writes a template ----
set local "request.headers" to '{"origin":"https://ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$ select save_flow_template(null, 'Grief', 'Grief!', 'T', '', 'personal', '[]', '', '', '[]', 'draft') $$,
  'P0001', 'invalid_slug', 'link names are lowercase words and hyphens');
select throws_ok($$ select save_flow_template(null, 'Grief', 'test-grief', 'T', '', 'personal', '[]', '', '', '[]', 'published') $$,
  'P0001', 'no_screens', 'a published template needs a screen');
select lives_ok($$ select save_flow_template(null, 'Someone grieving', 'test-grief', 'Not alone', 'After a loss.', 'personal',
  '[{"headline":"so sorry","body":"I''m here."},{"headline":"","body":""},{"headline":"Jesus wept","body":"He comes close."}]',
  'I''m here', 'Write any time.', '[{"label":"Message","kind":"message"}]', 'published') $$, 'the Ekklē team publishes one');
select is((select jsonb_array_length(t -> 'screens') from jsonb_array_elements(platform_flow_templates()) t
            where t ->> 'slug' = 'test-grief'), 2, 'empty screens are dropped');

set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000004","role":"authenticated"}';
select ok(jsonb_array_length(platform_flow_templates()) >= 9, 'Support sees every template, drafts too');
select throws_ok($$ select * from flow_templates $$, '42501', null, 'the table itself is closed');
select throws_ok($$ select save_flow_template(null, 'X', 'x', 'X', '', 'personal', '[]', '', '', '[]', 'draft') $$,
  'P0001', 'forbidden', 'but only Owners and Admins write them');

-- ---- A Leader copies it ----
set local "request.headers" to '{"origin":"https://si.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from jsonb_array_elements(flow_templates_for_ministry()) t where t ->> 'status' = 'draft'), 0,
  'ministries see only published templates');
select lives_ok($$ select use_flow_template((select (t ->> 'id')::uuid from jsonb_array_elements(flow_templates_for_ministry()) t where t ->> 'slug' = 'test-grief')) $$, 'a Leader uses it');
select results_eq($$ select title, status, situation, offered, (select count(*)::int from sequence_screens x where x.sequence_id = s.id)
                    from sequences s where situation_slug = 'test-grief' $$,
  $$ values ('Not alone'::text, 'draft'::text, 'Someone grieving'::text, false, 2) $$,
  'the copy is a draft of the template, not yet offered');
select lives_ok($$ select use_flow_template((select (t ->> 'id')::uuid from jsonb_array_elements(flow_templates_for_ministry()) t where t ->> 'slug' = 'test-grief')) $$, 'and again');
select ok(exists (select 1 from sequences where situation_slug = 'test-grief-2'), 'the second copy gets a free link name');
select throws_ok($$ select set_flow_situation((select id from sequences where situation_slug = 'test-grief-2'), 'Grief', 'test-grief', true) $$,
  'P0001', 'slug_taken', 'link names are unique in the ministry');
select ok((select bool_and(t ? 'copy_id') from jsonb_array_elements(flow_templates_for_ministry()) t)
          and (select (t ->> 'copy_id') is not null from jsonb_array_elements(flow_templates_for_ministry()) t where t ->> 'slug' = 'test-grief'),
  'the gallery knows their copy');

select set_flow_situation((select id from sequences where situation_slug = 'test-grief'), 'Someone grieving', 'grief', true);

-- ---- A member: offered situations only once published ----
set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(my_situations()), 0, 'a draft isn''t offered yet');
select throws_ok($$ select use_flow_template((select (t ->> 'id')::uuid from jsonb_array_elements(flow_templates_for_ministry()) t where t ->> 'slug' = 'test-grief')) $$,
  'P0001', 'forbidden', 'members don''t copy templates');

set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000001","role":"authenticated"}';
update sequences set status = 'approved' where situation_slug = 'grief';

set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(my_situations() -> 0 ->> 'slug', 'grief', 'published and offered: the member sees it');

-- ---- Someone opens /r/si-mo/grief ----
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
select is(get_recipient_landing('si-mo', 'grief') -> 'situation' ->> 'name', 'Someone grieving', 'the situation''s flow opens');
select is(get_recipient_landing('si-mo', 'gone') ->> 'sequence', get_recipient_landing('si-mo') ->> 'sequence',
  'an unknown situation falls back to the main flow');
select log_sequence_event('si-tok', 'si-mo', 'started', 'grief');
select lives_ok($$ select start_conversation('si-tok', 'si-mo', 'Sam', 'sam@si.test', 'Thank you', 'grief') $$,
  'and they write to Mo');

-- ---- Outcomes by flow ----
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select (r ->> 'opened')::int + (r ->> 'wrote')::int from jsonb_array_elements(flow_outcomes(null)) r
            where r ->> 'situation' = 'Someone grieving'), 2, 'opens and messages count toward the situation');

-- ---- Another ministry can't touch it ----
set local "request.headers" to '{"origin":"https://so.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9810000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok($$ select set_flow_situation('d9820000-0000-0000-0000-000000000001', 'Mine', 'mine', true) $$,
  'P0001', 'not_found', 'another ministry''s flows are out of reach');

select * from finish();
rollback;
