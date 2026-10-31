import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await pg.goto('https://springforth.widespread.workers.dev/possibilities?card=poss-shrewsbury-riverside-flood-response-rive-mvhpdi84', { waitUntil: 'networkidle', timeout: 45000 });
await pg.waitForTimeout(2000);
await pg.evaluate(() => {
  document.querySelectorAll('details').forEach(d => { if (/GBP|verified|Impacts/i.test(d.textContent)) d.open = true; });
});
await pg.waitForTimeout(500);
const modal = pg.locator('div.fixed.z-50').first();
console.log('modal count', await pg.locator('div.fixed.z-50').count());
await modal.screenshot({ path: 'docs/hackathon/demo-assets/crop/17-uk-card.png' });
// architecture svg at 3x
await pg.setViewportSize({ width: 1920, height: 1080 });
await pg.goto('file:///home/terex/Documents/springforth/docs/hackathon/demo-assets/architecture.svg');
await pg.waitForTimeout(800);
await pg.screenshot({ path: 'docs/hackathon/demo-assets/crop/architecture-hi.png', fullPage: true });
await b.close(); console.log('done');
