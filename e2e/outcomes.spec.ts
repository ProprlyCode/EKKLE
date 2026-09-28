import { expect, test, type Page } from '@playwright/test';
import { DAVID, OWEN, PLATFORM, SARAH } from './support/supabase';

/**
 * N4 (0042): outcomes for a member (their own), for a ministry's leaders (the
 * ministry and each member) and for the Ekklē team (every ministry); and a
 * member's printable sheet of wallet cards.
 */
test('outcomes for a member, their leaders and the Ekklē team; wallet cards', async ({ browser }) => {
  // David: his own numbers, and wallet cards.
  const david = await (await browser.newContext()).newPage();
  await signIn(david, '/sign-in', DAVID.email, DAVID.password, '**/app**');
  await david.goto('/app');
  const mine = david.getByRole('figure', { name: 'Your outcomes' });
  await expect(mine).toContainText('Opened a link');
  await david.getByRole('radio', { name: 'All time' }).first().click();
  await expect(david.getByRole('radio', { name: 'All time' }).first()).toHaveAttribute('aria-checked', 'true');

  await david.getByRole('link', { name: 'Print wallet cards', exact: true }).click();
  await david.waitForURL('**/app/wallet-cards');
  const sheet = david.getByLabel('Sheet of wallet cards');
  await expect(sheet.locator('img')).toHaveCount(8);
  await expect(sheet).toContainText('/r/david');

  // Sarah: the ministry, and a row per member.
  const sarah = await (await browser.newContext()).newPage();
  await signIn(sarah, '/sign-in', SARAH.email, SARAH.password, '**/app**');
  await sarah.goto('/leadership/overview');
  await expect(sarah.getByRole('figure', { name: /^Outcomes for / })).toContainText('Connected');
  await expect(sarah.getByRole('table', { name: 'Outcomes by member' }).getByRole('rowheader', { name: /David/ })).toBeVisible();

  // Owen (Ekklē team): every ministry.
  const owen = await (await browser.newContext()).newPage();
  await signIn(owen, `${PLATFORM}sign-in`, OWEN.email, OWEN.password, '**/platform');
  await owen.getByRole('link', { name: 'Outcomes' }).click();
  await expect(owen.getByRole('figure', { name: 'Outcomes across all ministries' })).toBeVisible();
  await expect(owen.getByRole('table', { name: 'Outcomes by ministry' }).getByRole('row')).not.toHaveCount(1);
});

async function signIn(page: Page, url: string, email: string, password: string, after: string) {
  await page.goto(url);
  // A ministry's sign-in starts with the email code; ekkle.org's asks for a password.
  if (!url.startsWith(PLATFORM)) await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(after);
}
