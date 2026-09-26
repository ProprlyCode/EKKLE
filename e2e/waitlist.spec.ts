import { expect, test } from '@playwright/test';
import { admin, uniqueEmail } from './support/supabase';

// The homepage's one ask. Reduced motion renders the still version of the
// story, so the form is reachable without scrolling through the animation.
test.use({ reducedMotion: 'reduce' });

test('a ministry leader can join the waitlist from the homepage', async ({ page }) => {
  const email = uniqueEmail('waitlist');

  await page.goto('/');
  await page.getByLabel('Your name').fill('Test Leader');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Church or ministry').fill('Test Fellowship');
  await page.getByRole('button', { name: 'Join the waitlist' }).click();

  await expect(page.getByText('you’re on the list')).toBeVisible();

  const { data } = await admin().from('waitlist').select('name, ministry_name').eq('email', email);
  expect(data).toEqual([{ name: 'Test Leader', ministry_name: 'Test Fellowship' }]);
});
