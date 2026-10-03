-- 0051 — Your space knows a first visit: "Welcome" the first time someone
-- opens it, "Welcome back" after that.

alter table recipients add column if not exists space_first_seen_at timestamptz;

-- Called once per browser session from Your space: true on the very first
-- visit (and marks it), false after; null when they aren't linked yet.
create or replace function space_visit()
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_rec recipients := _seeker_rec();
begin
  if v_rec.id is null then return null; end if;
  if v_rec.space_first_seen_at is not null then return false; end if;
  update recipients set space_first_seen_at = now() where id = v_rec.id;
  return true;
end;
$$;
revoke execute on function space_visit() from public, anon;
grant execute on function space_visit() to authenticated;
