import { expect, test } from '@playwright/test';
import { admin as service, SARAH } from './support/supabase';
import { expandAll } from './support/ui';

/**
 * Resources → Bible studies: the Ekklē study bank. An Admin sees the shared
 * studies, previews one exactly as seekers see it, and turns it off and on.
 */
test('the study bank in Resources: see, preview, choose', async ({ page }) => {
  // Start from the default (every bank study on), whatever an earlier run left.
  await service().from('ministry_studies').delete().neq('position', -1);

  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(SARAH.email);
  await page.getByLabel('Password').fill(SARAH.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
  await page.goto('/leadership/resources');

  await expect(page.getByRole('heading', { name: 'Bible studies' })).toBeVisible();
  await expandAll(page);
  const row = page.getByRole('listitem').filter({ hasText: 'The Logic of Love' });
  await expect(row).toContainText('Ekklē');
  await expect(page.getByText('1 of 1 offered')).toBeVisible();

  // Preview: the real reader, nothing saved.
  await row.getByRole('link', { name: 'Preview' }).click();
  await expect(page.getByText('Preview — what people see. Nothing is saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Logic of Love' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to resources' }).first().click();
  await page.waitForURL('**/leadership/resources');

  // Off, kept after a reload, then back on.
  await page.getByLabel('Offer The Logic of Love').uncheck();
  await expect(page.getByText('0 of 1 offered')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Offer The Logic of Love')).not.toBeChecked();
  await page.getByLabel('Offer The Logic of Love').check();
  await expect(page.getByText('1 of 1 offered')).toBeVisible();
});
