import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('gov.gitcoin.co')) ?? (await ctx.newPage());
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(9000);
const info = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  posts: document.querySelectorAll('.topic-post').length,
  loginBtn: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/log in|sign up/i.test(t)),
  avatar: !!document.querySelector('#current-user, .header-dropdown-toggle'),
  replyBtns: document.querySelectorAll('button.reply, button.create, button[title*="reply" i]').length,
  bodySnippet: document.body.innerText.slice(0, 400),
}));
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: '/tmp/gov-thread.png' });
await b.close();
