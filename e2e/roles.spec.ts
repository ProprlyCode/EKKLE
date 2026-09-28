import { expect, test, type Page } from '@playwright/test';
import { admin, DAVID, latestEmailCode, OWEN, PLATFORM, SARAH, uniqueEmail } from './support/supabase';

/**
 * Platform vs ministry (docs/accounts-and-roles.md): the Ekklē team works on
 * ekkle.org/platform; a ministry's address shows only that ministry's tabs,
 * by role.
 */

async function signIn(page: Page, base: string, email: string, password: string) {
  await page.goto(`${base}sign-in`);
  // ekkle.org opens on the password form; a ministry's address on the link.
  if (base !== PLATFORM) await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('the Ekklē team signs in on ekkle.org and sees every account', async ({ page }) => {
  await signIn(page, PLATFORM, OWEN.email, OWEN.password);
  await page.waitForURL('**/platform');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await expect(page.getByText('Grace Chapel (pilot)')).toBeVisible();
  await expect(page.getByText('Owner').last()).toBeVisible();

  // Settings: their own name and password.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText(`Signed in as ${OWEN.email}`)).toBeVisible();
  await page.getByLabel('Name').fill('Owen');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
  // The current password isn't a change…
  await page.getByLabel('New password').fill(OWEN.password);
  await page.getByLabel('Confirm password').fill(OWEN.password);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('That’s your current password')).toBeVisible();
  // …a new one is (then back, for the next run).
  for (const pw of ['owen-new-password-2', OWEN.password]) {
    await page.getByLabel('New password').fill(pw);
    await page.getByLabel('Confirm password').fill(pw);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByLabel('New password')).toHaveValue(''); // cleared once saved
    await expect(page.getByText('Password saved.')).toBeVisible();
  }
});

test('a new Ekklē team member signs in by code, sets a password, and reaches the console', async ({ page }) => {
  const email = uniqueEmail('team');
  const { error } = await admin().from('platform_team').insert({ email, role: 'admin' });
  if (error) throw error;

  await page.goto(`${PLATFORM}sign-in`);
  await page.getByRole('button', { name: 'First time? Email me a code' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await page.getByLabel('Or enter the code from the email').fill(await latestEmailCode(email));
  await page.getByRole('button', { name: 'Continue' }).click();

  // Straight to the Ekklē team's password step — never "choose your ministry".
  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();
  await page.getByLabel('New password').fill('team-password-123');
  await page.getByLabel('Confirm password').fill('team-password-123');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/platform');

  // From now on, the password works.
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await signIn(page, PLATFORM, email, 'team-password-123');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
});

test('a ministry Admin is not on the Ekklē team', async ({ page }) => {
  await signIn(page, PLATFORM, SARAH.email, SARAH.password);
  await page.waitForURL('**/platform');
  await expect(page.getByRole('heading', { name: 'This is the Ekklē team’s area' })).toBeVisible();
});

test('a ministry shows its own tabs by role, never the platform', async ({ browser }) => {
  // Admin: everything for the ministry, including Account; no Platform tab.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, '/', SARAH.email, SARAH.password);
  await admin.waitForURL('**/app');
  const nav = admin.getByRole('navigation');
  for (const tab of ['Overview', 'Content', 'Resources', 'People', 'Account'])
    await expect(nav.getByRole('link', { name: tab, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Platform' })).toHaveCount(0);
  await admin.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // Member: their own code and messages only.
  const member = await (await browser.newContext()).newPage();
  await signIn(member, '/', DAVID.email, DAVID.password);
  await member.waitForURL('**/app');
  const mnav = member.getByRole('navigation');
  await expect(mnav.getByRole('link', { name: 'Messages' })).toBeVisible();
  for (const tab of ['Overview', 'People', 'Account'])
    await expect(mnav.getByRole('link', { name: tab, exact: true })).toHaveCount(0);
  await member.goto('/leadership/account');
  await member.waitForURL('**/app');
});

test('"Sign in" on ekkle.org takes the Ekklē team to the console, not to find a ministry', async ({ page }) => {
  // Signed out: Find your church or ministry, with a way in for the team.
  await page.goto(`${PLATFORM}find`);
  await expect(page.getByRole('heading', { name: 'Find your church or ministry' })).toBeVisible();
  await page.getByRole('link', { name: 'On the Ekklē team? Sign in here' }).click();
  await page.waitForURL('**/sign-in');

  // Signed in on the team: /find goes straight to the console.
  await signIn(page, PLATFORM, OWEN.email, OWEN.password);
  await page.waitForURL('**/platform');
  await page.goto(`${PLATFORM}find`);
  await page.waitForURL('**/platform');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();

  // An account page opened on ekkle.org offers the console too.
  await page.goto(`${PLATFORM}app`);
  await expect(page.getByRole('link', { name: /Go to the console/ })).toBeVisible();
});
