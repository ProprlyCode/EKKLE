import { expect, test } from '@playwright/test';
import { admin, OWEN, PLATFORM } from './support/supabase';

/**
 * A password-reset link that lands on the site's root (as one sent from the
 * Supabase dashboard does) still opens "choose a new password".
 */
test('a recovery link to the homepage goes to the reset page', async ({ page }) => {
  const { data, error } = await admin().auth.admin.generateLink({
    type: 'recovery',
    email: OWEN.email,
    options: { redirectTo: PLATFORM },
  });
  expect(error).toBeNull();
  await page.goto(data.properties!.action_link);
  await page.waitForURL('**/reset-password');
  await expect(page.getByLabel('New password')).toBeVisible();
});
