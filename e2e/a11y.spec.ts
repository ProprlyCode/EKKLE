import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, OWEN, PLATFORM, SARAH } from './support/supabase';

/**
 * Accessibility: an automated WCAG 2.1 A/AA scan (axe) of the main pages for
 * each kind of person — someone opening a member's link, a seeker in Your
 * space, a member, and a ministry's leaders. Any violation fails the test,
 * listed with where it is.
 */

async function scan(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const report = violations.map(
    (v) => `${name}: [${v.impact}] ${v.id} — ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`,
  );
  expect(report, report.join('\n')).toEqual([]);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}

test('someone opening a member’s link', async ({ page }) => {
  await page.goto(`/r/${DAVID.slug}`);
  await scan(page, 'link');
  await page.getByRole('button', { name: 'Begin' }).click();
  await scan(page, 'first screen');
  for (let i = 0; i < 10; i++) {
    const cont = page.getByRole('button', { name: /^(Continue|One more thing)$/ });
    if (!(await cont.isVisible().catch(() => false))) break;
    await cont.click();
  }
  await scan(page, 'connect');
  await page.getByRole('button', { name: /Message David/ }).click();
  await scan(page, 'message form');
});

test('the offer page and the ministry front door', async ({ page }) => {
  for (const path of ['/', '/offer']) {
    await page.goto(path);
    await scan(page, path);
  }
});

test('the Ekklē team’s console', async ({ page }) => {
  await page.goto(`${PLATFORM}sign-in`);
  await page.getByLabel('Email').fill(OWEN.email);
  await page.getByLabel('Password').fill(OWEN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/platform');
  for (const path of ['platform', 'platform/outcomes', 'platform/team', 'platform/studies', 'platform/templates', 'platform/waitlist']) {
    await page.goto(`${PLATFORM}${path}`);
    await scan(page, path);
  }
});

test('a seeker in Your space', async ({ page }) => {
  const db = service();
  const n = Date.now() % 1_000_000;
  const email = `a11y${n}@e2e.test`;
  const password = 'e2e-a11y-password-1';
  const { data: david } = await db.from('users').select('org_id').eq('id', DAVID.userId).single();
  const { data: created } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  const uid = created.user!.id;
  await db.from('recipients').insert({
    org_id: david!.org_id, first_name: 'Ari', email, session_token: `a11y-${n}`, auth_uid: uid,
    arrival_member_id: DAVID.userId, consented_at: new Date().toISOString(),
  });
  try {
    await page.goto('/space');
    await scan(page, 'seeker sign-in');
    await page.getByRole('button', { name: 'I have a password' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /Sign in/ }).click();
    await page.waitForURL('**/space');
    for (const path of ['/space', '/space/messages', '/space/studies', '/space/bible', '/space/resources', '/space/account']) {
      await page.goto(path);
      await scan(page, path);
    }
  } finally {
    await db.from('recipients').delete().eq('auth_uid', uid);
    await db.auth.admin.deleteUser(uid);
  }
});

test('a member', async ({ page }) => {
  await signIn(page, DAVID.email, DAVID.password);
  for (const path of ['/app', '/app/messages', '/app/bible', '/app/prayer', '/app/wallet-cards']) {
    await page.goto(path);
    await scan(page, path);
  }
});

test('a ministry’s leaders', async ({ page }) => {
  await signIn(page, SARAH.email, SARAH.password);
  for (const path of ['/leadership/overview', '/leadership/content', '/leadership/public-codes', '/leadership/resources', '/leadership/people', '/leadership/account']) {
    await page.goto(path);
    await scan(page, path);
  }
});
