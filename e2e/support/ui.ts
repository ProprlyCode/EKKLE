import type { Page } from '@playwright/test';

/** Open every collapsed section on the page (long lists fold away). */
export async function expandAll(page: Page) {
  await page.locator('main button[data-disclosure]').first().waitFor();
  const closed = page.locator('main button[data-disclosure][aria-expanded="false"]');
  for (let i = 0; i < 20 && (await closed.count()) > 0; i++) await closed.first().click();
}
