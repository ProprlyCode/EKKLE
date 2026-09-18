import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const S='/tmp/claude-0/-home-user-EKKLE/379d6e68-028a-5235-802c-63c45f52ddaf/scratchpad/';
async function shot(path, w, h, file){
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto('http://localhost:4173'+path, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.screenshot({ path:file, fullPage:true });
  await p.close();
}
await shot('/', 1200, 900, S+'home-desktop.png');
await shot('/', 390, 844, S+'home-mobile.png');
await shot('/for-churches', 1200, 900, S+'churches-desktop.png');
await b.close(); console.log('home shots done');
