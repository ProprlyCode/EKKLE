-- Ekklē v1 schema (single-tenant pilot).
--
-- Design notes for future change:
--  * Status/role/event fields use text + CHECK constraints, not Postgres enums,
--    so values can be added or renamed without fragile enum migrations.
--  * Every table has org_id even though v1 has one org — multi-tenant later is
--    then a policy change, not a reshape.
--  * Phase B tables (resources, tags, resource_tags, resource_progress) are
--    created now but only exercised once Phase B UI ships.

create extension if not exists "pgcrypto";

-- Keep updated_at fresh on tables that track edits.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations (single row in v1)
-- ---------------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  join_code   text not null unique, -- shared code for member self-signup
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Users (church-side app profile; linked to Supabase auth.users)
-- ---------------------------------------------------------------------------
create table users (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  auth_uid      uuid unique references auth.users (id) on delete set null,
  name          text not null,
  role          text not null default 'member' check (role in ('member', 'leadership')),
  code_slug     text not null unique,
  short_message text not null default '' check (char_length(short_message) <= 60),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index users_org_id_idx on users (org_id);
create index users_auth_uid_idx on users (auth_uid);
create trigger users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Sequences + screens (leadership-authored guided flows)
-- ---------------------------------------------------------------------------
create table sequences (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  title       text not null,
  type        text not null default 'gospel', -- first type; not hardcoded elsewhere
  status      text not null default 'draft' check (status in ('draft', 'approved')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index sequences_org_id_idx on sequences (org_id);
create trigger sequences_updated_at
  before update on sequences
  for each row execute function set_updated_at();

create table sequence_screens (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references sequences (id) on delete cascade,
  sort_order   integer not null default 0,
  headline     text not null default '',
  body         text not null default '',
  icon         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index sequence_screens_sequence_id_idx on sequence_screens (sequence_id, sort_order);
create trigger sequence_screens_updated_at
  before update on sequence_screens
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Recipients (anonymous until they message; may later attach a free account)
-- ---------------------------------------------------------------------------
create table recipients (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  first_name        text not null default '',
  email             text,
  session_token     text not null unique, -- device/session handle, no login required
  auth_uid          uuid unique references auth.users (id) on delete set null, -- Phase B seeker account
  arrival_member_id uuid references users (id) on delete set null, -- whose /r/:slug they arrived on
  consented_at      timestamptz, -- stamped at email capture
  deleted_at        timestamptz, -- soft-delete / erasure
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index recipients_org_id_idx on recipients (org_id);
create index recipients_auth_uid_idx on recipients (auth_uid);
create trigger recipients_updated_at
  before update on recipients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Telemetry: minimal, concept-proving events only
-- ---------------------------------------------------------------------------
create table sequence_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  member_id      uuid references users (id) on delete set null,
  recipient_id   uuid references recipients (id) on delete set null,
  session_token  text not null,
  sequence_id    uuid references sequences (id) on delete set null,
  event          text not null check (event in ('started', 'completed', 'messaged')),
  created_at     timestamptz not null default now()
);
create index sequence_events_org_id_idx on sequence_events (org_id, created_at);
create index sequence_events_member_id_idx on sequence_events (member_id);

-- ---------------------------------------------------------------------------
-- Conversations + messages (contained 1:1 space)
-- ---------------------------------------------------------------------------
create table conversations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  member_id     uuid not null references users (id) on delete cascade,
  recipient_id  uuid not null references recipients (id) on delete cascade,
  status        text not null default 'active' check (status in ('active', 'blocked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (member_id, recipient_id)
);
create index conversations_member_id_idx on conversations (member_id);
create index conversations_recipient_id_idx on conversations (recipient_id);
create trigger conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  sender_type      text not null check (sender_type in ('member', 'recipient')),
  body             text not null check (char_length(body) between 1 and 4000),
  created_at       timestamptz not null default now()
);
create index messages_conversation_id_idx on messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Connection check-ins (member self-report) + reports (safeguarding)
-- ---------------------------------------------------------------------------
create table connection_checkins (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references users (id) on delete cascade,
  recipient_id  uuid not null references recipients (id) on delete cascade,
  connected     text not null check (connected in ('yes', 'not_yet', 'no')),
  created_at    timestamptz not null default now()
);
create index connection_checkins_member_id_idx on connection_checkins (member_id);

create table reports (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  reporter_type    text not null check (reporter_type in ('member', 'recipient')),
  reason           text not null default '',
  created_at       timestamptz not null default now()
);
create index reports_conversation_id_idx on reports (conversation_id);

-- ---------------------------------------------------------------------------
-- Phase B: resource hub (created now, exercised later)
-- ---------------------------------------------------------------------------
create table resources (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete cascade,
  title           text not null default '',
  blurb           text not null default '',
  body            text not null default '', -- rich content w/ embedded video links
  status          text not null default 'draft' check (status in ('draft', 'approved')),
  sort_order      integer not null default 0,
  offers_connect  boolean not null default false, -- a leadership-chosen connect point
  file_path       text, -- Storage path for a downloadable file (PDF etc.)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index resources_org_id_idx on resources (org_id);
create trigger resources_updated_at
  before update on resources
  for each row execute function set_updated_at();

create table tags (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references organizations (id) on delete cascade,
  name    text not null,
  unique (org_id, name)
);

create table resource_tags (
  resource_id  uuid not null references resources (id) on delete cascade,
  tag_id       uuid not null references tags (id) on delete cascade,
  primary key (resource_id, tag_id)
);

create table resource_progress (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references recipients (id) on delete cascade,
  resource_id    uuid not null references resources (id) on delete cascade,
  last_position  integer not null default 0,
  saved          boolean not null default false,
  updated_at     timestamptz not null default now(),
  unique (recipient_id, resource_id)
);
create trigger resource_progress_updated_at
  before update on resource_progress
  for each row execute function set_updated_at();
