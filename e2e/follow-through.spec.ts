import { expect, test } from '@playwright/test';
import { admin as service, DAVID, SARAH } from './support/supabase';

/**
 * Follow-through (0035): an Admin sees who is waiting for a reply in
 * Overview → Conversations (never what anyone wrote), moves a conversation
 * from David to herself, and the conversation shows who passed it on.
 */
test('an Admin moves a waiting conversation to someone else', async ({ page }) => {
  const db = service();
  const name = `Wren${Date.now() % 100000}`;
  const { data: david } = await db.from('users').select('org_id').eq('id', DAVID.userId).single();
  const { data: rec } = await db
    .from('recipients')
    .insert({ org_id: david!.org_id, first_name: name, session_token: `ft-${name}` })
    .select('id')
    .single();
  const { data: convo } = await db
    .from('conversations')
    .insert({ org_id: david!.org_id, member_id: DAVID.userId, recipient_id: rec!.id })
    .select('id')
    .single();
  await db.from('messages').insert({
    conversation_id: convo!.id,
    sender_type: 'recipient',
    body: 'Is anyone there?',
    created_at: new Date(Date.now() - 50 * 3600_000).toISOString(),
  });

  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(SARAH.email);
  await page.getByLabel('Password').fill(SARAH.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
  await page.goto('/leadership/overview');

  const row = page.getByRole('listitem').filter({ hasText: `${name} with` });
  await expect(row).toContainText('Waiting for a reply · 2 days');
  await expect(row).not.toContainText('Is anyone there?');
  await row.getByRole('button', { name: 'Move to…' }).click();
  await row.getByLabel(`Move ${name}’s conversation to`).selectOption({ label: 'Sarah (leader)' });
  await row.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${name}’s conversation is now with Sarah (leader).`);

  // Sarah's side: the history came along, with a note on where it came from.
  await page.goto(`/app/messages/${convo!.id}`);
  await expect(page.getByText('Is anyone there?')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('passed this conversation to Sarah (leader).');
});
