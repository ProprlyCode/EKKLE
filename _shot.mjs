import { chromium } from 'playwright-core';
const exec = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exec, args: ['--no-sandbox'] });
async function shot(path, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: file });
  console.log(file, '-> console errors:', errs.length ? errs.join(' | ') : 'none');
  await page.close();
}
const S='/tmp/claude-0/-home-user-EKKLE/379d6e68-028a-5235-802c-63c45f52ddaf/scratchpad/';
await shot('/sign-in', 390, 844, S+'signin-mobile.png');
await shot('/sign-in', 1200, 800, S+'signin-desktop.png');
await browser.close();
