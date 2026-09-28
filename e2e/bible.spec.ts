import { expect, test } from '@playwright/test';
import { DAVID } from './support/supabase';

/**
 * The built-in Bible (members' app): read a chapter, switch translation,
 * highlight a verse with a note (kept after a reload, listed in Notes), search.
 */
test('read, switch translation, highlight with a note, search', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(DAVID.email);
  await page.getByLabel('Password').fill(DAVID.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');

  await page.getByRole('navigation').getByRole('link', { name: 'Bible' }).click();
  await page.waitForURL(/\/app\/bible\/[1-3A-Z]{3}\/\d+/);

  // Pick Romans 8 from the book list.
  await page.getByRole('button', { name: /choose a book/ }).click();
  await page.getByRole('button', { name: 'Romans' }).click();
  await page.getByRole('button', { name: '8', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Romans 8' })).toBeVisible();
  await expect(page.getByText('no condemnation for those who are in Christ Jesus')).toBeVisible();

  // KJV.
  await page.getByRole('button', { name: 'KJV' }).click();
  await expect(page.getByText('There is therefore now no condemnation')).toBeVisible();

  // Highlight verse 28 with a note.
  const note = `Hope ${Date.now() % 100000}`;
  await page.getByRole('button', { name: 'Verse 28' }).click();
  const sheet = page.getByRole('dialog', { name: 'Romans 8:28' });
  await sheet.getByRole('button', { name: 'Highlight yellow' }).click();
  await sheet.getByLabel('Note').fill(note);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);

  // Kept: after a reload it's still marked, and it's in Notes.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Verse 28' }).getByLabel('Has a note')).toBeVisible();
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByText(note)).toBeVisible();

  // Search (KJV, the translation in use).
  await page.getByRole('button', { name: 'Search the Bible' }).click();
  await page.getByRole('textbox', { name: 'Search the Bible' }).fill('only begotten Son');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('button', { name: /John 3:16/ })).toBeVisible();
});
