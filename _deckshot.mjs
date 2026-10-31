import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.goto('file:///home/terex/Documents/springforth/docs/hackathon/deck.html');
await pg.waitForTimeout(800);
for (const [n, key] of [[3,'ArrowRight'],[4,'ArrowRight'],[5,'ArrowRight'],[6,'ArrowRight'],[7,'ArrowRight'],[8,'ArrowRight']]) {
  await pg.keyboard.press('ArrowRight');
  await pg.waitForTimeout(250);
}
await pg.screenshot({ path: '/tmp/newslide-8.png' }); // slide 8 proof
for (let i = 0; i < 4; i++) { await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(150); }
await pg.screenshot({ path: '/tmp/newslide-4.png' });
await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(200);
await pg.screenshot({ path: '/tmp/newslide-3.png' });
await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
await pg.screenshot({ path: '/tmp/newslide-5.png' });
await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
await pg.screenshot({ path: '/tmp/newslide-6.png' });
await b.close(); console.log('done');
