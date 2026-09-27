import { expect, test, type Page } from '@playwright/test';
import { SARAH, latestEmailCode, uniqueEmail } from './support/supabase';

/**
 * Resources: a leader writes and publishes one; a seeker finds it in Your
 * space alongside the seeded library (drafts never show); a video resource
 * plays in the page.
 */
test('a leader publishes a resource and a seeker reads it in Your space', async ({ browser }) => {
  const title = `Prayer for beginners ${Date.now() % 100000}`;

  // ---- Leader: write and publish ----
  const leader = await (await browser.newContext()).newPage();
  await signInWithPassword(leader, SARAH.email, SARAH.password);
  await leader.goto('/leadership/resources');
  await leader.getByRole('button', { name: 'New resource' }).first().click();
  await leader.getByLabel('Title').fill(title);
  await leader.getByLabel('Short description').fill('Simple words to start with.');
  await leader.getByLabel('Text').fill('Start where you are. Say it plainly.');
  await leader.getByLabel('Topics').fill('Prayer, Getting started');
  await leader.getByRole('button', { name: 'Publish' }).click();
  await expect(leader.getByText('Published', { exact: true })).toBeVisible();

  // …and a video.
  await leader.getByRole('button', { name: '← Resources' }).click();
  await leader.getByRole('button', { name: 'New resource' }).first().click();
  await leader.getByLabel('Title').fill(`${title} (video)`);
  await leader.getByRole('button', { name: 'Video', exact: true }).click();
  await leader.getByLabel('YouTube or Vimeo link').fill('https://youtu.be/abcDEF12345');
  await leader.getByRole('button', { name: 'Publish' }).click();
  await expect(leader.getByText('Published', { exact: true })).toBeVisible();

  // ---- Seeker: sign up and browse ----
  const email = uniqueEmail('res');
  const seeker = await (await browser.newContext()).newPage();
  await seeker.goto('/offer');
  await seeker.getByLabel('First name').fill('Ria');
  await seeker.getByLabel('Email').fill(email);
  await seeker.getByRole('button', { name: 'Email me a link to begin' }).click();
  await seeker.getByLabel('Or enter the code from the email').fill(await latestEmailCode(email));
  await seeker.getByRole('button', { name: 'Continue', exact: true }).click();
  await seeker.waitForURL('**/space/studies**');

  await seeker.goto('/space/resources');
  await expect(seeker.getByRole('link', { name: new RegExp(`^Reading ${title}`) })).toBeVisible();
  await expect(seeker.getByText('Where to start reading')).toBeVisible();
  await expect(seeker.getByText('Draft: not ready yet')).toHaveCount(0);

  // Topic filter.
  await seeker.getByRole('button', { name: 'Prayer', exact: true }).click();
  await expect(seeker.getByText('Where to start reading')).toHaveCount(0);
  await seeker.getByRole('link', { name: new RegExp(`^Reading ${title}`) }).click();
  await expect(seeker.getByText('Start where you are. Say it plainly.')).toBeVisible();

  // The video plays in the page (privacy-friendly embed of that video only).
  await seeker.goto('/space/resources');
  await seeker.getByRole('link', { name: new RegExp(`${title} \\(video\\)`) }).click();
  await expect(
    seeker.locator('iframe[src="https://www.youtube-nocookie.com/embed/abcDEF12345"]'),
  ).toBeVisible();

  // The seeded link opens outside.
  await seeker.goto('/space/resources');
  await seeker.getByRole('link', { name: /BibleProject/ }).click();
  await expect(seeker.getByRole('link', { name: 'Open ↗' })).toHaveAttribute('href', 'https://bibleproject.com');
});

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}
