-- Incident reports for leadership: view + acknowledge safeguarding reports, and
-- a count that drives an in-app alert. Email ping rides a new notify-report
-- webhook (see supabase/functions/notify-report).
--
-- Leaders see incident metadata + the reporter's note — never message contents.

alter table reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references users (id) on delete set null;

-- All incident reports for the leader's org, newest first.
create or replace function list_reports()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'reason', r.reason,
    'reporter_type', r.reporter_type,
    'created_at', r.created_at,
    'reviewed', r.reviewed_at is not null,
    'conversation_status', c.status,
    'member_name', mu.name,
    'recipient_name', case when rec.deleted_at is not null then null
                          else nullif(rec.first_name, '') end
  ) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from reports r
  join conversations c on c.id = r.conversation_id
  join users mu on mu.id = c.member_id
  join recipients rec on rec.id = c.recipient_id
  where c.org_id = app_user_org();

  return v_result;
end;
$$;
grant execute on function list_reports() to authenticated;

-- Count of not-yet-reviewed reports (drives the in-app alert dot).
create or replace function open_reports_count()
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int
  from reports r
  join conversations c on c.id = r.conversation_id
  where c.org_id = app_user_org()
    and is_leadership()
    and r.reviewed_at is null;
$$;
grant execute on function open_reports_count() to authenticated;

-- Acknowledge a report (leadership, org-scoped).
create or replace function resolve_report(p_report_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  update reports r
     set reviewed_at = now(), reviewed_by = app_user_id()
    from conversations c
   where r.id = p_report_id
     and c.id = r.conversation_id
     and c.org_id = app_user_org();
end;
$$;
grant execute on function resolve_report(uuid) to authenticated;
