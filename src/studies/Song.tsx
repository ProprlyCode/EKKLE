import { useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import type { StudySong } from '@/data/studies';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';

/**
 * A song for a study's Experience section — audio only (0040): a SoundCloud
 * link (its slim player; full songs, licensing handled by SoundCloud) or an
 * uploaded audio file the uploader has the rights to.
 */

const BUCKET = 'songs';
const SOUNDCLOUD = /^https:\/\/(www\.|m\.)?soundcloud\.com\/[^\s"<>]+$/;

export function songFileUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export const songLabel = (s: StudySong) => `${s.title}${s.artist ? ` — ${s.artist}` : ''}`;

/**
 * `folder`: where uploads go — 'ekkle' for the Ekklē team, else the
 * ministry's id. `onSave` gets the song.
 */
export function SongForm({
  initial,
  folder,
  saveLabel = 'Save song',
  busy,
  onSave,
  onCancel,
}: {
  initial: StudySong | null;
  folder: string;
  saveLabel?: string;
  busy?: boolean;
  onSave: (song: StudySong) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<'soundcloud' | 'file'>(initial?.kind ?? 'soundcloud');
  const [url, setUrl] = useState(initial?.kind === 'soundcloud' ? initial.url : '');
  const [path, setPath] = useState(initial?.kind === 'file' ? initial.path : '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const cleanUrl = url.trim().split('?')[0];
  const urlError = kind === 'soundcloud' && url.trim() && !SOUNDCLOUD.test(cleanUrl)
    ? 'Paste the song’s soundcloud.com link (from the Share button → Copy link).'
    : undefined;
  const ready = !!title.trim() && (kind === 'soundcloud' ? SOUNDCLOUD.test(cleanUrl) : !!path);

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return setError('That file is over 20 MB.');
    setUploading(true);
    setError(null);
    const ext = (f.name.split('.').pop() ?? 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const name = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await supabase.storage.from(BUCKET).upload(name, f, { contentType: f.type || 'audio/mpeg' });
    setUploading(false);
    if (e) return setError('That file couldn’t be uploaded. Use an MP3, M4A, AAC, OGG or WAV file.');
    setPath(name);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const common = { title: title.trim(), artist: artist.trim() || null };
    onSave(kind === 'soundcloud' ? { kind, url: cleanUrl, ...common } : { kind, path, ...common });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div role="group" aria-label="Where the song comes from" className="flex gap-4 text-[13px] text-muted-strong">
        {(['soundcloud', 'file'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} className="accent-sage" />
            {k === 'soundcloud' ? 'From SoundCloud' : 'Upload a file'}
          </label>
        ))}
      </div>
      {kind === 'soundcloud' ? (
        <TextInput
          label="SoundCloud link"
          placeholder="https://soundcloud.com/artist/song"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={urlError}
        />
      ) : (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <input
            ref={file}
            type="file"
            accept="audio/*"
            className="sr-only"
            aria-label="Audio file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div className="flex items-center gap-3">
            <Button type="button" variant="quiet" size="sm" onClick={() => file.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : path ? 'Choose another file' : 'Choose an audio file'}
            </Button>
            {path && <span className="text-muted">Uploaded.</span>}
          </div>
          <span className="text-[12px] text-muted">
            MP3, M4A, AAC, OGG or WAV, up to 20 MB. Only upload recordings you have the rights to share.
          </span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Song title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextInput label="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || uploading || !ready}>
          {saveLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * In the reader, at the Experience section: a quiet offer to listen. Nothing
 * plays until they tap.
 */
export function SongOffer({ song, onPlay }: { song: StudySong; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className="mb-6 flex w-full items-center gap-3 rounded-lg border border-edge bg-card px-4 py-3 text-left transition-colors hover:border-sage/40"
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-canvas">
        ▶
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">Listen while you reflect</span>
        <span className="block truncate text-[15px] text-sage">{songLabel(song)}</span>
      </span>
    </button>
  );
}

/**
 * The player, audio only. It lives outside the pages, so turning a page
 * doesn't stop the song.
 */
export function SongPlayer({ song, onClose }: { song: StudySong; onClose: () => void }) {
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-edge bg-card" role="region" aria-label="Song">
      <div className="flex items-center gap-3 px-3 py-2 text-[13px]">
        <span className="min-w-0 flex-1 truncate text-sage">{songLabel(song)}</span>
        <button onClick={onClose} className="text-muted hover:text-sage" aria-label="Stop the song">
          Stop
        </button>
      </div>
      {song.kind === 'soundcloud' ? (
        <iframe
          title={songLabel(song)}
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(song.url)}&auto_play=true&visual=false&show_comments=false&show_reposts=false&show_teaser=false&hide_related=true`}
          allow="autoplay"
          className="h-[120px] w-full border-0"
        />
      ) : (
        <audio controls autoPlay src={songFileUrl(song.path)} className="w-full px-2 pb-2">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}
