import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 } });
await pg.goto('https://springforth.widespread.workers.dev/possibilities?card=poss-shrewsbury-riverside-flood-response-rive-mvhpdi84', { waitUntil: 'networkidle', timeout: 45000 });
await pg.waitForTimeout(2000);
const info = await pg.evaluate(() => {
  const leaf = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /Coordinated value/i.test(e.textContent));
  const chain = [];
  let n = leaf;
  for (let i = 0; i < 14 && n; i++) {
    const cs = getComputedStyle(n), r = n.getBoundingClientRect();
    chain.push(`${n.tagName}.${String(n.className).slice(0,70)} pos=${cs.position} z=${cs.zIndex} ${Math.round(r.width)}x${Math.round(r.height)}`);
    n = n.parentElement;
  }
  return chain;
});
console.log(info.join('\n'));
await b.close();
