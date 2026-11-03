import { chromium } from 'playwright';
const BASE = 'https://springforth.widespread.workers.dev';
const CARD = 'poss-shrewsbury-riverside-flood-response-rive-mvhpdi84';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await pg.goto(`${BASE}/possibilities?card=${CARD}`, { waitUntil: 'networkidle', timeout: 45000 });
await pg.waitForTimeout(2500);
await pg.screenshot({ path: '/tmp/card-what-browser-sees.png', fullPage: false });
// find candidate containers for the value block
const info = await pg.evaluate(() => {
  const hit = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /Coordinated value/i.test(e.textContent)).map(e => e.tagName + '.' + e.className).slice(0, 5);
  return { url: location.href, hit };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
