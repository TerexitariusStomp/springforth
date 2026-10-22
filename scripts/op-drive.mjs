import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://localhost:9222');
const page = b.contexts()[0].pages()[0];
// hover the disabled button to see if a tooltip explains the restriction
const el = await page.$('button:has-text("OUTCOME")');
const title = await el?.evaluate(e => e.closest('[title]')?.getAttribute('title') || e.parentElement?.getAttribute('title') || '');
console.log('button title attr:', title || '(none)');
// check for request-access / upgrade links anywhere
const links = await page.$$eval('a,button', els => els.map(e=>e.innerText?.trim()).filter(t=>/request|upgrade|invite|access|permission/i.test(t||'')));
console.log('access links:', JSON.stringify(links));
// the mindmap node context menu — right-click a node?
const nodes = await page.$$('.mindmap-node, [class*=node], svg g[class]');
console.log('node-ish els:', nodes.length);
await b.close();
