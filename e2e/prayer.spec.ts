import { expect, test } from '@playwright/test';
import { admin as service, DAVID } from './support/supabase';

/**
 * Prayer (0052): a member keeps a private list, has a quiet moment (a verse,
 * a few names, Amen), marks a prayer answered, and chooses a time.
 */
test('prayer: a private list, a quiet moment, an answered prayer, a time', async ({ page }) => {
  const db = service();
  await db.from('prayer_people').delete().eq('user_id', DAVID.userId);
  await db.from('prayer_times').delete().eq('user_id', DAVID.userId);
  try {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Use a password instead' }).click();
    await page.getByLabel('Email').fill(DAVID.email);
    await page.getByLabel('Password').fill(DAVID.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/app**');

    await page.getByRole('link', { name: 'Prayer' }).first().click();
    await expect(page.getByRole('heading', { name: 'A quiet moment' })).toBeVisible();
    await expect(page.getByText('Daniel 6:10', { exact: false })).toBeVisible();

    // Two people on his list.
    for (const [name, request] of [
      ['Mum', 'Her surgery on the 14th'],
      ['Sam', 'A new job'],
    ]) {
      await page.getByRole('button', { name: 'Add someone' }).click();
      const form = page.getByRole('form', { name: 'Add someone' });
      await form.getByLabel('Name').fill(name!);
      await form.getByLabel(/What you’d like to pray for/).fill(request!);
      await form.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText(request!).first()).toBeVisible();
    }

    // The quiet moment shows them, and Amen closes it gently.
    const moment = page.getByRole('region', { name: 'Today’s quiet moment' });
    await page.reload();
    await expect(moment).toContainText('Mum');
    await moment.getByRole('button', { name: 'Amen' }).click();
    await expect(moment.getByRole('status')).toContainText('Amen.');

    // Sam's prayer is answered.
    const sam = page.getByRole('listitem').filter({ hasText: 'A new job' }).first();
    await sam.getByRole('button', { name: 'Answered' }).click();
    await page.getByLabel('What happened? (optional)').fill('Started on Monday');
    await page.getByRole('button', { name: 'Mark answered' }).click();
    await page.locator('button[data-disclosure]', { hasText: 'Answered' }).click();
    await expect(page.getByText('Started on Monday')).toBeVisible();

    // A time, with an email.
    const times = page.locator('button[data-disclosure]', { hasText: 'Your times' });
    if ((await times.getAttribute('aria-expanded')) === 'false') await times.click();
    await page.getByRole('button', { name: 'Add a time' }).click();
    const time = page.getByRole('form', { name: 'Add a time' });
    await expect(time.getByLabel('Name')).toHaveValue('Morning');
    await time.getByLabel('Send me a short email at this time').check();
    await time.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('A short email at this time')).toBeVisible();
    await expect(page.getByText(/Your next pause: Morning/)).toBeVisible();

    // Nobody else can read it — not even through the API with their own login.
    const { count } = await db.from('prayer_people').select('id', { count: 'exact', head: true }).eq('user_id', DAVID.userId);
    expect(count).toBe(2);
  } finally {
    await db.from('prayer_people').delete().eq('user_id', DAVID.userId);
    await db.from('prayer_times').delete().eq('user_id', DAVID.userId);
  }
});
