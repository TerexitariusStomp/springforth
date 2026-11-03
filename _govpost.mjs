import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const THREAD = 'https://gov.gitcoin.co/t/love-fund-pilot-a-commitment-pooling-experiment/25438';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = await ctx.newPage();
await page.goto(THREAD, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.topic-post', { timeout: 30000 });
await page.waitForTimeout(3000);

const state = await page.evaluate(() => ({
  posts: document.querySelectorAll('.topic-post').length,
  loggedOut: !!document.querySelector(".login-button"),
  user: window.Discourse?.User?.current()?.username ?? null,
}));
console.log('STATE', JSON.stringify(state));
if (!state.user) { console.log('NOT_LOGGED_IN'); await b.close(); process.exit(2); }

async function post(text, tag) {
  // open the reply composer
  await page.locator('button.reply.create').first().click();
  await page.waitForSelector('#reply-control.open, #reply-control textarea', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.locator('#reply-control textarea, .d-editor-input').first().fill(text);
  await page.waitForTimeout(1200);
  await page.locator('#reply-control button.create, .save-or-cancel button.create').first().click();
  // wait for composer to close = post submitted
  await page.waitForSelector('#reply-control.closed, #reply-control:not(.open)', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const ok = await page.evaluate((needle) =>
    [...document.querySelectorAll('.topic-post .cooked')].some((c) => c.innerText.includes(needle)),
    text.slice(0, 60));
  console.log(tag, ok ? 'POSTED' : 'NOT_CONFIRMED');
  return ok;
}

const ops = readFileSync('docs/gitcoin/lovefund/ops-reply.md', 'utf8');
const dev = readFileSync('docs/gitcoin/lovefund/devansh-allocation-followup.md', 'utf8');
const ok1 = await post(ops, 'OPS-REPLY');
const ok2 = ok1 ? await post(dev, 'DEVANSH-FOLLOWUP') : false;
console.log(JSON.stringify({ ops: ok1, devansh: ok2 }));
await b.close();
