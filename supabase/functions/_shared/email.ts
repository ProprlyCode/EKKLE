// Shared by the notification functions: sending through Resend, and checking
// that a call really came from our database trigger (shared secret set by CI).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_FROM = Deno.env.get('NOTIFY_FROM') ?? 'Ekklē <hello@ekkle.org>';
const NOTIFY_SECRET = Deno.env.get('NOTIFY_SECRET') ?? '';

export const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');

/**
 * The account an email is about: its own address (its connected domain, else
 * <subdomain>.<the site's domain>) and its name. Links in emails always point
 * back to the church or ministry the person belongs to, and the email comes
 * from it: "<Account> via Ekklē" (docs/tenancy.md).
 */
// deno-lint-ignore no-explicit-any
export async function accountInfo(supabase: any, orgId: string): Promise<{ base: string; name: string | null }> {
  const { data } = await supabase
    .from('organizations')
    .select('name, subdomain, custom_domain')
    .eq('id', orgId)
    .single();
  const name: string | null = data?.name ?? null;
  if (!SITE_URL) return { base: '', name };
  if (!data) return { base: SITE_URL, name };
  if (data.custom_domain) return { base: `https://${data.custom_domain}`, name };
  const root = new URL(SITE_URL);
  return { base: `${root.protocol}//${data.subdomain}.${root.host}`, name };
}

/** "Grace Chapel via Ekklē <hello@ekkle.org>" — the address stays Ekklē's. */
export function fromAccount(name: string | null | undefined): string {
  const clean = (name ?? '').replace(/["<>\r\n]/g, '').trim();
  if (!clean) return NOTIFY_FROM;
  const address = NOTIFY_FROM.match(/<([^>]+)>/)?.[1] ?? NOTIFY_FROM;
  return `"${clean} via Ekklē" <${address}>`;
}

/** Only the database trigger knows the secret; everyone else gets a 401. */
export function fromOurTrigger(req: Request): boolean {
  return NOTIFY_SECRET !== '' && req.headers.get('x-ekkle-secret') === NOTIFY_SECRET;
}

/** Best-effort email. No-ops without a Resend key or an address. */
export async function sendEmail(
  to: string | null | undefined,
  subject: string,
  text: string,
  from: string = NOTIFY_FROM,
) {
  if (!RESEND_API_KEY || !to) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  }).catch((e) => {
    console.error('resend error', e);
    return null;
  });
  if (res && !res.ok) console.error('resend rejected', res.status, await res.text());
}
