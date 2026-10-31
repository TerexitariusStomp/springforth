import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 } });
await pg.goto('https://springforth.widespread.workers.dev/possibilities?card=poss-shrewsbury-riverside-flood-response-rive-mvhpdi84', { waitUntil: 'networkidle', timeout: 45000 });
await pg.waitForTimeout(2000);
const info = await pg.evaluate(() => {
  const h = [...document.querySelectorAll('h1,h2,h3')].find(e => /Severn/i.test(e.textContent));
  const chain = [];
  let n = h;
  for (let i = 0; i < 10 && n; i++) {
    const cs = getComputedStyle(n), r = n.getBoundingClientRect();
    chain.push(`${n.tagName}.${String(n.className).slice(0,60)} pos=${cs.position} ${Math.round(r.width)}x${Math.round(r.height)}`);
    n = n.parentElement;
  }
  return chain;
});
console.log(info.join('\n'));
await b.close();
