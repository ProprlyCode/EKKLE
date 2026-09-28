-- The study editor (0034): the Ekklē team keeps Ekklē's series, a ministry's
-- Admins and Leaders keep their own; drafts publish only with every answer;
-- a locked series can't change; people see answers only after submitting;
-- studies unlock within their series.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-000000000001', 'owner@ed.test'),
  ('e1000000-0000-0000-0000-000000000002', 'support@ed.test'),
  ('e1000000-0000-0000-0000-000000000003', 'leader@ed.test'),
  ('e1000000-0000-0000-0000-000000000004', 'member@ed.test'),
  ('e1000000-0000-0000-0000-000000000005', 'seeker@ed.test');
delete from platform_team;
insert into platform_team (email, auth_uid, role) values
  ('owner@ed.test', 'e1000000-0000-0000-0000-000000000001', 'owner'),
  ('support@ed.test', 'e1000000-0000-0000-0000-000000000002', 'support');
insert into organizations (id, slug, name, join_code)
  values ('e0000000-0000-0000-0000-00000000000e', 'ed', 'Editor Ministry', 'EDED01');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-000000000003', 'Lia', 'leader', 'ed-lia'),
  ('e0000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-000000000004', 'Max', 'member', 'ed-max');
insert into recipients (org_id, first_name, email, session_token, auth_uid) values
  ('e0000000-0000-0000-0000-00000000000e', 'Sy', 'seeker@ed.test', 'ed-tok', 'e1000000-0000-0000-0000-000000000005');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

set local role authenticated;

-- ---- The Ekklē team, on ekkle.org ----
set local "request.headers" to '{"origin":"https://ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select study_library() $$, 'P0001', 'forbidden', 'Support can''t edit studies');

set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(study_library() -> 0 ->> 'title' is not null, 'an Owner sees Ekklē''s series');
insert into ids values ('series', save_study_series(null, 'Test series'));
insert into ids values ('s1', create_study((select v from ids where k = 'series'),
  '{"title":"One","pages":[{"blocks":[{"t":"p","text":"God is {{}} and {{}}"}]}],"answers":["love"]}'));
select throws_ok($$ select publish_study((select v from ids where k = 's1')) $$, 'P0001', 'answers_mismatch',
  'every blank needs an answer to publish');
select lives_ok($$ select save_study_draft((select v from ids where k = 's1'),
  '{"title":"One","pages":[{"blocks":[{"t":"p","text":"God is {{}} and {{}}"}]},{"blocks":[{"t":"h","text":"End"}]}],"answers":["love","light"]}') $$,
  'the draft is saved');
select lives_ok($$ select publish_study((select v from ids where k = 's1')) $$, '…and published');
insert into ids values ('s2', create_study((select v from ids where k = 'series'),
  '{"title":"Two","pages":[{"blocks":[{"t":"p","text":"No blanks"}]}],"answers":[]}'));
select lives_ok($$ select publish_study((select v from ids where k = 's2')) $$, 'a second study is published');
insert into ids values ('s5', create_study((select v from ids where k = 'series'),
  '{"title":"Five","pages":[{"blocks":[{"t":"p","text":"I think {{}}"}]}],"answers":[""],"open":[true]}'));
select lives_ok($$ select publish_study((select v from ids where k = 's5')) $$,
  'a blank with no set answer publishes (0036)');
insert into ids values ('s3', create_study((select v from ids where k = 'series'), '{"title":"Three","pages":[]}'));
select throws_ok($$ select lock_study_series((select v from ids where k = 'series')) $$, 'P0001', 'unpublished_changes',
  'a series with unpublished work can''t be locked');
select lives_ok($$ select discard_study_draft((select v from ids where k = 's3')) $$, 'an unpublished study is discarded');
select lives_ok($$ select lock_study_series((select v from ids where k = 'series')) $$, 'then the series is locked');
select throws_ok($$ select save_study_draft((select v from ids where k = 's1'), '{"pages":[]}') $$, 'P0001', 'series_locked',
  'a locked series can''t be edited');
select throws_ok($$ select create_study((select v from ids where k = 'series'), '{"title":"Four","pages":[]}') $$,
  'P0001', 'series_locked', '…or added to');
select lives_ok($$ select set_study_series_credit((select v from ids where k = 'series'), 'Test Source', 'example.org') $$,
  'the credit can still be set on a locked series (0037)');

reset role;
select is((select count(*)::int from study_pages where study_id = (select v from ids where k = 's1')), 2,
  'publishing writes the pages');
select is((select answers from studies where id = (select v from ids where k = 's1')), array['love', 'light'],
  '…and the answers');
select is((select count(*)::int from studies where id = (select v from ids where k = 's3')), 0,
  'the discarded study is gone');
set local role authenticated;

-- ---- A ministry ----
set local "request.headers" to '{"origin":"https://ed.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$ select study_library() $$, 'P0001', 'forbidden', 'a Member can''t edit studies');
set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$ select editor_study((select v from ids where k = 's1')) $$, 'P0001', 'forbidden',
  'a Leader can''t edit Ekklē''s studies');
select is(jsonb_array_length(study_library()), 0, 'a Leader''s library starts empty (only their own)');
select throws_ok($$ select set_study_series_credit((select v from ids where k = 'series'), 'Mine', null) $$,
  'P0001', 'forbidden', 'a Leader can''t change Ekklē''s credit');
select lives_ok($$ select create_study(save_study_series(null, 'Ours'), '{"title":"Ours one","pages":[]}') $$,
  'a Leader starts their own series and study');

-- ---- People ----
set local "request.jwt.claims" to '{"sub":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}';
select ok((select (s ->> 'locked')::boolean from jsonb_array_elements(seeker_studies()) s where s ->> 'title' = 'Two'),
  'the next study in a series is locked until the one before is finished');
select is(seeker_study((select v from ids where k = 's1')) -> 'answers', 'null'::jsonb,
  'answers stay hidden until the study is submitted');
select lives_ok($$ select seeker_complete_study((select v from ids where k = 's1'), '{"0":"love","1":"life"}') $$, 'the study is submitted');
select is(seeker_study((select v from ids where k = 's1')) -> 'answers', '["love", "light"]'::jsonb,
  'after submitting, people see the answers');
select is(seeker_study((select v from ids where k = 's1')) ->> 'credit', 'Test Source', 'people see where the study comes from');
select is(seeker_study((select v from ids where k = 's1')) ->> 'credit_url', 'https://example.org', '…with a proper link');

select * from finish();
rollback;
