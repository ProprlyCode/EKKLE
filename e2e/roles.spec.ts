import { expect, test, type Page } from '@playwright/test';
import { DAVID, OWEN, PLATFORM, SARAH } from './support/supabase';

/**
 * Platform vs ministry (docs/accounts-and-roles.md): the Ekklē team works on
 * ekkle.org/platform; a ministry's address shows only that ministry's tabs,
 * by role.
 */

async function signIn(page: Page, base: string, email: string, password: string) {
  await page.goto(`${base}sign-in`);
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('the Ekklē team signs in on ekkle.org and sees every account', async ({ page }) => {
  await signIn(page, PLATFORM, OWEN.email, OWEN.password);
  await page.waitForURL('**/platform');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await expect(page.getByText('Grace Chapel (pilot)')).toBeVisible();
  await expect(page.getByText('Owner').last()).toBeVisible();
});

test('a ministry Admin is not on the Ekklē team', async ({ page }) => {
  await signIn(page, PLATFORM, SARAH.email, SARAH.password);
  await page.waitForURL('**/platform');
  await expect(page.getByRole('heading', { name: 'This is the Ekklē team’s area' })).toBeVisible();
});

test('a ministry shows its own tabs by role, never the platform', async ({ browser }) => {
  // Admin: everything for the ministry, including Account; no Platform tab.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, '/', SARAH.email, SARAH.password);
  await admin.waitForURL('**/app');
  const nav = admin.getByRole('navigation');
  for (const tab of ['Overview', 'Content', 'Resources', 'People', 'Account'])
    await expect(nav.getByRole('link', { name: tab, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Platform' })).toHaveCount(0);
  await admin.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // Member: their own code and messages only.
  const member = await (await browser.newContext()).newPage();
  await signIn(member, '/', DAVID.email, DAVID.password);
  await member.waitForURL('**/app');
  const mnav = member.getByRole('navigation');
  await expect(mnav.getByRole('link', { name: 'Messages' })).toBeVisible();
  for (const tab of ['Overview', 'People', 'Account'])
    await expect(mnav.getByRole('link', { name: tab, exact: true })).toHaveCount(0);
  await member.goto('/leadership/account');
  await member.waitForURL('**/app');
});
