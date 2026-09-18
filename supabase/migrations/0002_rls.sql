-- Row-level security for the church/authenticated side.
--
-- The anonymous recipient experience (no login) is NOT granted direct table
-- access here. It goes through SECURITY DEFINER RPCs added in later migrations,
-- so the anon role stays locked down by default.
--
-- Leader "awareness, not access": leadership can see conversation METADATA
-- (rows in conversations) but has no select policy on `messages` or on
-- recipient contact details — those are reached only by the owning member, or
-- via metadata-only RPCs. RLS is row-level, so column-sensitive reads
-- (recipient email) are kept behind functions rather than table policies.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid RLS recursion on `users`)
-- ---------------------------------------------------------------------------
create or replace function app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from users where auth_uid = auth.uid() limit 1;
$$;

create or replace function app_user_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from users where auth_uid = auth.uid() limit 1;
$$;

create or replace function is_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'leadership' from users where auth_uid = auth.uid() limit 1),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default)
-- ---------------------------------------------------------------------------
alter table organizations       enable row level security;
alter table users               enable row level security;
alter table sequences           enable row level security;
alter table sequence_screens    enable row level security;
alter table recipients          enable row level security;
alter table sequence_events     enable row level security;
alter table conversations       enable row level security;
alter table messages            enable row level security;
alter table connection_checkins enable row level security;
alter table reports             enable row level security;
alter table resources           enable row level security;
alter table tags                enable row level security;
alter table resource_tags       enable row level security;
alter table resource_progress   enable row level security;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create policy org_select_own on organizations
  for select to authenticated
  using (id = app_user_org());

-- ---------------------------------------------------------------------------
-- Users: same-org members are visible to each other (names/slugs, not secret).
-- A member edits only their own row; leadership may edit any member in the org
-- (e.g. deactivate). Row creation happens via the signup RPC (Sprint 2).
-- ---------------------------------------------------------------------------
create policy users_select_same_org on users
  for select to authenticated
  using (org_id = app_user_org());

create policy users_update_self on users
  for update to authenticated
  using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());

create policy users_update_by_leadership on users
  for update to authenticated
  using (org_id = app_user_org() and is_leadership())
  with check (org_id = app_user_org());

-- ---------------------------------------------------------------------------
-- Sequences + screens: readable by same-org church users; editable by leadership.
-- (Anonymous recipients read approved sequences via RPC, not these policies.)
-- ---------------------------------------------------------------------------
create policy sequences_select_same_org on sequences
  for select to authenticated
  using (org_id = app_user_org());

create policy sequences_write_leadership on sequences
  for all to authenticated
  using (org_id = app_user_org() and is_leadership())
  with check (org_id = app_user_org() and is_leadership());

create policy screens_select_same_org on sequence_screens
  for select to authenticated
  using (exists (
    select 1 from sequences s
    where s.id = sequence_screens.sequence_id and s.org_id = app_user_org()
  ));

create policy screens_write_leadership on sequence_screens
  for all to authenticated
  using (is_leadership() and exists (
    select 1 from sequences s
    where s.id = sequence_screens.sequence_id and s.org_id = app_user_org()
  ))
  with check (is_leadership() and exists (
    select 1 from sequences s
    where s.id = sequence_screens.sequence_id and s.org_id = app_user_org()
  ));

-- ---------------------------------------------------------------------------
-- Recipients: reachable by the owning member (in a shared conversation) only.
-- Leadership reaches recipient metadata via RPC, never this table directly.
-- ---------------------------------------------------------------------------
create policy recipients_select_owning_member on recipients
  for select to authenticated
  using (exists (
    select 1 from conversations c
    where c.recipient_id = recipients.id and c.member_id = app_user_id()
  ));

-- ---------------------------------------------------------------------------
-- Sequence events: leadership reads org telemetry (tracking dashboard).
-- ---------------------------------------------------------------------------
create policy events_select_leadership on sequence_events
  for select to authenticated
  using (org_id = app_user_org() and is_leadership());

-- ---------------------------------------------------------------------------
-- Conversations: the member owns theirs; leadership sees metadata rows only.
-- ---------------------------------------------------------------------------
create policy conversations_select_member on conversations
  for select to authenticated
  using (member_id = app_user_id());

create policy conversations_update_member on conversations
  for update to authenticated
  using (member_id = app_user_id())
  with check (member_id = app_user_id());

create policy conversations_select_leadership_metadata on conversations
  for select to authenticated
  using (org_id = app_user_org() and is_leadership());

-- ---------------------------------------------------------------------------
-- Messages: only the owning member (no leadership select — awareness only).
-- ---------------------------------------------------------------------------
create policy messages_select_member on messages
  for select to authenticated
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id and c.member_id = app_user_id()
  ));

create policy messages_insert_member on messages
  for insert to authenticated
  with check (sender_type = 'member' and exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and c.member_id = app_user_id()
      and c.status = 'active'
  ));

-- ---------------------------------------------------------------------------
-- Check-ins: the member's own.
-- ---------------------------------------------------------------------------
create policy checkins_all_member on connection_checkins
  for all to authenticated
  using (member_id = app_user_id())
  with check (member_id = app_user_id());

-- ---------------------------------------------------------------------------
-- Reports: a member files on their conversation; leadership reads for awareness.
-- ---------------------------------------------------------------------------
create policy reports_insert_member on reports
  for insert to authenticated
  with check (exists (
    select 1 from conversations c
    where c.id = reports.conversation_id and c.member_id = app_user_id()
  ));

create policy reports_select_leadership on reports
  for select to authenticated
  using (exists (
    select 1 from conversations c
    where c.id = reports.conversation_id and c.org_id = app_user_org()
  ) and is_leadership());

-- ---------------------------------------------------------------------------
-- Resources / tags: same-org read; leadership write. (Phase B recipient reads
-- of approved resources come via RPC.)
-- ---------------------------------------------------------------------------
create policy resources_select_same_org on resources
  for select to authenticated
  using (org_id = app_user_org());

create policy resources_write_leadership on resources
  for all to authenticated
  using (org_id = app_user_org() and is_leadership())
  with check (org_id = app_user_org() and is_leadership());

create policy tags_select_same_org on tags
  for select to authenticated
  using (org_id = app_user_org());

create policy tags_write_leadership on tags
  for all to authenticated
  using (org_id = app_user_org() and is_leadership())
  with check (org_id = app_user_org() and is_leadership());

create policy resource_tags_select_same_org on resource_tags
  for select to authenticated
  using (exists (
    select 1 from resources r
    where r.id = resource_tags.resource_id and r.org_id = app_user_org()
  ));

create policy resource_tags_write_leadership on resource_tags
  for all to authenticated
  using (is_leadership() and exists (
    select 1 from resources r
    where r.id = resource_tags.resource_id and r.org_id = app_user_org()
  ))
  with check (is_leadership() and exists (
    select 1 from resources r
    where r.id = resource_tags.resource_id and r.org_id = app_user_org()
  ));

-- resource_progress is seeker-owned (Phase B); no authenticated church policy needed yet.
