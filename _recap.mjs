import { chromium } from 'playwright';
const BASE = 'https://springforth.widespread.workers.dev';
const OUT = 'docs/hackathon/demo-assets/crop/';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const shot = async (url, sel, file, clipFn) => {
  try {
    await pg.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
    await pg.waitForTimeout(1200);
    if (clipFn) {
      const box = await pg.evaluate(clipFn);
      if (!box) { console.log('NO BOX', file); return; }
      await pg.screenshot({ path: OUT + file, clip: box });
    } else {
      await pg.locator(sel).first().screenshot({ path: OUT + file });
    }
    console.log('OK', file);
  } catch (e) { console.log('FAIL', file, e.message.slice(0, 120)); }
};

// value block: union of the .meta div + the valrows list after it
await shot('/possibilities?card=poss-shrewsbury-riverside-flood-response-rive-mvhpdi84', null, 'severn-value-block.png', () => {
  const m = [...document.querySelectorAll('.detail-panel .meta')].find(e => e.textContent.includes('Coordinated value'));
  if (!m) return null;
  let end = m.nextElementSibling;
  while (end && !end.matches('ul.needs')) end = end.nextElementSibling;
  const a = m.getBoundingClientRect(), c = end ? end.getBoundingClientRect() : a;
  return { x: a.x - 8, y: a.y - 8, width: a.width + 16, height: Math.max(a.bottom, c.bottom) - a.y + 16 };
});
await shot('/possibilities?card=poss-shrewsbury-riverside-flood-response-rive-mvhpdi84', '.detail-panel', '17-uk-card.png');
await shot('/impact', '#data', '12-datasets.png');
await shot('/impact', '#evidence', '07-verify.png');
await shot('/fund', '#rounds', '18-severn-round.png');
await shot('/fund', '#rounds', '09-rounds.png');
await shot('/rounds/round-pairwise-demo', 'main', '10-pairwise.png');
await shot('/collaborate', '#outcomes', '04-outcomes.png');
await shot('/community', '#trust', '08-trust.png');
await shot('/', 'main', '01-landing.png');
await shot('/possibilities', 'main', '02-possibilities.png');
await b.close();
