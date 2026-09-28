import { expect, test, type Page } from '@playwright/test';
import { admin, SARAH } from './support/supabase';

/**
 * Branding (docs/tenancy.md, phase 2): a leader names the account, uploads a
 * logo and picks a readable accent; everyone on the account's address sees it,
 * down to the home-screen app's name and icon.
 */
const PILOT = '00000000-0000-0000-0000-0000000000a1';

test.afterEach(async () => {
  const { error } = await admin()
    .from('organizations')
    .update({ name: 'Grace Chapel (pilot)', accent_color: null, logo_path: null })
    .eq('id', PILOT);
  if (error) throw new Error(`Couldn't restore the demo account: ${error.message}`);
});

test('a leader brands the account and visitors see it', async ({ browser }) => {
  const leader = await (await browser.newContext()).newPage();
  await signInWithPassword(leader, SARAH.email, SARAH.password);
  await leader.goto('/leadership/account');

  await leader.getByLabel('Name').fill('Grace Fellowship');
  // Too light to read → can't be saved.
  await leader.getByLabel('Hex').fill('#ffcc00');
  await expect(leader.getByText(/Too light to read/)).toBeVisible();
  await expect(leader.getByRole('button', { name: 'Save' })).toBeDisabled();

  await leader.getByRole('button', { name: 'Navy' }).click();
  await expect(leader.getByText(/Reads clearly/)).toBeVisible();
  await leader.getByLabel('Logo file').setInputFiles('public/icon-512.png');
  await leader.getByRole('button', { name: 'Save' }).click();
  await expect(leader.getByRole('button', { name: 'Saved' })).toBeVisible();
  // The app's own header wears it at once.
  await expect(leader.getByRole('banner').getByRole('img', { name: 'Grace Fellowship' })).toBeVisible();

  // ---- A visitor at the account's address ----
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto('/');
  await expect(visitor.getByRole('heading', { name: 'Grace Fellowship' })).toBeVisible();
  const logo = visitor.getByRole('img', { name: 'Grace Fellowship' });
  await expect(logo).toBeVisible();
  expect(await logo.getAttribute('src')).toContain('/branding/');
  await expect(visitor.getByRole('link', { name: 'Start free Bible studies' })).toHaveCSS(
    'background-color',
    'rgb(30, 58, 95)',
  );
  await expect(visitor).toHaveTitle('Grace Fellowship');

  // The home-screen app: the account's name, and icons made from its logo.
  const manifest = await visitor.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
    return (await fetch(href)).json();
  });
  expect(manifest.name).toBe('Grace Fellowship');
  expect(manifest.start_url).toMatch(/\/space$/);
  for (const icon of manifest.icons) {
    expect(icon.src).toContain('/branding/');
    expect((await visitor.request.get(icon.src)).ok()).toBe(true);
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
