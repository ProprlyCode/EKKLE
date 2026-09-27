-- The member-link landing carries everything the seeker's flow needs, including
-- the ending (`connect`) its final screen reads. 0021 re-applied this after the
-- live database was found missing it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

set local role anon;

select ok(get_recipient_landing('david') ? 'connect',
  'landing includes the flow ending (connect)');
select is(jsonb_typeof(get_recipient_landing('david') -> 'connect' -> 'ctas'), 'array',
  'the ending''s actions are a list');
select ok(jsonb_array_length(get_recipient_landing('david') -> 'screens') > 0,
  'landing includes the flow''s screens');

select * from finish();
rollback;
