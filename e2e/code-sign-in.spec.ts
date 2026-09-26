import { expect, test } from '@playwright/test';
import { DAVID, latestEmailCode, uniqueEmail } from './support/supabase';

/**
 * Signing in with the 6-digit code instead of the link — the path that works
 * inside in-app browsers (Instagram, Facebook, camera apps), where tapping the
 * link would open a different browser.
 */
test('a seeker can start their studies with the emailed code', async ({ page }) => {
  const email = uniqueEmail('seeker-code');

  await page.goto('/offer');
  await page.getByLabel('First name').fill('Jo');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a link to begin' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.getByLabel('Or enter the code from the email').fill(await latestEmailCode(email));
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL('**/studies**');
  await expect(page.getByRole('link', { name: /The Logic of Love/ }).first()).toBeVisible();
});

test('a member can sign in with the emailed code', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(DAVID.email);
  await page.getByRole('button', { name: /link/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  await page.getByLabel('Or enter the code from the email').fill(await latestEmailCode(DAVID.email));
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL('**/app**');
});
