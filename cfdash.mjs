import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://localhost:9222');
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.goto('https://dash.cloudflare.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(4000);
console.log('url:', p.url());
console.log('title:', await p.title());
console.log('body:', (await p.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\n/g, ' | '));
