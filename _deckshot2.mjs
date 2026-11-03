import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.goto('file:///home/terex/Documents/springforth/docs/hackathon/deck.html');
await pg.waitForTimeout(700);
const go = async n => { await pg.keyboard.press('Home'); for (let i = 0; i < n - 1; i++) { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(120); } await pg.waitForTimeout(400); };
for (const n of [3, 6, 8, 12]) {
  await go(n);
  await pg.screenshot({ path: `/tmp/v-slide-${n}.png` });
}
await b.close(); console.log('done');
