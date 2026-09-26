import { expect, test, type Page } from '@playwright/test';
import { DAVID, uniqueEmail } from './support/supabase';

/**
 * The core loop: someone opens a member's personal link, walks the flow,
 * messages that member, and the same member replies — and the reply reaches
 * them back. Two browsers: the recipient's and David's.
 */
test('recipient messages the member who shared, and the member replies', async ({ browser }) => {
  const firstName = `Rae${Date.now() % 100000}`;
  const note = `Hello from the e2e test ${Date.now()}`;
  const reply = `Glad you reached out, ${firstName}`;

  // ---- Recipient: open David's link and walk the flow ----
  const recipient = await (await browser.newContext()).newPage();
  await recipient.goto(`/r/${DAVID.slug}`);
  await expect(recipient.getByText('A note from David')).toBeVisible();
  await recipient.getByRole('button', { name: 'Begin' }).click();

  // Continue through the screens until the connect step.
  for (let i = 0; i < 10; i++) {
    const cont = recipient.getByRole('button', { name: /^(Continue|One more thing)$/ });
    if (!(await cont.isVisible().catch(() => false))) break;
    await cont.click();
  }
  await recipient.getByRole('button', { name: /Message David/ }).click();

  await expect(recipient.getByRole('heading', { name: 'Say hello to David' })).toBeVisible();
  await recipient.getByLabel('Your first name').fill(firstName);
  await recipient.getByLabel('Email').fill(uniqueEmail('recipient'));
  await recipient.getByLabel('Your message').fill(note);
  await recipient.getByRole('button', { name: 'Send' }).click();
  await expect(recipient.getByText(note)).toBeVisible();

  // ---- David: sign in, find the conversation, reply ----
  const david = await (await browser.newContext()).newPage();
  await signInWithPassword(david, DAVID.email, DAVID.password);
  await david.goto('/app/messages');
  await david.getByRole('link', { name: new RegExp(firstName) }).click();
  await expect(david.getByText(note)).toBeVisible();
  await david.getByPlaceholder('Write a reply…').fill(reply);
  await david.getByRole('button', { name: 'Send' }).click();
  await expect(david.getByText(reply)).toBeVisible();

  // ---- Recipient: the reply comes back to the same person ----
  await recipient.goto(`/r/${DAVID.slug}`);
  await recipient.getByRole('button', { name: 'Continue your conversation with David' }).click();
  await expect(recipient.getByText(reply)).toBeVisible();
});

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}
