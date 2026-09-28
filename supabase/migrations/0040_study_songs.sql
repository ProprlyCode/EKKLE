-- 0040 — A song for a study's Experience section (audio only).
--
--   * Each study can carry a song, set by whoever keeps the study (Ekklē's by
--     the Ekklē team): a SoundCloud link (its slim audio player — full songs,
--     licensing handled by SoundCloud) or an uploaded audio file (for songs
--     the uploader has the rights to). Title and artist are shown with it.
--   * When someone reaches the study's Experience section, a quiet card
--     offers it; nothing plays until they tap.
--   * A ministry can swap it: keep the default, use its own song, or offer no
--     song (ministry_study_songs; a row with song null means none).
--   * Uploads go to the public `songs` bucket: the Ekklē team in `ekkle/`, a
--     ministry's Admins and Leaders in their own folder.

-- {"kind": "soundcloud", "url": "https://soundcloud.com/…", "title", "artist"}
-- {"kind": "file", "path": "<folder>/<name>", "title", "artist"}
create or replace function public.valid_song(p_song jsonb)
returns boolean language sql immutable set search_path = public
as $$
  select p_song is null or (
    jsonb_typeof(p_song) = 'object'
    and char_length(coalesce(p_song ->> 'title', '')) between 1 and 120
    and char_length(coalesce(p_song ->> 'artist', '')) <= 120
    and case p_song ->> 'kind'
          when 'soundcloud' then coalesce(p_song ->> 'url', '') ~ '^https://(www\.|m\.)?soundcloud\.com/[^\s"<>]+$'
          when 'file' then coalesce(p_song ->> 'path', '') ~ '^[a-z0-9-]+/[A-Za-z0-9._-]+$'
          else false
        end);
