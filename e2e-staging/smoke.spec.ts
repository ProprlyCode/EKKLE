import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.DEMO_PASSWORD ?? '';

async function signInWithPassword(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}

test('staging is clearly marked and serves the public pages', async ({ page }) => {
  await page.goto('/offer');
  await expect(page.getByText('Staging · demo data only')).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();
  await page.goto('/sign-in');
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('recipient → David → reply, on the real staging stack', async ({ browser }) => {
  const stamp = Date.now();
  const firstName = `Smoke${stamp % 100000}`;
  const note = `Staging smoke ${stamp}`;
  const reply = `Reply to ${firstName}`;

  const recipient = await (await browser.newContext()).newPage();
  await recipient.goto('/r/david');
  await recipient.getByRole('button', { name: 'Begin' }).click();
  for (let i = 0; i < 10; i++) {
    const cont = recipient.getByRole('button', { name: /^(Continue|One more thing)$/ });
    if (!(await cont.isVisible().catch(() => false))) break;
    await cont.click();
  }
  await recipient.getByRole('button', { name: /Message David/ }).click();
  await recipient.getByLabel('Your first name').fill(firstName);
  await recipient.getByLabel('Email').fill(`smoke-${stamp}@demo.ekkle.org`);
  await recipient.getByLabel('Your message').fill(note);
  await recipient.getByRole('button', { name: 'Send' }).click();
  await expect(recipient.getByText(note)).toBeVisible();

  const david = await (await browser.newContext()).newPage();
  await signInWithPassword(david, 'member@demo.ekkle.org');
  await david.goto('/app/messages');
  await david.getByRole('link', { name: new RegExp(firstName) }).click();
  await david.getByPlaceholder('Write a reply…').fill(reply);
  await david.getByRole('button', { name: 'Send' }).click();
  await expect(david.getByText(reply)).toBeVisible();

  await recipient.goto('/r/david');
  await recipient.getByRole('button', { name: 'Continue your conversation with David' }).click();
  await expect(recipient.getByText(reply)).toBeVisible();
});

for (const who of ['leader', 'admin']) {
  test(`${who} persona can sign in`, async ({ page }) => {
    await signInWithPassword(page, `${who}@demo.ekkle.org`);
  });
}

test('seeker persona reaches their studies', async ({ page }) => {
  await page.goto('/studies');
  await page.getByRole('button', { name: 'I have a password' }).click();
  await page.getByLabel('Email').fill('seeker@demo.ekkle.org');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('link', { name: /The Logic of Love/ }).first()).toBeVisible();
});
