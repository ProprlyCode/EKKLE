import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, SARAH } from './support/supabase';

/**
 * Daily devotionals (0046): a ministry's Leader writes today's — passage,
 * thought, question, prayer — and publishes it; a member sees it at the top
 * of the Bible tab with the verses, finds it in Past devotionals and turns
 * the daily email on and off.
 */
test('a Leader publishes today’s devotional; a member reads it in the Bible', async ({ browser }) => {
  const title = `Abide ${Date.now() % 100000}`;
  try {
    const sarah = await (await browser.newContext()).newPage();
    await signIn(sarah, SARAH.email, SARAH.password);
    await sarah.goto('/leadership/resources');
    await sarah.getByRole('link', { name: /Devotionals/ }).click();
    await sarah.getByRole('button', { name: 'New devotional' }).click();
    await sarah.getByLabel('Title').fill(title);
    await sarah.getByLabel('Passage').fill('John 25');
    await expect(sarah.getByText('John has 21 chapters.')).toBeVisible();
    await expect(sarah.getByRole('button', { name: 'Publish' })).toBeDisabled();
    await sarah.getByLabel('Passage').fill('John 15:1-5');
    await sarah.getByLabel('Thought').fill('Stay close to him. Everything grows from there.');
    await sarah.getByLabel('A question to sit with').fill('Where do you rest today?');
    await sarah.getByLabel('A short prayer').fill('Lord, keep us near.');
    await expect(sarah.getByText('I am the true vine').first()).toBeVisible(); // the preview shows the verses
    await sarah.getByRole('button', { name: 'Publish' }).click();
    await expect(sarah.getByRole('status')).toContainText(`“${title}” is published`);

    const david = await (await browser.newContext()).newPage();
    await signIn(david, DAVID.email, DAVID.password);
    await david.goto('/app/bible');
    const today = david.getByRole('region', { name: 'Today’s devotional' });
    await expect(today).toContainText(title);
    await expect(today).toContainText('I am the true vine');
    await expect(today).toContainText('Where do you rest today?');
    await today.getByRole('link', { name: 'Past devotionals →' }).click();
    await david.waitForURL('**/app/bible/devotionals');
    await expect(david.getByText(title)).toBeVisible();
    const email = david.getByRole('region', { name: 'Daily devotional email' });
    await email.getByRole('button', { name: 'Turn on' }).click();
    await expect(email).toContainText('Each day’s devotional arrives at 07:00');
    await email.getByRole('button', { name: 'Turn off' }).click();
    await expect(email).toContainText('Off.');
  } finally {
    await service().from('devotionals').delete().eq('title', title);
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}
