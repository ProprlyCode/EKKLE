import { createClient } from '@supabase/supabase-js';

/**
 * Test-side access to the local Supabase stack. The service-role client is for
 * arranging fixtures and checking outcomes only — the browser under test always
 * uses the real anon key and goes through RLS like any visitor.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see the e2e job in ci.yml)`);
  return v;
}

export function admin() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Seeded pilot member (supabase/seed.sql) whose link is /r/david. */
export const DAVID = {
  userId: '00000000-0000-0000-0000-0000000000b2',
  slug: 'david',
  email: 'david@e2e.test',
  password: 'e2e-david-password-1',
};

/** A unique address per run so repeated runs never collide. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

const MAILPIT = process.env.MAILPIT_URL || 'http://127.0.0.1:54324';

/**
 * The newest link in the newest email sent to `to`, read from the local mail
 * catcher (Mailpit) that the Supabase CLI runs for auth emails.
 */
export async function latestEmailLink(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages?: { ID: string }[] };
      if (messages && messages.length) {
        const msg = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`).then((r) => r.json());
        const body: string = msg.HTML || msg.Text || '';
        const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/);
        if (link) return link[0].replace(/&amp;/g, '&');
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${to} within ${timeoutMs}ms`);
}
