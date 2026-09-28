import { describe, expect, it } from 'vitest';
import {
  hostOf,
  renderAuthEmail,
  verifyLink,
} from '../../supabase/functions/_shared/auth-email';

// The sign-in email Supabase hands to our Send Email Hook
// (supabase/functions/send-auth-email), rendered in the account's name.
const grace = { name: 'Grace Chapel', accent: '#1e3a5f', logoUrl: 'https://x.test/logo.png' };

describe('sign-in email', () => {
  it('comes from the account, with its logo, colour, code and link', () => {
    const e = renderAuthEmail({ action: 'magiclink', token: '123456', link: 'https://api.test/verify?x=1&y=2', account: grace });
    expect(e.subject).toBe('Your Grace Chapel sign-in');
    expect(e.html).toContain('src="https://x.test/logo.png"');
    expect(e.html).toContain('background: #1e3a5f');
    expect(e.html).toContain('123456');
    expect(e.html).toContain('href="https://api.test/verify?x=1&amp;y=2"');
    expect(e.text).toContain('Sign in: https://api.test/verify?x=1&y=2');
  });

  it('is simply from Ekklē on ekkle.org, in sage', () => {
    const e = renderAuthEmail({ action: 'signup', token: '654321', link: 'https://l.test', account: null });
    expect(e.subject).toBe('Your Ekklē sign-in');
    expect(e.html).toContain('background: #3f4a3a');
  });

  it('uses the account name as text when there is no logo, escaped', () => {
    const e = renderAuthEmail({
      action: 'magiclink',
      token: '1',
      link: 'https://l.test',
      account: { name: 'St <Mark>’s', accent: null, logoUrl: null },
    });
    expect(e.html).toContain('St &lt;Mark&gt;’s');
    expect(e.html).not.toContain('<Mark>');
  });

  it('password reset: a link, no code', () => {
    const e = renderAuthEmail({ action: 'recovery', token: '999999', link: 'https://l.test', account: grace });
    expect(e.subject).toBe('Reset your Grace Chapel password');
    expect(e.html).toContain('Choose a new password');
    expect(e.html).not.toContain('999999');
  });

  it('an invitation to a ministry reads as one, with code and link', () => {
    const e = renderAuthEmail({ action: 'magiclink', token: '424242', link: 'https://l.test', account: grace, invited: true });
    expect(e.subject).toBe('You’re invited to Grace Chapel');
    expect(e.html).toContain('Accept the invitation');
    expect(e.html).toContain('424242');
  });

  it('an invitation on ekkle.org is to the Ekklē team', () => {
    const e = renderAuthEmail({ action: 'signup', token: '1', link: 'https://l.test', account: null, invited: true });
    expect(e.subject).toBe('You’re invited to the Ekklē team');
  });

  it('ignores an accent that is not a colour', () => {
    const e = renderAuthEmail({ action: 'magiclink', token: '1', link: 'https://l.test', account: { ...grace, accent: 'red;x' } });
    expect(e.html).toContain('background: #3f4a3a');
  });
});

describe('links and addresses', () => {
  it('builds Supabase’s verify link back to the page they started on', () => {
    const url = new URL(verifyLink('https://ref.supabase.co/', 'abc', 'magiclink', 'https://grace.ekkle.org/space'));
    expect(url.origin + url.pathname).toBe('https://ref.supabase.co/auth/v1/verify');
    expect(url.searchParams.get('token')).toBe('abc');
    expect(url.searchParams.get('type')).toBe('magiclink');
    expect(url.searchParams.get('redirect_to')).toBe('https://grace.ekkle.org/space');
  });

  it('reads the host a sign-in started on', () => {
    expect(hostOf('https://Grace.ekkle.org/space?x')).toBe('grace.ekkle.org');
    expect(hostOf('http://pilot.localhost:5173/app')).toBe('pilot.localhost:5173');
    expect(hostOf('')).toBeNull();
    expect(hostOf('not a url')).toBeNull();
  });
});
