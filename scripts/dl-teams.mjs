import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const b = await chromium.connectOverCDP('http://localhost:9222');
const ctx = b.contexts()[0];
const cookies = await ctx.cookies('https://responsiblerisk.sharepoint.com');
const lines = ['# Netscape HTTP Cookie File'];
for (const c of cookies) {
  lines.push([c.domain, c.domain.startsWith('.') ? 'TRUE' : 'FALSE',
    c.path, c.secure ? 'TRUE' : 'FALSE',
    Math.floor(c.expires > 0 ? c.expires : Date.now() / 1000 + 86400),
    c.name, c.value].join('\t'));
}
await writeFile('/tmp/sp-cookies.txt', lines.join('\n'), { mode: 0o600 });
console.log('cookies:', cookies.length);
await b.close();
