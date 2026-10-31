import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('drive.google.com'));
await page.bringToFront();
await page.locator('button:has-text("Upload")').first().click();
console.log('upload clicked, waiting...');
await page.waitForTimeout(20000);
// refresh the open Slides tab to pull the new version
const slides = ctx.pages().find(p => p.url().includes('presentation/d/1of61'));
if (slides) { await slides.bringToFront(); await slides.reload({ waitUntil: 'domcontentloaded' }); await slides.waitForTimeout(8000); await slides.screenshot({ path: '/tmp/slides-new.png' }); console.log('slides refreshed'); }
await b.close();
