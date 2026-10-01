import { expect, test, type Page } from '@playwright/test';
import { admin as service, DAVID, OWEN, PLATFORM, SARAH } from './support/supabase';

/**
 * Situations (0048–0049): the Ekklē team publishes a template, a ministry
 * copies it and offers it to members, a member taps it under their code, and
 * someone who opens that link meets the situation's flow — and still writes
 * to the member.
 */

async function signIn(page: Page, url: string, email: string, password: string, after: string) {
  await page.goto(url);
  if (!url.startsWith(PLATFORM)) await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(after);
}

async function reset() {
  const db = service();
  const { data: t } = await db.from('flow_templates').select('id').eq('slug', 'coffee').single();
  await db.from('sequences').delete().eq('template_id', t!.id);
  await db.from('flow_templates').update({ status: 'draft' }).eq('slug', 'coffee');
}

test('a situation: Ekklē publishes, the ministry offers it, a member shares it', async ({ browser }) => {
  await reset();
  try {
    // The Ekklē team publishes the "Over coffee" draft.
    const owen = await (await browser.newContext()).newPage();
    await signIn(owen, `${PLATFORM}sign-in`, OWEN.email, OWEN.password, '**/platform');
    await owen.getByRole('link', { name: 'Flow templates' }).click();
    await owen.getByRole('listitem').filter({ hasText: 'Over coffee' }).getByRole('button', { name: 'Edit' }).click();
    await expect(owen.getByLabel('Flow title')).toHaveValue('Thanks for the conversation');
    await owen.getByRole('button', { name: 'Publish' }).click();
    await expect(owen.getByRole('status')).toContainText('“Over coffee” is published.');

    // Sarah (Admin) uses it, publishes it and offers it to members.
    const sarah = await (await browser.newContext()).newPage();
    await signIn(sarah, '/sign-in', SARAH.email, SARAH.password, '**/app**');
    await sarah.goto('/leadership/content');
    const templates = sarah.getByRole('region', { name: 'Templates' });
    await templates.getByRole('listitem').filter({ hasText: 'Over coffee' }).getByRole('button', { name: 'Use this template' }).click();
    await expect(sarah.getByLabel('Flow title')).toHaveValue('Thanks for the conversation');
    await sarah.getByRole('button', { name: 'Publish' }).click();
    await expect(sarah.getByRole('button', { name: 'Move to draft' })).toBeVisible();
    const situation = sarah.getByRole('form', { name: 'Situation' });
    await expect(situation.getByLabel('Situation name')).toHaveValue('Over coffee');
    await expect(situation.getByLabel('Link name')).toHaveValue('coffee');
    await situation.getByLabel('Offer to members as a situation').check();
    await situation.getByRole('button', { name: 'Save situation' }).click();
    await expect(situation.getByRole('status')).toContainText('Members now see “Over coffee” under their code.');

    // David taps it under his code: the same link, with the situation added.
    const david = await (await browser.newContext()).newPage();
    await signIn(david, '/sign-in', DAVID.email, DAVID.password, '**/app**');
    await david.goto('/app');
    const chip = david.getByRole('button', { name: 'Over coffee' });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const card = david.getByRole('region', { name: 'Your code to share' });
    await expect(card).toContainText('Showing: Over coffee');
    await expect(card).toContainText('/r/david/coffee');
    await card.getByRole('button', { name: 'Back to your main code' }).click();
    await expect(card).not.toContainText('/r/david/coffee');

    // Someone opens it: the coffee flow, and David on the card.
    const friend = await (await browser.newContext()).newPage();
    await friend.goto('/r/david/coffee');
    await friend.getByRole('button', { name: 'Begin' }).click();
    await expect(friend.getByRole('heading', { name: 'thanks for the conversation' })).toBeVisible();

    const db = service();
    const { data: flow } = await db.from('sequences').select('id').eq('situation_slug', 'coffee').single();
    await expect
      .poll(async () => {
        const { count } = await db
          .from('sequence_events')
          .select('id', { count: 'exact', head: true })
          .eq('sequence_id', flow!.id)
          .eq('member_id', DAVID.userId)
          .eq('event', 'started');
        return count;
      })
      .toBe(1);
  } finally {
    await reset();
  }
});
