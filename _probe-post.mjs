import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('gov.gitcoin.co'));
if (!page) { page = await ctx.newPage(); }
await page.goto('https://gov.gitcoin.co/t/love-fund-pilot-a-commitment-pooling-experiment/25438', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const user = await page.evaluate(() => window.Discourse?.User?.current()?.username ?? document.querySelector('.current-user')?.textContent ?? null);
const replyBtn = await page.locator('button.reply').count();
const editor = await page.locator('#reply-control, .reply-area').count();
const lastPost = await page.locator('.topic-post').last().innerText().catch(() => '');
console.log(JSON.stringify({ user, replyBtn, composer: editor, lastPostHead: lastPost.slice(0, 200) }));
await b.close();
