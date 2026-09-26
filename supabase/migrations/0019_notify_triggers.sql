-- 0019 — call the notification functions when messages and reports arrive.
--
-- A new message or incident report triggers an async HTTP call (pg_net) to the
-- matching Edge Function (`notify`, `notify-report`), which emails the right
-- people through Resend. The call never blocks or fails the insert.
--
-- Where to call, and the shared secret the functions check, live in one private
-- config row that CI writes on deploy. Until that row exists (local, CI test
-- databases, or before email is set up) the trigger does nothing.

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.notify_config (
  id        boolean primary key default true check (id), -- single row
  base_url  text not null,                               -- https://<ref>.supabase.co
  secret    text not null                                -- matches NOTIFY_SECRET
);
revoke all on private.notify_config from public, anon, authenticated;

create or replace function private.notify_edge(p_function text, p_record jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select base_url, secret into v_url, v_secret from private.notify_config limit 1;
  if v_url is null then
    return; -- email not configured here
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/' || p_function,
    body := jsonb_build_object('record', p_record),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ekkle-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
exception when others then
  -- Notifications are best-effort; never lose the message over them.
  raise warning 'notify_edge(%) failed: %', p_function, sqlerrm;
end;
$$;
revoke execute on function private.notify_edge(text, jsonb) from public, anon, authenticated;

create or replace function private.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_edge('notify', to_jsonb(new));
  return new;
end;
$$;

create or replace function private.on_report_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_edge('notify-report', to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function private.on_message_inserted();

drop trigger if exists reports_notify on public.reports;
create trigger reports_notify
  after insert on public.reports
  for each row execute function private.on_report_inserted();
