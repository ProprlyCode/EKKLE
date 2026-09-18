import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const S='/tmp/claude-0/-home-user-EKKLE/379d6e68-028a-5235-802c-63c45f52ddaf/scratchpad/';
const p = await b.newPage({ viewport:{width:390,height:844} });
await p.goto('http://localhost:4173/offer', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(500);
await p.screenshot({ path:S+'offer-mobile.png', fullPage:true });
await b.close(); console.log('offer shot done');
