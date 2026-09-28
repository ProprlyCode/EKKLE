import { expect, test, type Page } from '@playwright/test';
import { latestEmailLink, OWEN, PLATFORM, uniqueEmail } from './support/supabase';

/**
 * The platform console (docs/accounts-and-roles.md, slice 2): the Ekklē team
 * creates a ministry account and invites its first Admin, who signs in on the
 * ministry's own address and lands in its app as Admin; the account can be
 * paused; the Owner invites a teammate; the waitlist is visible.
 */

async function ownerSignIn(page: Page) {
  await page.goto(`${PLATFORM}sign-in`);
  await page.getByLabel('Email').fill(OWEN.email);
  await page.getByLabel('Password').fill(OWEN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/platform');
}

test('create a ministry, its Admin joins, then pause it', async ({ browser }) => {
  const stamp = Date.now() % 1_000_000;
  const sub = `hope-${stamp}`;
  const adminEmail = uniqueEmail('hope-admin');

  const owner = await (await browser.newContext()).newPage();
  await ownerSignIn(owner);
  await owner.getByRole('button', { name: 'New account' }).click();
  await owner.getByLabel('Name', { exact: true }).fill(`Hope ${stamp}`);
  await expect(owner.getByLabel('Address')).toHaveValue(sub); // suggested from the name
  await expect(owner.getByText(`${sub}.localhost:5173 is available.`)).toBeVisible();
  await owner.getByRole('button', { name: 'Personal ministry' }).click();
  await owner.getByLabel('First admin’s name').fill('Hana');
  await owner.getByLabel('First admin’s email').fill(adminEmail);
  await owner.getByRole('button', { name: 'Create and invite' }).click();
  await expect(owner.getByRole('status')).toContainText(`is ready at ${sub}.localhost:5173`);
  await expect(owner.getByText(`Admin invited: ${adminEmail}`)).toBeVisible();

  // The invited Admin opens the invitation: it signs them in on the
  // ministry's own address and into its app, as its Admin.
  const hana = await (await browser.newContext()).newPage();
  const address = `http://${sub}.localhost:5173`;
  await hana.goto(await latestEmailLink(adminEmail));
  await hana.waitForURL(`${address}/app`);
  await expect(hana.getByRole('navigation').getByRole('link', { name: 'Account', exact: true })).toBeVisible();

  // Pause: the address goes offline.
  owner.on('dialog', (d) => void d.accept());
  await owner.reload();
  const row = owner.getByRole('listitem').filter({ hasText: `Hope ${stamp}` });
  await row.getByRole('button', { name: 'Pause account' }).click();
  await expect(owner.getByRole('status')).toContainText('is paused');
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(address);
  await expect(visitor.getByRole('heading', { name: `Hope ${stamp} is paused` })).toBeVisible();

  // …and back.
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await expect(owner.getByRole('status')).toContainText('active again');
});

test('the Owner invites a teammate; the waitlist is there', async ({ page }) => {
  const email = uniqueEmail('teammate');
  await ownerSignIn(page);
  await page.getByRole('link', { name: 'Team', exact: true }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Admin', { exact: false }).first().check();
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${email} is invited as Admin`);
  await expect(page.getByRole('listitem').filter({ hasText: email })).toContainText('invited');

  await page.getByRole('link', { name: 'Waitlist' }).click();
  await expect(page.getByRole('heading', { name: 'Waitlist' })).toBeVisible();
});
