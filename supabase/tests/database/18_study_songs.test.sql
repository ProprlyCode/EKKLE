-- A song for a study's Experience section (0040, audio only): the Ekklē team sets the
-- default; a ministry keeps it, swaps in its own, or offers none; people get
-- their ministry's choice.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into organizations (id, slug, name, join_code)
  values ('d9000000-0000-0000-0000-0000000000d1', 'sg', 'Song Ministry', 'SGSG01');
insert into auth.users (id, email) values
  ('d9100000-0000-0000-0000-000000000001', 'owner@sg.test'),
  ('d9100000-0000-0000-0000-000000000002', 'leader@sg.test'),
  ('d9100000-0000-0000-0000-000000000003', 'seeker@sg.test');
delete from platform_team;
insert into platform_team (email, auth_uid, role) values ('owner@sg.test', 'd9100000-0000-0000-0000-000000000001', 'owner');
insert into users (org_id, auth_uid, name, role, code_slug) values
  ('d9000000-0000-0000-0000-0000000000d1', 'd9100000-0000-0000-0000-000000000002', 'Lia', 'leader', 'sg-lia');
insert into recipients (org_id, first_name, email, session_token, auth_uid) values
  ('d9000000-0000-0000-0000-0000000000d1', 'Sy', 'seeker@sg.test', 'sg-tok', 'd9100000-0000-0000-0000-000000000003');
select set_config('test.love', (select id::text from studies where title = 'The Logic of Love'), true);

set local role authenticated;

-- ---- The Ekklē team sets the default ----
set local "request.headers" to '{"origin":"https://ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select set_study_song(current_setting('test.love')::uuid, '{"kind":"soundcloud","url":"https://evil.example/x","title":"X"}') $$,
  'P0001', 'invalid_song', 'only SoundCloud links and uploaded files');
select lives_ok($$ select set_study_song(current_setting('test.love')::uuid,
  '{"kind":"soundcloud","url":"https://soundcloud.com/someone/default-song","title":"Default song","artist":"Someone"}') $$, 'the Ekklē team sets the song');

-- ---- A ministry ----
set local "request.headers" to '{"origin":"https://sg.ekkle.org"}';
set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(seeker_study(current_setting('test.love')::uuid) -> 'song' ->> 'title', 'Default song', 'people get the default');

set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select set_study_song(current_setting('test.love')::uuid, null) $$, 'P0001', 'forbidden',
  'a Leader can''t change Ekklē''s default');
select lives_ok($$ select set_ministry_study_song(current_setting('test.love')::uuid, 'own',
  '{"kind":"file","path":"d9000000-0000-0000-0000-0000000000d1/our-song.mp3","title":"Our song","artist":"Us"}') $$, 'a Leader swaps in their own');
select is((select b ->> 'song_choice' from jsonb_array_elements(ministry_study_bank()) b
            where b ->> 'id' = current_setting('test.love')), 'own', 'Resources shows their choice');

set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(seeker_study(current_setting('test.love')::uuid) -> 'song' ->> 'title', 'Our song', 'people get the ministry''s song');

set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select set_ministry_study_song(current_setting('test.love')::uuid, 'none', null) $$, 'or no song');
set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(seeker_study(current_setting('test.love')::uuid) -> 'song', 'null'::jsonb, '…and then there is none');

set local "request.jwt.claims" to '{"sub":"d9100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ select set_ministry_study_song(current_setting('test.love')::uuid, 'default', null) $$,
  'and back to the default');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('songs', 'd9000000-0000-0000-0000-0000000000d1/ours.mp3') $$,
  'a Leader uploads into their ministry''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('songs', 'ekkle/theirs.mp3') $$,
  '42501', null, '…and nowhere else');

select * from finish();
rollback;
