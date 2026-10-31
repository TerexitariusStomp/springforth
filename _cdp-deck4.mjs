import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('drive.google.com'));
await page.bringToFront();
await page.screenshot({ path: '/tmp/dup-dialog.png' });
const btns = await page.locator('[role="dialog"] button, [role="alertdialog"] button').all();
for (const btn of btns) console.log('BTN:', (await btn.textContent()).trim());
await b.close();
