// Ekklē bible-esv — the ESV for the built-in Bible, through Crossway's ESV API.
//
// Only for signed-in people (Supabase verifies their token before this runs).
// The API key stays here (secret ESV_API_KEY, set by CI) and never reaches the
// browser. Following the ESV API terms: nothing is stored — each chapter or
// search is fetched when asked; one chapter at a time (well under 500 verses);
// the app shows the ESV copyright notice with the text.
//
// POST { action: 'check' }                        → { available }
// POST { action: 'chapter', book, chapter }        → { verses: string[] }
// POST { action: 'search', q, page? }              → { results: [{ reference, text }], total, pages }

const KEY = Deno.env.get('ESV_API_KEY') ?? '';
const API = 'https://api.esv.org/v3/passage';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// A gentle per-person limit (the ESV API allows 60 requests a minute in all).
const recent = new Map<string, number[]>();
function allowed(who: string): boolean {
  const now = Date.now();
  const hits = (recent.get(who) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 20) return false;
  hits.push(now);
  recent.set(who, hits);
  return true;
}

function whoIsAsking(req: Request): string {
  // The platform has already verified this token; we only need a stable id.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub ?? 'anon';
  } catch {
    return 'anon';
  }
}

// How the ESV API names the few books that differ from Ekklē's names.
const ESV_NAME: Record<string, string> = { 'Song of Songs': 'Song of Solomon', Psalms: 'Psalm' };

async function esv(path: string, params: Record<string, string>) {
  const res = await fetch(`${API}/${path}/?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Token ${KEY}` },
  });
  if (!res.ok) throw new Error(`esv ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body: { action?: string; book?: string; chapter?: number; q?: string; page?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (body.action === 'check') return json({ available: KEY !== '' });
  if (!KEY) return json({ error: 'esv_unavailable' }, 503);
  if (!allowed(whoIsAsking(req))) return json({ error: 'slow_down' }, 429);

  try {
    if (body.action === 'chapter') {
      const book = String(body.book ?? '').slice(0, 40);
      const chapter = Math.max(1, Math.min(150, Number(body.chapter) || 1));
      const data = await esv('text', {
        q: `${ESV_NAME[book] ?? book} ${chapter}`,
        'include-passage-references': 'false',
        'include-verse-numbers': 'true',
        'include-first-verse-numbers': 'true',
        'include-footnotes': 'false',
        'include-footnote-body': 'false',
        'include-headings': 'false',
        'include-short-copyright': 'false',
        'include-copyright': 'false',
        'include-selahs': 'true',
        'indent-poetry': 'false',
        'indent-paragraphs': '0',
      });
      const text: string = (data.passages ?? [])[0] ?? '';
      // "[1] In the beginning … [2] He was …" → one string per verse.
      const verses: string[] = [];
      for (const m of text.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\s*\[\d+\]|$)/g)) {
        verses[Number(m[1]) - 1] = m[2].replace(/\s+/g, ' ').trim();
      }
      return json({ verses: Array.from(verses, (v) => v ?? '') });
    }

    if (body.action === 'search') {
      const q = String(body.q ?? '').trim().slice(0, 200);
      if (!q) return json({ results: [], total: 0, pages: 0 });
      const data = await esv('search', { q, 'page-size': '20', page: String(Math.max(1, Number(body.page) || 1)) });
      return json({
        results: (data.results ?? []).map((r: { reference: string; content: string }) => ({
          reference: r.reference,
          text: r.content,
        })),
        total: data.total_results ?? 0,
        pages: data.total_pages ?? 0,
      });
    }
  } catch (e) {
    console.error('esv failed', e);
    return json({ error: 'esv_failed' }, 502);
  }
  return json({ error: 'bad_request' }, 400);
});
