import { expect, test } from '@playwright/test';
import { DAVID, PLATFORM } from './support/supabase';

/**
 * Accounts on their own addresses (docs/tenancy.md). ekkle.org is Ekklē
 * itself; old account links there go on to the right account.
 */
const ACCOUNT = 'http://pilot.localhost:5173';

test('an old ekkle.org member link goes on to that member\'s account', async ({ page }) => {
  await page.goto(`${PLATFORM}r/${DAVID.slug}`);
  await page.waitForURL(`${ACCOUNT}/r/${DAVID.slug}`);
  await expect(page.getByText('A note from David')).toBeVisible();
});

test('account pages on ekkle.org lead to "Find your church"', async ({ page }) => {
  await page.goto(`${PLATFORM}space`);
  await expect(page.getByRole('heading', { name: 'Find your church or ministry' })).toBeVisible();
  await page.getByLabel('Church or ministry name').fill('Grace');
  const link = page.getByRole('link', { name: /Grace Chapel/ });
  await expect(link).toHaveAttribute('href', `${ACCOUNT}/space`);
});

test('an account\'s address has no homepage — it opens on the offer', async ({ page }) => {
  await page.goto(`${ACCOUNT}/`);
  await page.waitForURL(`${ACCOUNT}/offer`);
  await expect(page.getByLabel('First name')).toBeVisible();
});

test('an address no account uses says so', async ({ page }) => {
  await page.goto('http://nobody-here.localhost:5173/space');
  await expect(page.getByRole('heading', { name: 'This address isn’t set up' })).toBeVisible();
});
