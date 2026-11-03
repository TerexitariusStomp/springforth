import { chromium } from 'playwright';
const BASE = 'https://springforth.widespread.workers.dev';
const OUT = 'docs/hackathon/demo-assets/crop/';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const hide = `document.querySelectorAll('nav,header,[class*="sticky"]').forEach(e => { if (getComputedStyle(e).position !== 'static') e.style.display = 'none'; });`;
const shots = [
  ['/', 'main', '01-landing.png'],
  ['/possibilities', 'main', '02-possibilities.png'],
  ['/collaborate', '#outcomes', '04-outcomes.png'],
  ['/impact', '#evidence', '07-verify.png'],
  ['/community', '#trust', '08-trust.png'],
  ['/fund', '#rounds', '09-rounds.png'],
  ['/fund', '#rounds', '18-severn-round.png'],
  ['/rounds/round-pairwise-demo', 'main', '10-pairwise.png'],
  ['/impact', '#data', '12-datasets.png'],
];
for (const [url, sel, file] of shots) {
  try {
    await pg.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
    await pg.waitForTimeout(1200);
    await pg.evaluate(hide);
    await pg.locator(sel).first().screenshot({ path: OUT + file });
    console.log('OK', file);
  } catch (e) { console.log('FAIL', file, e.message.slice(0, 90)); }
}
await b.close();
