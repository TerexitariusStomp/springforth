// No-JS smoke: all primary surfaces must render usable HTML without
// hydration — forms POST plainly, links navigate, disclosures open.
import { chromium } from 'playwright';
const BASE = 'https://springforth-web.widespread.workers.dev';
const b = await chromium.launch();
const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
const pg = await ctx.newPage();
let pass = 0, fail = 0;
const check = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); cond ? pass++ : fail++; };

await pg.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
check('landing h1 visible', await pg.locator('h1').first().isVisible());
check('blur-fade content visible (noscript guard)', await pg.getByText('Declare', { exact: false }).first().isVisible().catch(() => pg.locator('section#how h2').first().isVisible()));
check('hero orbit card content', await pg.locator('main').textContent().then(t => t.length > 500));
// mobile menu: details/summary works without JS
await pg.locator('header summary').click();
check('mobile menu opens', await pg.locator('header details nav a[href="/possibilities"]').isVisible());

await pg.goto(`${BASE}/possibilities`, { waitUntil: 'domcontentloaded' });
check('deck cards render', (await pg.locator('main a[href*="card="]').count()) > 0);

// declare: ?declare=1 must SSR an inline POST form (dialog is JS-only)
await pg.goto(`${BASE}/possibilities?declare=1`, { waitUntil: 'domcontentloaded' });
check('declare form POSTs plainly', await pg.locator('section#declare form[action="/possibilities"][method="post"]').count() > 0);

// interest/pass forms need a viewer identity — anonymous cards get links
await pg.goto(`${BASE}/possibilities?actor=nojs-tester`, { waitUntil: 'domcontentloaded' });
check('interest form exists', (await pg.locator('form[action*="interest"]').count()) > 0);

await pg.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
check('search form is GET', await pg.locator('form[role="search"]').getAttribute('method') === 'get');

await pg.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
check('map svg markers link', (await pg.locator('svg a').count()) > 0);

await pg.goto(`${BASE}/no-such`, { waitUntil: 'domcontentloaded' });
check('404 has way home', await pg.locator('a[href="/"]').count() > 0);

await b.close();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
