import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, SARAH } from './support/supabase';

/**
 * Get started (0044): a member's checklist ticks off as they go (printing
 * wallet cards here) and can be hidden; an Admin sees theirs on Overview.
 */
test('get started checklists for a member and an Admin', async ({ browser }) => {
  const db = service();
  const { data: david } = await db.from('users').select('auth_uid').eq('id', DAVID.userId).single();
  // Start fresh (an earlier test may have opened the wallet cards).
  await db.from('getting_started').delete().eq('auth_uid', david!.auth_uid);
  try {
    const page = await (await browser.newContext()).newPage();
    await signIn(page, DAVID.email, DAVID.password);
    await page.goto('/app');
    const card = page.getByRole('region', { name: 'Get started' });
    await expect(card).toContainText('Add your photo(to do)');
    await card.getByRole('link', { name: /Print wallet cards/ }).click();
    await page.waitForURL('**/app/wallet-cards');
    await page.getByRole('link', { name: '← Back' }).click();
    await expect(card).toContainText('Print wallet cards to carry(done)');
    await card.getByRole('button', { name: 'Hide this' }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Your code to share' })).toBeVisible();
    await expect(card).toHaveCount(0);

    const sarah = await (await browser.newContext()).newPage();
    await signIn(sarah, SARAH.email, SARAH.password);
    await sarah.goto('/leadership/overview');
    await expect(sarah.getByRole('region', { name: 'Set up your ministry' })).toContainText('Add your logo and colour');
  } finally {
    await db.from('getting_started').delete().eq('auth_uid', david!.auth_uid);
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}
