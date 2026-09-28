import { expect, test } from '@playwright/test';
import { admin as service, OWEN, PLATFORM } from './support/supabase';

/**
 * Address change requests (0043): a ministry's Admin asks for a new address,
 * the Ekklē team approves, and the old address sends people to the same page
 * at the new one. Uses its own throwaway ministry.
 */
test('an Admin asks for a new address; once approved, the old one leads there', async ({ browser }) => {
  const db = service();
  const n = Date.now() % 1_000_000;
  const oldSub = `addr${n}`;
  const newSub = `addr${n}-new`;
  const email = `addr${n}@e2e.test`;
  const password = 'e2e-address-password-1';

  const { data: org } = await db
    .from('organizations')
    .insert({ name: `Address Test ${n}`, slug: oldSub, join_code: `AD${n}`, subdomain: oldSub })
    .select('id')
    .single();
  const { data: created } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  const uid = created.user!.id;
  await db.from('users').insert({ org_id: org!.id, auth_uid: uid, name: 'Ada', role: 'admin', code_slug: `ada-${n}`, email });

  try {
    // The Admin asks.
    const ada = await (await browser.newContext()).newPage();
    await ada.goto(`http://${oldSub}.localhost:5173/sign-in`);
    await ada.getByRole('button', { name: 'Use a password instead' }).click();
    await ada.getByLabel('Email').fill(email);
    await ada.getByLabel('Password').fill(password);
    await ada.getByRole('button', { name: 'Sign in' }).click();
    await ada.waitForURL('**/app**');
    await ada.goto(`http://${oldSub}.localhost:5173/leadership/account`);
    await ada.getByRole('button', { name: 'Request a new address' }).click();
    await ada.getByLabel('New address').fill('admin');
    await expect(ada.getByText('admin.ekkle.org is taken.')).toBeVisible();
    await ada.getByLabel('New address').fill(newSub);
    await expect(ada.getByText(`${newSub}.ekkle.org is free.`)).toBeVisible();
    await ada.getByLabel('Note for the Ekklē team (optional)').fill('We renamed');
    await ada.getByRole('button', { name: 'Send request' }).click();
    await expect(ada.getByRole('status').filter({ hasText: 'You asked for' })).toContainText(`${newSub}.ekkle.org`);

    // The Ekklē team approves.
    const owen = await (await browser.newContext()).newPage();
    await owen.goto(`${PLATFORM}sign-in`);
    await owen.getByLabel('Email').fill(OWEN.email);
    await owen.getByLabel('Password').fill(OWEN.password);
    await owen.getByRole('button', { name: 'Sign in' }).click();
    await owen.waitForURL('**/platform');
    const requests = owen.getByRole('region', { name: 'Address requests' });
    const row = requests.getByRole('listitem').filter({ hasText: `Address Test ${n}` });
    await expect(row).toContainText('“We renamed”');
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(owen.getByRole('status')).toContainText(`Address Test ${n} is now at ${newSub}`);

    // The old address leads to the same page at the new one.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`http://${oldSub}.localhost:5173/space/studies?from=card`);
    await visitor.waitForURL(`http://${newSub}.localhost:5173/space/studies?from=card`);
  } finally {
    await db.from('organizations').delete().eq('id', org!.id);
    await db.auth.admin.deleteUser(uid);
  }
});
