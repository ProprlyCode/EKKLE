import { expect, test } from '@playwright/test';
import { PLATFORM } from './support/supabase';

// On phones the story must scroll all the way to the invitation. The join panel
// sits over the story's last frame; if it becomes its own scroll container (or
// overflows), iOS Safari hands swipes to it and the page stops short of the form.
test.use({ viewport: { width: 375, height: 568 }, hasTouch: true, isMobile: true });

test('on a small phone the story ends on the whole invitation', async ({ page }) => {
  await page.goto(PLATFORM);
  const join = page.locator('[data-j="join"]');
  await expect(join).toBeAttached();
  await page.waitForTimeout(4500); // the loader lifts

  await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('[data-j="track"]')!;
    window.scrollTo(0, track.offsetTop + track.offsetHeight - window.innerHeight);
  });
  await expect(join).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeInViewport({ ratio: 1 });

  const box = await join.evaluate((el) => ({
    overflowY: getComputedStyle(el).overflowY,
    fits: el.scrollHeight <= el.clientHeight,
  }));
  expect(box.overflowY).not.toBe('auto');
  expect(box.fits).toBe(true);
});
