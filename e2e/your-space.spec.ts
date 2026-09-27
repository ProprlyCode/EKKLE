import { expect, test, type Page } from '@playwright/test';
import { DAVID, latestEmailCode, uniqueEmail } from './support/supabase';

/**
 * Your space: someone messages a member from their link, keeps the
 * conversation with the emailed code, and from then on it lives in their own
 * gated space — where the member's reply reaches them.
 */
test('a recipient keeps the conversation in Your space', async ({ browser }) => {
  const firstName = `Kai${Date.now() % 100000}`;
  const email = uniqueEmail('space');
  const note = `Keeping this ${Date.now()}`;
  const reply = `Welcome to your space, ${firstName}`;

  const seeker = await (await browser.newContext()).newPage();
  await seeker.goto(`/r/${DAVID.slug}`);
  await seeker.getByRole('button', { name: 'Begin' }).click();
  for (let i = 0; i < 10; i++) {
    const cont = seeker.getByRole('button', { name: /^(Continue|One more thing)$/ });
    if (!(await cont.isVisible().catch(() => false))) break;
    await cont.click();
  }
  await seeker.getByRole('button', { name: /Message David/ }).click();
  await seeker.getByLabel('Your first name').fill(firstName);
  await seeker.getByLabel('Email').fill(email);
  await seeker.getByLabel('Your message').fill(note);
  await seeker.getByRole('button', { name: 'Send' }).click();

  await expect(seeker.getByRole('heading', { name: 'Keep this conversation' })).toBeVisible();
  await seeker.getByLabel('Enter the code from the email').fill(await latestEmailCode(email));
  await seeker.getByRole('button', { name: 'Continue', exact: true }).click();

  // Their own space, with the conversation already in it.
  await seeker.waitForURL('**/space/messages');
  await expect(seeker.getByText(note)).toBeVisible();

  // David replies from his inbox…
  const david = await (await browser.newContext()).newPage();
  await signInWithPassword(david, DAVID.email, DAVID.password);
  await david.goto('/app/messages');
  await david.getByRole('link', { name: new RegExp(firstName) }).click();
  await david.getByPlaceholder('Write a reply…').fill(reply);
  await david.getByRole('button', { name: 'Send' }).click();
  await expect(david.getByText(reply)).toBeVisible();

  // …and it reaches them in Your space. Home shows it too.
  await expect(seeker.getByText(reply)).toBeVisible({ timeout: 15_000 });
  await seeker.goto('/space');
  await expect(seeker.getByText(reply)).toBeVisible();

  // Back on the member's link, they're pointed to their space.
  await seeker.goto(`/r/${DAVID.slug}`);
  await expect(seeker.getByRole('link', { name: 'Continue in your space' })).toBeVisible();
});

test('Your space is gated: signed-out visitors get the sign-in', async ({ page }) => {
  for (const path of ['/space', '/space/messages', '/space/studies', '/space/account']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'welcome back' })).toBeVisible();
  }
  // Old study links still work — they lead to Your space.
  await page.goto('/studies/connection');
  await page.waitForURL('**/space/messages');
});

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}

test('Your space can be installed: the app manifest opens it', async ({ request }) => {
  const res = await request.get('http://localhost:5173/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.start_url).toBe('/space');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    expect((await request.get(`http://localhost:5173${icon.src}`)).ok()).toBe(true);
  }
});
