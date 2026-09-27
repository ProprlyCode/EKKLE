// Sign-in emails in the account's name (docs/tenancy.md). Pure: no Deno or
// network, so the app's unit tests (src/test/authEmail.test.ts) cover it too.

export interface EmailAccount {
  name: string;
  /** '#rrggbb', already checked for contrast by the database. */
  accent: string | null;
  logoUrl: string | null;
}

export interface AuthEmailInput {
  /** Supabase's email_action_type: magiclink, signup, recovery, invite, email_change, reauthentication… */
  action: string;
  /** The 6-digit code. */
  token: string;
  /** The one-tap link (Supabase's verify URL, back to the page they came from). */
  link: string;
  /** The account the person signed in on, or null for Ekklē itself. */
  account: EmailAccount | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SAGE = '#3f4a3a';

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface Copy {
  subject: (who: string) => string;
  lead: string;
  button: string | null;
  showCode: boolean;
}

const COPY: Record<string, Copy> = {
  magiclink: {
    subject: (who) => `Your ${who} sign-in`,
    lead: 'Tap the button to sign in, or enter this code where you started:',
    button: 'Sign in',
    showCode: true,
  },
  recovery: {
    subject: (who) => `Reset your ${who} password`,
    lead: 'Tap the button to choose a new password.',
    button: 'Choose a new password',
    showCode: false,
  },
  invite: {
    subject: (who) => `You’re invited to ${who}`,
    lead: 'You’ve been invited to join. Tap the button to accept and sign in.',
    button: 'Accept the invitation',
    showCode: false,
  },
  email_change: {
    subject: (who) => `Confirm your new email for ${who}`,
    lead: 'Tap the button to confirm this is your new email address.',
    button: 'Confirm my email',
    showCode: false,
  },
  reauthentication: {
    subject: (who) => `Your ${who} confirmation code`,
    lead: 'Enter this code to confirm it’s you:',
    button: null,
    showCode: true,
  },
};
// A first sign-in (a new account) reads exactly like any other sign-in.
COPY.signup = COPY.magiclink;

function expiry(copy: Copy): string {
  if (copy.showCode && copy.button) return 'The code and link work once and expire soon.';
  if (copy.showCode) return 'The code works once and expires soon.';
  return 'The link works once and expires soon.';
}

export function renderAuthEmail({ action, token, link, account }: AuthEmailInput): RenderedEmail {
  const copy = COPY[action] ?? COPY.magiclink;
  const who = account?.name ?? 'Ekklē';
  const accent = account?.accent && /^#[0-9a-f]{6}$/i.test(account.accent) ? account.accent : SAGE;
  const subject = copy.subject(who);

  const heading = account?.logoUrl
    ? `<img src="${escape(account.logoUrl)}" alt="${escape(who)}" style="height: 40px; width: auto; max-width: 200px; margin: 0 0 20px; display: block;">`
    : `<p style="font-size: 20px; margin: 0 0 16px;">${escape(who)}</p>`;
  const code = copy.showCode && token
    ? `<p style="font-family: 'Courier New', monospace; font-size: 30px; letter-spacing: 6px; margin: 0 0 24px; color: ${SAGE};">${escape(token)}</p>`
    : '';
  const button = copy.button && link
    ? `<p style="margin: 0 0 28px;"><a href="${escape(link)}" style="display: inline-block; background: ${accent}; color: #fdfcf8; font-family: Arial, sans-serif; font-size: 14px; text-decoration: none; padding: 12px 22px; border-radius: 8px;">${escape(copy.button)}</a></p>`
    : '';
  const footer = account
    ? `${escape(who)} uses Ekkl&#275; for conversations and studies.`
    : '';

  const html = `<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 440px; margin: 0 auto; padding: 32px 24px; color: ${SAGE};">
  ${heading}
  <p style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #6b6754; margin: 0 0 24px;">${escape(copy.lead)}</p>
  ${code}
  ${button}
  <p style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #8a8676; margin: 0;">
    ${expiry(copy)} If you didn&#8217;t ask for this, you can ignore it.${footer ? `<br>${footer}` : ''}
  </p>
</div>`;

  const text = [
    who,
    '',
    copy.lead,
    copy.showCode && token ? `\n${token}\n` : '',
    copy.button && link ? `${copy.button}: ${link}` : '',
    '',
    'If you didn’t ask for this, you can ignore it.',
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');

  return { subject, html, text };
}

/**
 * Supabase's one-tap link: its verify endpoint, which signs the person in and
 * sends them back to the page they started on (on the account's address).
 */
export function verifyLink(supabaseUrl: string, tokenHash: string, action: string, redirectTo: string): string {
  const type = action === 'signup' ? 'signup' : action;
  const params = new URLSearchParams({ token: tokenHash, type });
  if (redirectTo) params.set('redirect_to', redirectTo);
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify?${params}`;
}

/** The host a sign-in started on, from Supabase's redirect_to (or site_url). */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}