$$;
-- (Public: it's a plain check, used by table constraints whoever writes.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('songs', 'songs', true, 20971520,
        array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Where the caller may upload: 'ekkle' for the Ekklē team on ekkle.org, else
-- their ministry's id (Admins and Leaders).
create or replace function public.song_folder()
returns text language sql stable security definer set search_path = public
as $$
  select case when app_user_org() is null and is_platform_admin() then 'ekkle'
              when is_leadership() then app_user_org()::text end;
$$;
revoke execute on function public.song_folder() from public, anon;
grant execute on function public.song_folder() to authenticated;

drop policy if exists "songs: upload" on storage.objects;
drop policy if exists "songs: replace" on storage.objects;
drop policy if exists "songs: remove" on storage.objects;
create policy "songs: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'songs' and (storage.foldername(name))[1] = public.song_folder());
create policy "songs: replace" on storage.objects for update to authenticated
  using (bucket_id = 'songs' and (storage.foldername(name))[1] = public.song_folder());
create policy "songs: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'songs' and (storage.foldername(name))[1] = public.song_folder());

alter table studies add column if not exists song jsonb;
alter table studies drop constraint if exists studies_song_check;
alter table studies add constraint studies_song_check check (public.valid_song(song));

create table if not exists ministry_study_songs (
  org_id    uuid not null references organizations (id) on delete cascade,
  study_id  uuid not null references studies (id) on delete cascade,
  song      jsonb check (public.valid_song(song)), -- null: no song for this ministry
  primary key (org_id, study_id)
);
alter table ministry_study_songs enable row level security;
revoke all on ministry_study_songs from anon, authenticated;

-- The song a ministry's people get for a study (its own choice, else the default).
create or replace function private.study_song(p_study uuid, p_org uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select case when ms.study_id is not null then ms.song else s.song end
  from studies s
  left join ministry_study_songs ms on ms.study_id = s.id and ms.org_id = p_org
  where s.id = p_study;
$$;
revoke execute on function private.study_song(uuid, uuid) from public;

-- Whoever keeps the study sets its song (also after the series is locked —
-- it isn't the study's content). p_song null removes it.
create or replace function set_study_song(p_study uuid, p_song jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.valid_song(p_song) then raise exception 'invalid_song'; end if;
  update studies s set song = p_song
   where s.id = p_study and exists (select 1 from private.author_scope() a
                                     where a.org_id is not distinct from s.org_id);
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- A ministry's choice for a study it offers: 'default', 'own' (with p_song) or 'none'.
create or replace function set_ministry_study_song(p_study uuid, p_choice text, p_song jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org uuid := app_user_org();
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  if not exists (select 1 from studies where id = p_study and (org_id is null or org_id = v_org)) then
    raise exception 'forbidden';
  end if;
  if p_choice = 'default' then
    delete from ministry_study_songs where org_id = v_org and study_id = p_study;
  elsif p_choice in ('own', 'none') then
    if p_choice = 'own' and (p_song is null or not public.valid_song(p_song)) then
      raise exception 'invalid_song';
    end if;
    insert into ministry_study_songs (org_id, study_id, song)
    values (v_org, p_study, case when p_choice = 'own' then p_song end)
    on conflict (org_id, study_id) do update set song = excluded.song;
  else
    raise exception 'invalid_choice';
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['set_study_song(uuid, jsonb)', 'set_ministry_study_song(uuid, text, jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

create or replace function seeker_study(p_study_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_rec recipients; v_study studies; v_rn bigint; v_n bigint; v_locked boolean;
        v_done boolean; v_result jsonb;
begin
  v_rec := _seeker_rec();
  if v_rec.id is null then return null; end if;
  select o.rn into v_rn from private.ministry_study_order(v_rec.org_id) o
   where o.study_id = p_study_id and o.enabled;
  if v_rn is null then return null; end if;
  select * into v_study from studies where id = p_study_id;

  v_locked := exists (
    select 1 from private.ministry_study_order(v_rec.org_id) e
    join studies es on es.id = e.study_id and es.series_id = v_study.series_id
    where e.enabled and e.rn < v_rn
      and not exists (select 1 from study_progress p
        where p.study_id = e.study_id and p.recipient_id = v_rec.id and p.completed_at is not null));
  if v_locked then return jsonb_build_object('locked', true); end if;

  select count(*) into v_n from private.ministry_study_order(v_rec.org_id) e
    join studies es on es.id = e.study_id and es.series_id = v_study.series_id
   where e.enabled and e.rn <= v_rn;
  v_done := exists (select 1 from study_progress p where p.study_id = v_study.id
                     and p.recipient_id = v_rec.id and p.completed_at is not null);

  select jsonb_build_object(
    'id', v_study.id, 'number', v_n, 'title', v_study.title,
    'tagline', v_study.tagline, 'locked', false,
    'series', (select title from study_series where id = v_study.series_id),
    'credit', (select credit from study_series where id = v_study.series_id),
    'credit_url', (select credit_url from study_series where id = v_study.series_id),
    'song', private.study_song(v_study.id, v_rec.org_id),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb),
    'answers', case when v_done then to_jsonb(v_study.answers) end,
    'progress', (select jsonb_build_object('last_page', p.last_page, 'answers', p.answers,
        'completed', p.completed_at is not null)
      from study_progress p where p.study_id = v_study.id and p.recipient_id = v_rec.id)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function preview_study(p_study_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_study studies;
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  select * into v_study from studies
   where id = p_study_id and (org_id is null or org_id = app_user_org());
  if v_study.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_study.id, 'number', null, 'title', v_study.title, 'tagline', v_study.tagline,
    'locked', false, 'progress', null, 'answers', to_jsonb(v_study.answers),
    'credit', (select credit from study_series where id = v_study.series_id),
    'credit_url', (select credit_url from study_series where id = v_study.series_id),
    'song', private.study_song(v_study.id, app_user_org()),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
        'page_number', pg.page_number, 'blocks', pg.blocks) order by pg.page_number)
      from study_pages pg where pg.study_id = v_study.id), '[]'::jsonb));
end;
$$;

create or replace function ministry_study_bank()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid := app_user_org();
begin
  if not is_leadership() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'tagline', s.tagline,
      'source', case when s.org_id is null then 'ekkle' else 'ministry' end,
      'series', sr.title, 'credit', sr.credit,
      'song', private.study_song(s.id, v_org), 'default_song', s.song,
      'song_choice', case when not exists (select 1 from ministry_study_songs ms where ms.org_id = v_org and ms.study_id = s.id) then 'default'
                          when (select ms.song from ministry_study_songs ms where ms.org_id = v_org and ms.study_id = s.id) is null then 'none'
                          else 'own' end,
      'enabled', o.enabled, 'number', o.rn,
      'pages', (select count(*) from study_pages pg where pg.study_id = s.id),
      'seekers_started', (select count(*) from study_progress p join recipients r on r.id = p.recipient_id
                          where p.study_id = s.id and r.org_id = v_org),
      'seekers_completed', (select count(*) from study_progress p join recipients r on r.id = p.recipient_id
                          where p.study_id = s.id and r.org_id = v_org and p.completed_at is not null)
    ) order by o.ord)
    from private.ministry_study_order(v_org) o
    join studies s on s.id = o.study_id
    join study_series sr on sr.id = s.series_id
  ), '[]'::jsonb);
end;
$$;

create or replace function editor_study(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_study studies; v_series study_series;
begin
  select s.* into v_study from studies s
   where s.id = p_id and exists (select 1 from private.author_scope() a
                                  where a.org_id is not distinct from s.org_id);
  if v_study.id is null then raise exception 'forbidden'; end if;
  select * into v_series from study_series where id = v_study.series_id;
  return jsonb_build_object(
    'id', v_study.id, 'status', v_study.status,
    'series', jsonb_build_object('id', v_series.id, 'title', v_series.title,
                                 'locked', v_series.locked_at is not null,
                                 'credit', v_series.credit, 'credit_url', v_series.credit_url),
    'has_draft', v_study.draft is not null,
    'song', v_study.song,
    'content', coalesce(v_study.draft, private.study_content(v_study.id)),
    'people_started', (select count(*) from study_progress p where p.study_id = v_study.id));
end;
$$;
