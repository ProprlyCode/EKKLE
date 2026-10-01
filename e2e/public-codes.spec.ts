import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, SARAH, uniqueEmail } from './support/supabase';

/**
 * Public codes (0050): an Admin makes a code for a lobby poster; someone who
 * scans it meets the ministry (not a member) and their message goes to the
 * designated responder.
 */

const PILOT = '00000000-0000-0000-0000-0000000000a1';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}

test('a lobby poster: made by an Admin, answered by the designated responder', async ({ browser }) => {
  const db = service();
  const { data: org } = await db.from('organizations').select('default_member_id').eq('id', PILOT).single();
  await db.from('public_codes').delete().eq('org_id', PILOT);
  await db.from('organizations').update({ default_member_id: DAVID.userId }).eq('id', PILOT);
  try {
    // Sarah (Admin) makes the code and opens its poster.
    const sarah = await (await browser.newContext()).newPage();
    await signIn(sarah, SARAH.email, SARAH.password);
    await sarah.goto('/leadership/content');
    await sarah.getByRole('link', { name: /Public codes/ }).click();
    await expect(sarah.getByText(/messages go to David/)).toBeVisible();
    await sarah.getByRole('button', { name: 'New public code' }).click();
    const form = sarah.getByRole('form', { name: 'Public code' });
    await form.getByLabel('Name', { exact: true }).fill('Lobby poster');
    await expect(form.getByLabel('Link name')).toHaveValue('lobby-poster');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(sarah.getByRole('status')).toContainText('“Lobby poster” is saved.');
    await sarah.getByRole('link', { name: 'Print a poster' }).click();
    const poster = sarah.getByRole('article', { name: 'Poster' });
    await expect(poster).toContainText('Grace Chapel (pilot)');
    await expect(poster.getByRole('img', { name: /QR code/ })).toBeVisible();
    await expect(poster).toContainText('/c/lobby-poster');

    // Someone scans it: the ministry speaks, and David answers.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto('/c/lobby-poster');
    await expect(visitor.getByText('A welcome from Grace Chapel (pilot)')).toBeVisible();
    await visitor.getByRole('button', { name: 'Begin' }).click();
    for (let i = 0; i < 10; i++) {
      const cont = visitor.getByRole('button', { name: /^(Continue|One more thing)$/ });
      if (!(await cont.isVisible().catch(() => false))) break;
      await cont.click();
    }
    await visitor.getByRole('button', { name: /Message Grace Chapel/ }).click();
    await visitor.getByLabel('Your first name').fill('Poppy');
    await visitor.getByLabel('Email').fill(uniqueEmail('poster'));
    await visitor.getByLabel('Your message').fill('I saw your poster.');
    await visitor.getByRole('button', { name: 'Send' }).click();
    await expect(visitor.getByRole('heading', { name: 'Keep this conversation' })).toBeVisible();

    const { data: code } = await db.from('public_codes').select('id').eq('code', 'lobby-poster').single();
    const { data: convo } = await db.from('conversations').select('member_id').eq('public_code_id', code!.id).single();
    expect(convo!.member_id).toBe(DAVID.userId);

    // Sarah sees how it's doing.
    await sarah.goto('/leadership/public-codes');
    await expect(sarah.getByText(/opened 1 · wrote 1/)).toBeVisible();
  } finally {
    await db.from('conversations').delete().not('public_code_id', 'is', null);
    await db.from('public_codes').delete().eq('org_id', PILOT);
    await db.from('organizations').update({ default_member_id: org?.default_member_id ?? null }).eq('id', PILOT);
  }
});
