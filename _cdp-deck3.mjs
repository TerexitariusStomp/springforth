import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('drive.google.com'));
if (!page) { page = await ctx.newPage(); await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000); }
await page.bringToFront();
await page.waitForTimeout(1500);
const rows = await page.locator('text=springforth-deck').all();
console.log('deck entries:', rows.length);
for (const r of rows) console.log(' -', (await r.textContent()).slice(0, 60));
// the newest upload is the LAST match in the upload-complete panel or "(1)" in the list
const newFile = page.locator('text=springforth-deck (1)').last();
if (await newFile.count()) { await newFile.dblclick(); console.log('opened (1)'); }
else { await rows[rows.length-1].dblclick(); console.log('opened last match'); }
await page.waitForTimeout(9000);
for (const p of ctx.pages()) if (p.url().includes('presentation')) console.log('SLIDES:', p.url().slice(0, 110));
await b.close();
