// a11y gate — inject vendored axe-core into each rendered page via
// Playwright and report violations. No CDN: axe.min.js is the pinned
// node_modules copy (devDependency axe-core, MPL-2.0).
// Usage: node scripts/a11y-check.mjs [baseUrl]
// Exit 1 on any serious/critical violation; minor/moderate are warnings.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.argv[2] ?? 'https://springforth.widespread.workers.dev';

const ROUTES = [
  '/', '/possibilities', '/collaborate', '/fund', '/impact',
  '/community', '/how-it-works', '/whitepaper', '/docs',
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

let failures = 0, warnings = 0;
const b = await chromium.launch();
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  for (const route of ROUTES) {
    try {
      await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      await p.evaluate(AXE);
      const res = await p.evaluate(() => window.axe.run(document, {
        resultTypes: ['violations'],
        rules: { 'color-contrast': { enabled: true } },
      }));
      for (const v of res.violations) {
        const nodes = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ');
        const line = `  ${v.impact} ${v.id} ×${v.nodes.length} — ${nodes}`;
        if (v.impact === 'critical' || v.impact === 'serious') {
          failures++;
          console.log(`FAIL ${route} [${vpName}]`);
          console.log(line);
        } else {
          warnings++;
          console.log(`warn ${route} [${vpName}]`);
          console.log(line);
        }
      }
      if (!res.violations.length) console.log(`ok   ${route} [${vpName}]`);
    } catch (e) {
      failures++;
      console.log(`ERR  ${route} [${vpName}]: ${e.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await b.close();
console.log(`\n${failures} serious/critical, ${warnings} minor/moderate`);
process.exit(failures ? 1 : 0);
