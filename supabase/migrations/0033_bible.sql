-- 0033 — The built-in Bible: a person's highlights and notes, and where they
-- left off. Keyed by the person (their login), so they follow them across
-- ministries and devices. Only references are stored — never Bible text
-- (the ESV's terms forbid keeping its text; BSB and KJV are static files).

create table if not exists bible_marks (
  id          uuid primary key default gen_random_uuid(),
  auth_uid    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book        text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter     int  not null check (chapter between 1 and 150),
  verse       int  not null check (verse between 1 and 176),
  color       text check (color in ('yellow', 'green', 'blue', 'pink')),
  note        text check (char_length(note) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (auth_uid, book, chapter, verse),
  check (color is not null or nullif(trim(note), '') is not null)
);
create index if not exists bible_marks_owner_idx on bible_marks (auth_uid, book, chapter);
drop trigger if exists bible_marks_updated_at on bible_marks;
create trigger bible_marks_updated_at before update on bible_marks
  for each row execute function set_updated_at();

create table if not exists bible_state (
  auth_uid     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  translation  text not null default 'bsb' check (translation in ('bsb', 'kjv', 'esv')),
  book         text not null default 'JHN' check (book ~ '^[1-3A-Z]{3}$'),
  chapter      int  not null default 1 check (chapter between 1 and 150),
  updated_at   timestamptz not null default now()
);

alter table bible_marks enable row level security;
alter table bible_state enable row level security;

-- Each person sees and changes only their own.
drop policy if exists bible_marks_own on bible_marks;
create policy bible_marks_own on bible_marks for all to authenticated
  using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());
drop policy if exists bible_state_own on bible_state;
create policy bible_state_own on bible_state for all to authenticated
  using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());

revoke all on bible_marks, bible_state from anon;
grant select, insert, update, delete on bible_marks, bible_state to authenticated;
