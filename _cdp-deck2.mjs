import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('drive.google.com'));
if (!page) { page = await ctx.newPage(); await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000); }
await page.bringToFront();
await page.locator('button:has-text("New")').first().click();
await page.waitForTimeout(1200);
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 15000 }),
  page.locator('[role="menuitem"]:has-text("File upload")').first().click(),
]);
await chooser.setFiles(['/home/terex/Documents/springforth/docs/hackathon/springforth-deck.pptx']);
console.log('uploading...');
await page.waitForTimeout(15000);
const row = page.locator('text=springforth-deck').last();
await row.click().catch(() => {});
await page.waitForTimeout(8000);
for (const p of ctx.pages()) if (p.url().includes('presentation')) console.log('SLIDES:', p.url().slice(0, 110));
await b.close();
