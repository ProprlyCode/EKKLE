-- The built-in Bible (0033): highlights, notes and "where I left off" belong
-- to the person alone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 'reader-a@test'),
  ('d1000000-0000-0000-0000-000000000002', 'reader-b@test');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ insert into bible_marks (book, chapter, verse, color, note) values ('JHN', 3, 16, 'yellow', 'Loved') $$,
  'a reader highlights a verse with a note');
select lives_ok($$ insert into bible_state (translation, book, chapter) values ('kjv', 'ROM', 8) $$,
  'and their place is kept');
select throws_ok($$ insert into bible_marks (book, chapter, verse) values ('JHN', 3, 17) $$, '23514', null,
  'a mark needs a colour or a note');
select throws_ok($$ insert into bible_marks (auth_uid, book, chapter, verse, color)
                    values ('d1000000-0000-0000-0000-000000000002', 'JHN', 1, 1, 'blue') $$, '42501', null,
  'nobody writes marks for someone else');

set local "request.jwt.claims" to '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from bible_marks), 0, 'another reader sees none of them');
select is((select count(*)::int from bible_state), 0, '…nor where they left off');

select * from finish();
rollback;
