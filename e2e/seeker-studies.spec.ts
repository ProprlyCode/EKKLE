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
  await page.waitForURL('**/space/studies**');

  const study = page.getByRole('link', { name: /The Logic of Love/ }).first();
  await expect(study).toBeVisible();
  await study.click();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

  // A reference in the study opens the passage right there.
  await page.getByRole('button', { name: 'Genesis 1:27' }).first().click();
  const passage = page.getByRole('dialog', { name: 'Genesis 1:27' });
  await expect(passage).toContainText('So God created man in His own image');
  await passage.getByRole('button', { name: 'Close' }).click();

  // …and the Bible is a tab of its own.
  await page.goto('/space/bible/JHN/3');
  await expect(page.getByRole('heading', { name: 'John 3' })).toBeVisible();
  await expect(page.getByText('For God so loved the world')).toBeVisible();
});
