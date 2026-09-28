import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, SARAH } from './support/supabase';

/**
 * Reading plans (0038): a Leader starts John in 21 days for the ministry to
 * read together; a member joins, opens today's reading from the plan, marks it
 * read, and turns on the daily email.
 */

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
}

test('read a plan together: start it, open today’s reading, mark it read', async ({ browser }) => {
  const db = service();
  // A clean slate from earlier runs.
  await db.from('reading_plan_groups').delete().neq('start_on', '1900-01-01');
  const { data: david } = await db.from('users').select('auth_uid').eq('id', DAVID.userId).single();
  await db.from('reading_progress').delete().eq('auth_uid', david!.auth_uid);

  // The Leader: Resources → Reading plans → read John together.
  const sarah = await (await browser.newContext()).newPage();
  await signIn(sarah, SARAH.email, SARAH.password);
  await sarah.goto('/leadership/resources');
  await sarah.getByRole('link', { name: /Reading plans/ }).click();
  const row = sarah.getByRole('listitem').filter({ hasText: 'John in 21 days' });
  await row.getByRole('button', { name: 'Read together…' }).click();
  await row.getByRole('button', { name: 'Start reading together' }).click();
  await expect(row).toContainText('reading together since');

  // A member: the Bible tab → Plans.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, DAVID.email, DAVID.password);
  await page.goto('/app/bible/JHN/1');
  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await page.getByRole('link', { name: /John in 21 days/ }).click();
  await expect(page.getByText('Your ministry is reading this together')).toBeVisible();
  await page.getByRole('button', { name: 'Read along together' }).click();

  // Today's reading opens in the Bible, with a way to mark it read.
  const today = page.getByRole('region', { name: 'Today’s reading' });
  await expect(today).toContainText('day 1');
  await today.getByRole('link', { name: 'John 1' }).click();
  await expect(page.getByRole('heading', { name: 'John 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark day 1 read' }).click();
  await page.waitForURL(/\/app\/bible\/plans\//);
  await expect(page.getByText('1 of 21 days read')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Today’s reading' })).toContainText('day 2');

  // The daily email: off until they turn it on.
  await page.getByLabel('Email time').fill('06:30');
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByText('Today’s reading arrives each day at 06:30.')).toBeVisible();

  // The Leader sees one reader (a count, never names).
  await sarah.reload();
  await expect(sarah.getByRole('listitem').filter({ hasText: 'John in 21 days' })).toContainText('1 reading along');
  await sarah.getByRole('listitem').filter({ hasText: 'John in 21 days' })
    .getByRole('button', { name: 'Stop reading together' }).click();
  await expect(sarah.getByRole('listitem').filter({ hasText: 'John in 21 days' })).not.toContainText('reading together since');
});
