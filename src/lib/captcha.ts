/**
 * Cloudflare Turnstile for sign-in requests (email link or code, password,
 * forgot password, invitations). Supabase checks the token when CAPTCHA is
 * switched on under Authentication → Attack Protection.
 *
 * Off when VITE_TURNSTILE_SITE_KEY isn’t set (local development, CI), and
 * always off on staging, whose smoke tests sign in as the demo personas:
 * captchaToken() returns undefined and requests go without one.
 *
 * Most people never see anything: the check runs in the background and only
 * shows a small "one quick check" card when Cloudflare wants a tap.
 */

type Turnstile = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY =
  import.meta.env.VITE_APP_ENV === 'staging' ? '' : (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '');

/** The check didn't finish (blocked script, timed out, or Cloudflare refused). */
export class CaptchaError extends Error {
  code = 'captcha_unfinished';
  constructor() {
    super('captcha_unfinished');
  }
}

let loading: Promise<Turnstile> | null = null;

function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new CaptchaError()));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new CaptchaError());
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** A one-use token for the next sign-in request (undefined when CAPTCHA is off). */
export async function captchaToken(siteKey = SITE_KEY, timeoutMs = 120_000): Promise<string | undefined> {
  if (!siteKey) return undefined;
  const ts = await load();

  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Security check');
  box.className =
    'invisible fixed bottom-4 left-1/2 z-[1000] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col items-center gap-2 rounded-card border border-edge bg-card px-4 py-3 shadow-lg';
  const note = document.createElement('p');
  note.className = 'text-[13px] text-muted-strong';
  note.textContent = 'One quick check that you’re a person.';
  const slot = document.createElement('div');
  box.append(note, slot);
  document.body.append(box);

  return new Promise<string>((resolve, reject) => {
    let id: string | undefined;
    let settled = false;
    const finish = (then: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (id) ts.remove(id);
      } catch {
        /* already gone */
      }
      box.remove();
      then();
    };
    const fail = () => finish(() => reject(new CaptchaError()));
    const timer = setTimeout(fail, timeoutMs);
    try {
      id = ts.render(slot, {
        sitekey: siteKey,
        action: 'sign-in',
        execution: 'execute',
        appearance: 'interaction-only',
        theme: 'light',
        retry: 'never',
        callback: (token: string) => finish(() => resolve(token)),
        'error-callback': fail,
        'expired-callback': fail,
        'timeout-callback': fail,
        'unsupported-callback': fail,
        'before-interactive-callback': () => box.classList.remove('invisible'),
      });
      ts.execute(id);
    } catch {
      fail();
    }
  });
}
