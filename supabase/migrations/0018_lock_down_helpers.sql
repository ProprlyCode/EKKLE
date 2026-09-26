-- 0018 — lock down internal helpers (Supabase security advisor).
--
-- These functions are only meant to be called from inside other SECURITY
-- DEFINER functions (which run as the function owner), never directly over the
-- API. Postgres grants EXECUTE to PUBLIC by default, and Supabase also grants it
-- to anon/authenticated, which exposed them at /rest/v1/rpc/<name>. Revoking
-- those grants hides them from the API without affecting any caller: every
-- function that uses them is SECURITY DEFINER, and none of them appear in an
-- RLS policy or a client .rpc() call.

revoke execute on function public._seeker_member(public.recipients) from public, anon, authenticated;
revoke execute on function public._seeker_rec() from public, anon, authenticated;
revoke execute on function public._study_org(text) from public, anon, authenticated;
revoke execute on function public._study_recipient(text, uuid) from public, anon, authenticated;
revoke execute on function public.auth_email() from public, anon, authenticated;
revoke execute on function public.generate_member_slug(text) from public, anon, authenticated;
revoke execute on function public.member_active_sequence_id(public.users) from public, anon, authenticated;

-- set_updated_at is a trigger function; pin its search_path so it can't be
-- redirected by a caller's search_path. It only uses now() (pg_catalog).
alter function public.set_updated_at() set search_path = '';
