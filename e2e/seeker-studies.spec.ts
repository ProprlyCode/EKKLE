import { expect, test } from '@playwright/test';
import { latestEmailLink, uniqueEmail } from './support/supabase';

/**
 * A seeker asks for the studies, verifies their email with the magic link, and
 * lands in their own study dashboard with the first study open to them.
 */
test('a seeker signs up by email and opens their first study', async ({ page }) => {
  const email = uniqueEmail('seeker');

  await page.goto('/offer');
  await page.getByLabel('First name').fill('Sam');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a link to begin' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(await latestEmailLink(email));
  await page.waitForURL('**/studies**');

  const study = page.getByRole('link', { name: /The Logic of Love/ }).first();
  await expect(study).toBeVisible();
  await study.click();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
});
