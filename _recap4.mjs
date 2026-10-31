import { chromium } from 'playwright';
const BASE = 'https://springforth.widespread.workers.dev';
const CARD = 'poss-shrewsbury-riverside-flood-response-rive-mvhpdi84';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await pg.goto(`${BASE}/possibilities?card=${CARD}`, { waitUntil: 'networkidle', timeout: 45000 });
await pg.waitForTimeout(2000);

// expand the value row + verified context details so the numbers show
await pg.evaluate(() => {
  document.querySelectorAll('details').forEach(d => {
    if (/GBP|verified|Impacts/i.test(d.textContent)) d.open = true;
  });
});
await pg.waitForTimeout(600);

// value block: container holding "Coordinated value"
const vbox = await pg.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /Coordinated value/i.test(e.textContent)).pop();
  if (!el) return null;
  let n = el;
  for (let i = 0; i < 6 && n.parentElement; i++) { n = n.parentElement; if (/GBP/.test(n.textContent)) break; }
  const r = n.getBoundingClientRect();
  return { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 };
});
console.log('vbox', JSON.stringify(vbox));
if (vbox) await pg.screenshot({ path: 'docs/hackathon/demo-assets/crop/severn-value-block.png', clip: vbox });

// whole card modal — scroll inner modal to top, then clip its panel
await pg.evaluate(() => window.scrollTo(0, 0));
const mbox = await pg.evaluate(() => {
  const h = [...document.querySelectorAll('h1,h2,h3')].find(e => /Severn/i.test(e.textContent));
  let n = h;
  for (let i = 0; i < 8 && n.parentElement; i++) { n = n.parentElement; if (getComputedStyle(n).borderRadius !== '0px' || /dialog/i.test(n.getAttribute('role') || '')) break; }
  const r = n.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 1600) };
});
console.log('mbox', JSON.stringify(mbox));
if (mbox) await pg.screenshot({ path: 'docs/hackathon/demo-assets/crop/17-uk-card.png', clip: mbox });
await b.close();
console.log('done');
