import { expect, test, type Page } from '@playwright/test';
import { DAVID, SARAH } from './support/supabase';

/**
 * Guided tours: started only when asked; each step lights one thing; Back,
 * Next, Esc and Done work; Admins get the Account step, on phones too.
 */
test('a member’s tour, on a phone', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await signIn(page, DAVID.email, DAVID.password);
  await page.goto('/app');
  await expect(page.getByRole('dialog')).toHaveCount(0); // never by itself
  await page.getByRole('button', { name: 'Take a quick tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Tour of your code page' });
  await expect(tour).toContainText('1 of 6');
  await expect(tour.getByRole('heading')).toHaveText('Your code');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByRole('heading')).toHaveText('Faith in action');
  await tour.getByRole('button', { name: 'Back' }).click();
  await expect(tour.getByRole('heading')).toHaveText('Your code');
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
});

test('an Admin’s tour ends at Account', async ({ page }) => {
  await signIn(page, SARAH.email, SARAH.password);
  await page.goto('/leadership/overview');
  await page.getByRole('button', { name: 'Take a quick tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Tour of the leadership tabs' });
  for (let i = 0; i < 5; i++) await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByRole('heading')).toHaveText('Account');
  await tour.getByRole('button', { name: 'Done' }).click();
  await expect(tour).toHaveCount(0);
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Use a password instead' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app**');
}
