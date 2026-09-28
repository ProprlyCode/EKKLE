import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, OWEN, PLATFORM, SARAH } from './support/supabase';

/**
 * Faith in action (0039): the Ekklē team publishes one of its draft prompts,
 * a Leader adds the ministry's own, and a member sees this week's prompt by
 * their code and browses the rest.
 */

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
}

test('prompts: Ekklē publishes, a ministry adds its own, a member sees them by their code', async ({ browser }) => {
  const ours = `“What are you hoping for this season?” ${Date.now() % 100000}`;
  const theirs = 'Print your code on a small card and keep it in your wallet or phone case.';
  try {
    // The Ekklē team: the starting set arrives as drafts; publish one.
    const owen = await (await browser.newContext()).newPage();
    await owen.goto(`${PLATFORM}sign-in`);
    await owen.getByLabel('Email').fill(OWEN.email);
    await owen.getByLabel('Password').fill(OWEN.password);
    await owen.getByRole('button', { name: 'Sign in' }).click();
    await owen.waitForURL('**/platform');
    await owen.getByRole('link', { name: 'Prompts' }).click();
    const row = owen.getByRole('listitem').filter({ hasText: theirs });
    await expect(row).toBeVisible();
    if (await row.getByRole('button', { name: 'Publish' }).isVisible()) {
      await row.getByRole('button', { name: 'Publish' }).click();
    }
    await expect(row.getByRole('button', { name: 'Publish' })).toHaveCount(0);

    // A Leader adds one for the ministry.
    const sarah = await (await browser.newContext()).newPage();
    await signIn(sarah, SARAH.email, SARAH.password);
    await sarah.goto('/leadership/resources');
    await sarah.getByRole('link', { name: /Faith in action/ }).click();
    await expect(sarah.getByText(theirs)).toBeVisible(); // Ekklē's, read-only
    await sarah.getByRole('button', { name: 'New prompt' }).click();
    await sarah.getByLabel('Kind').selectOption({ label: 'Conversation starters' });
    await sarah.getByLabel('Prompt').fill(ours);
    await sarah.getByRole('button', { name: 'Save prompt' }).click();
    await expect(sarah.getByText(ours)).toBeVisible();

    // A member: this week's prompt by their code, and more ideas.
    const david = await (await browser.newContext()).newPage();
    await signIn(david, DAVID.email, DAVID.password);
    const card = david.getByRole('region', { name: 'Faith in action' });
    await expect(card).toContainText('this week');
    await card.getByRole('button', { name: 'More ideas' }).click();
    await expect(card).toContainText(theirs);
    await expect(card).toContainText(ours);
  } finally {
    await service().from('faith_prompts').delete().eq('body', ours);
  }
});
