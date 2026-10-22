// ss-verify render pass — screenshot every portal surface at the artifact's
// required viewports so the visual gate can inspect real pixels.
// Usage: node scripts/design-verify.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'https://springforth.widespread.workers.dev';
const OUT = process.argv[3] ?? '.styleseed/evidence';

const ROUTES = [
  ['landing', '/'], ['deck', '/possibilities'], ['console', '/rounds'],
  ['console', '/outcomes'], ['console', '/coordination'], ['console', '/portfolio'],
  ['console', '/governance'], ['instrument', '/verify'], ['instrument', '/datasets'],
  ['instrument', '/streams'], ['reference', '/docs'], ['tour-all', '/tour'],
  ['tour-all', '/all'],
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

const b = await chromium.launch();
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  for (const [artifact, route] of ROUTES) {
    const name = `${artifact}${route === '/' ? '' : route.replaceAll('/', '-')}-${vpName}`;
    try {
      await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      const dir = `${OUT}/${artifact}`;
      mkdirSync(dir, { recursive: true });
      await p.screenshot({ path: `${dir}/${name}.png`, fullPage: artifact === 'tour-all' ? false : true });
      console.log(`ok  ${name}`);
    } catch (e) {
      console.log(`ERR ${name}: ${e.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await b.close();
