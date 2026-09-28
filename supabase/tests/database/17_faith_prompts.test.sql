-- Faith in action (0039): members see this week's prompt and the rest
-- (published only); ministries add their own; nobody edits another's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into organizations (id, slug, name, join_code)
  values ('c9000000-0000-0000-0000-0000000000c1', 'fa', 'Faith Ministry', 'FAFA01');
insert into auth.users (id, email) values
  ('c9100000-0000-0000-0000-000000000001', 'leader@fa.test'),
  ('c9100000-0000-0000-0000-000000000002', 'member@fa.test'),
  ('c9100000-0000-0000-0000-000000000003', 'seeker@fa.test');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('c9000000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-000000000001', 'Lia', 'leader', 'fa-lia'),
  ('c9000000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-000000000002', 'Max', 'member', 'fa-max');
-- Whatever an earlier run left: Ekklē's all drafts, then one published.
update faith_prompts set status = 'draft' where org_id is null;
-- One of Ekklē's published, to see.
update faith_prompts set status = 'published'
 where id = (select id from faith_prompts where org_id is null order by created_at limit 1);

select set_config('test.ekkle', (select id::text from faith_prompts where org_id is null limit 1), true);

set local role authenticated;
set local "request.headers" to '{"origin":"https://fa.ekkle.org"}';

set local "request.jwt.claims" to '{"sub":"c9100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(faith_prompts() -> 'prompts'), 1, 'members see published prompts only (the drafts wait)');
select ok(faith_prompts() -> 'this_week' ->> 'body' is not null, 'there is a prompt for this week');
select throws_ok($$ select save_faith_prompt(null, 'moment', 'Mine', 'published') $$, 'P0001', 'forbidden',
  'a Member doesn''t write prompts');

set local "request.jwt.claims" to '{"sub":"c9100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select save_faith_prompt(null, 'other', 'Mine', 'published') $$, 'P0001', 'invalid_kind', 'kinds are checked');
select lives_ok($$ select save_faith_prompt(null, 'starter', '“What are you hoping for this year?”', 'published') $$,
  'a Leader adds one for the ministry');
select throws_ok($$ select save_faith_prompt(current_setting('test.ekkle')::uuid, 'moment', 'x', 'published') $$,
  'P0001', 'forbidden', 'a Leader can''t change Ekklē''s');

set local "request.jwt.claims" to '{"sub":"c9100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(faith_prompts() -> 'prompts'), 2, 'members see the ministry''s own too');

set local "request.jwt.claims" to '{"sub":"c9100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(faith_prompts(), null, 'not for people outside the team');

select * from finish();
rollback;
