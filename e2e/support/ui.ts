import type { Page } from '@playwright/test';

/**
 * Open every collapsed section on the page (long lists fold away). A section
 * can redraw mid-click while the page is still loading its list, so each click
 * is short and simply retried on the next pass.
 */
export async function expandAll(page: Page) {
  await page.locator('main button[data-disclosure]').first().waitFor();
  const closed = page.locator('main button[data-disclosure][aria-expanded="false"]');
  for (let i = 0; i < 30 && (await closed.count()) > 0; i++) {
    await closed.first().click({ timeout: 3000 }).catch(() => {});
  }
}
