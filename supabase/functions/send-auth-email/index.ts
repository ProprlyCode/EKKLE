// Ekklē send-auth-email — Supabase Auth's Send Email Hook (docs/tenancy.md).
//
// Supabase hands every sign-in email here instead of sending its own: the
// code, the link token, and the address the person started on. We find the
// account from that address and send through Resend as "<Account> via Ekklē",
// with its logo and colour; the link goes back to the account's own address.
// On Ekklē's own addresses (ekkle.org) it's simply from Ekklē.
//
// Secrets (set by CI): RESEND_API_KEY, NOTIFY_FROM, SEND_EMAIL_HOOK_SECRET
// ("v1,whsec_…", the same value CI gives Supabase Auth). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { fromAccount, sendEmailOrThrow } from '../_shared/email.ts';
import { hostOf, renderAuthEmail, verifyLink, type EmailAccount } from '../_shared/auth-email.ts';

const HOOK_SECRET = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace(/^v1,whsec_/, '');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

interface HookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function hookError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (!HOOK_SECRET) return hookError(500, 'Sign-in email is not configured.');
  const body = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(HOOK_SECRET).verify(body, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return hookError(401, 'Not from Supabase Auth.');
  }

  const { user, email_data: d } = payload;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // The account whose address the person started on (null on ekkle.org).
  let account: EmailAccount | null = null;
  let accountId: string | null = null;
  const host = hostOf(d.redirect_to) ?? hostOf(d.site_url);
  if (host) {
    const { data } = await supabase.rpc('resolve_account', { p_host: host });
    if (data) {
      const a = data as { id: string; name: string; accent_color: string | null; logo_path: string | null };
      accountId = a.id;
      account = {
        name: a.name,
        accent: a.accent_color,
        logoUrl: a.logo_path
          ? supabase.storage.from('branding').getPublicUrl(a.logo_path).data.publicUrl
          : null,
      };
    }
  }

  // A pending invitation (to this ministry, or on ekkle.org to the Ekklē team)?
  const { data: invited } = await supabase.rpc('auth_email_is_invitation', {
    p_email: user.email,
    p_org: accountId,
  });

  const action = d.email_action_type;
  const email = renderAuthEmail({
    invited: invited === true,
    action,
    token: d.token,
    link: verifyLink(SUPABASE_URL, d.token_hash, action, d.redirect_to || d.site_url),
    account,
  });
  try {
    await sendEmailOrThrow(user.email, email.subject, email.text, fromAccount(account?.name), email.html);
  } catch (e) {
    console.error('sign-in email failed', e);
    return hookError(500, 'We couldn’t send the email just now. Please try again.');
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});
