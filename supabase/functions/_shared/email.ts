// Shared by the notification functions: sending through Resend, and checking
// that a call really came from our database trigger (shared secret set by CI).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_FROM = Deno.env.get('NOTIFY_FROM') ?? 'Ekklē <hello@ekkle.org>';
const NOTIFY_SECRET = Deno.env.get('NOTIFY_SECRET') ?? '';

export const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');

/** Only the database trigger knows the secret; everyone else gets a 401. */
export function fromOurTrigger(req: Request): boolean {
  return NOTIFY_SECRET !== '' && req.headers.get('x-ekkle-secret') === NOTIFY_SECRET;
}

/** Best-effort email. No-ops without a Resend key or an address. */
export async function sendEmail(to: string | null | undefined, subject: string, text: string) {
  if (!RESEND_API_KEY || !to) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: NOTIFY_FROM, to, subject, text }),
  }).catch((e) => {
    console.error('resend error', e);
    return null;
  });
  if (res && !res.ok) console.error('resend rejected', res.status, await res.text());
}
