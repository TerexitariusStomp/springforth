import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 810 } });
await pg.goto('file:///home/terex/Documents/springforth/docs/hackathon/deck.html');
await pg.waitForTimeout(1200);
await pg.emulateMedia({ media: 'print' });
await pg.pdf({ path: 'docs/hackathon/deck.pdf', width: '1440px', height: '810px', printBackground: true, pageRanges: '1-18' });
await b.close(); console.log('pdf done');
