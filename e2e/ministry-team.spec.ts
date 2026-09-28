import { expect, test, type Page } from '@playwright/test';
import { admin as service, latestEmailLink, SARAH, uniqueEmail } from './support/supabase';

/**
 * The ministry team (docs/accounts-and-roles.md, slice 3): an Admin invites
 * someone with a role; they open the emailed invitation and join with that
 * role; the Admin changes it; the join code can be switched off.
 */

async function adminSignIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(SARAH.email);
  await page.getByLabel('Password').fill(SARAH.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
}

test('an Admin invites a Leader, who joins as one; the Admin changes their role', async ({ browser }) => {
  const email = uniqueEmail('leader');
  const name = `Lena ${Date.now() % 100000}`;
  const admin = await (await browser.newContext()).newPage();
  await adminSignIn(admin);
  await admin.goto('/leadership/people');
  await admin.getByLabel('Name', { exact: true }).fill(name);
  await admin.getByLabel('Email').fill(email);
  await admin.getByLabel('Leader').check();
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(admin.getByRole('status')).toContainText(`${email} is invited as Leader. We emailed them an invitation.`);
  const row = admin.getByRole('listitem').filter({ hasText: email });
  await expect(row).toContainText('invited');

  // They open the invitation: signed in on the ministry's address, as a Leader.
  const lena = await (await browser.newContext()).newPage();
  await lena.goto(await latestEmailLink(email));
  await lena.waitForURL('**/app');
  const nav = lena.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'People', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Account', exact: true })).toHaveCount(0);

  // The Admin makes them a Member.
  await admin.reload();
  await admin.getByLabel(`Role for ${name}`).selectOption('member');
  await expect(admin.getByRole('status')).toContainText(`${name} is now Member.`);
});

test('the join code can be switched off (and back on)', async ({ page }) => {
  // Start from "on", whatever an earlier run left.
  await service().from('organizations').update({ join_enabled: true }).eq('subdomain', 'pilot');
  await adminSignIn(page);
  await page.goto('/leadership/account');
  const toggle = page.getByLabel('Join code on');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByRole('button', { name: 'New code' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Join code on')).not.toBeChecked();
  await page.getByLabel('Join code on').check();
  await expect(page.getByRole('button', { name: 'New code' })).toBeVisible();
});
