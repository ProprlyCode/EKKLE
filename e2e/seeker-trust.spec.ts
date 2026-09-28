import { expect, test, type Page } from '@playwright/test';
import { admin, DAVID, latestEmailCode, uniqueEmail } from './support/supabase';

/**
 * N3 (0041): a member adds a photo; someone they share with sees who they're
 * writing to (photo, name, ministry) before sending; in Your space they turn
 * the weekly study reminder on and off, then delete their details — and the
 * conversation leaves the member's inbox.
 */

// A 2×2 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNomFAARAwQCgAqTgYB2TfKTwAAAABJRU5ErkJggg==',
  'base64',
);

test('who you’re talking to, a weekly reminder, and deleting your details', async ({ browser }) => {
  const db = admin();
  const firstName = `Ivy${Date.now() % 100000}`;
  const email = uniqueEmail('trust');
  try {
    // David adds a photo on his QR page.
    const david = await (await browser.newContext()).newPage();
    await signInWithPassword(david, DAVID.email, DAVID.password);
    await david.goto('/app');
    await david.getByLabel('Photo file').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await expect(david.getByRole('button', { name: 'Change photo' })).toBeVisible();

    // Someone he shares with sees the card before writing.
    const seeker = await (await browser.newContext()).newPage();
    await seeker.goto(`/r/${DAVID.slug}`);
    await seeker.getByRole('button', { name: 'Begin' }).click();
    for (let i = 0; i < 10; i++) {
      const cont = seeker.getByRole('button', { name: /^(Continue|One more thing)$/ });
      if (!(await cont.isVisible().catch(() => false))) break;
      await cont.click();
    }
    await seeker.getByRole('button', { name: /Message David/ }).click();
    const card = seeker.getByRole('region', { name: 'Who you’re talking to' });
    await expect(card.getByRole('img', { name: /David/ })).toHaveAttribute('src', /\/photos\//);
    await expect(card).toContainText('You can delete your details at any time');

    await seeker.getByLabel('Your first name').fill(firstName);
    await seeker.getByLabel('Email').fill(email);
    await seeker.getByLabel('Your message').fill('Hello from the trust test');
    await seeker.getByRole('button', { name: 'Send' }).click();
    await seeker.getByLabel('Enter the code from the email').fill(await latestEmailCode(email));
    await seeker.getByRole('button', { name: 'Continue', exact: true }).click();
    await seeker.waitForURL('**/space/messages');

    // The weekly reminder: off until they choose.
    await seeker.goto('/space/studies');
    const reminder = seeker.getByRole('region', { name: 'Weekly reminder' });
    await expect(reminder).toContainText('Off.');
    await reminder.getByLabel('Reminder day').selectOption({ label: 'Sunday' });
    await reminder.getByLabel('Reminder time').fill('19:30');
    await reminder.getByRole('button', { name: 'Turn on' }).click();
    await expect(reminder).toContainText('An email each Sunday at 19:30');
    await reminder.getByRole('button', { name: 'Turn off' }).click();
    await expect(reminder).toContainText('Off.');

    // Delete my details.
    await seeker.goto('/space/account');
    await seeker.getByRole('button', { name: 'Delete my details' }).click();
    await seeker.getByRole('button', { name: 'Yes, delete everything' }).click();
    await expect(seeker.getByRole('heading', { name: 'Your details are deleted' })).toBeVisible();

    // The conversation has left David's inbox.
    await david.goto('/app/messages');
    await expect(david.getByRole('heading', { name: /messages|inbox/i }).first()).toBeVisible();
    await expect(david.getByText(firstName)).toHaveCount(0);
  } finally {
    await db.from('users').update({ photo: null }).eq('id', DAVID.userId);
  }
});

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}
