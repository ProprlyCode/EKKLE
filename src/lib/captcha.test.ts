import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptchaError, captchaToken } from './captcha';

type Opts = Record<string, (arg?: string) => void>;

function fakeTurnstile(onExecute: (opts: Opts) => void) {
  let opts: Opts = {};
  const t = {
    render: vi.fn((_el: HTMLElement, o: Opts) => {
      opts = o;
      return 'w1';
    }),
    execute: vi.fn(() => onExecute(opts)),
    remove: vi.fn(),
  };
  window.turnstile = t as unknown as Window['turnstile'];
  return t;
}

afterEach(() => {
  delete window.turnstile;
  document.body.innerHTML = '';
});

describe('captchaToken', () => {
  it('is off without a site key', async () => {
    expect(await captchaToken('')).toBeUndefined();
  });

  it('returns the token and cleans up', async () => {
    const t = fakeTurnstile((o) => o.callback!('tok-123'));
    expect(await captchaToken('site-key')).toBe('tok-123');
    expect(t.render.mock.calls[0]![1]).toMatchObject({ sitekey: 'site-key', execution: 'execute' });
    expect(t.remove).toHaveBeenCalledWith('w1');
    expect(document.querySelector('[aria-label="Security check"]')).toBeNull();
  });

  it('shows the card only when Cloudflare wants a tap', async () => {
    let box: Element | null = null;
    fakeTurnstile((o) => {
      box = document.querySelector('[aria-label="Security check"]');
      expect(box?.classList.contains('invisible')).toBe(true);
      o['before-interactive-callback']!();
      expect(box?.classList.contains('invisible')).toBe(false);
      o.callback!('tok');
    });
    await captchaToken('site-key');
    expect(box).not.toBeNull();
  });

  it('fails plainly on an error or a timeout', async () => {
    fakeTurnstile((o) => o['error-callback']!());
    await expect(captchaToken('site-key')).rejects.toBeInstanceOf(CaptchaError);
    fakeTurnstile(() => {});
    await expect(captchaToken('site-key', 10)).rejects.toMatchObject({ code: 'captcha_unfinished' });
    expect(document.querySelector('[aria-label="Security check"]')).toBeNull();
  });
});
