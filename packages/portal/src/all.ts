import { footer } from './nav.ts';

// /all — every surface inlined on one scrollable page (review mode).
// Server-side fetches each real route and splices its body content into a
// section — no duplicated render logic, always current, one scroll.

const SECTIONS: [string, string][] = [
  ['Home — landing', '/'],
  ['Deck — possibility cards', '/possibilities'],
  ['Rounds — matching + endowment', '/rounds'],
  ['Outcomes', '/outcomes'],
  ['Coordination', '/coordination'],
  ['Portfolio', '/portfolio'],
  ['Governance', '/governance'],
  ['Datasets', '/datasets'],
  ['Streams', '/streams'],
  ['Trust graph', '/trust'],
  ['Tour — judge self-serve', '/tour'],
  ['API docs', '/docs'],
  ['Verify — open-evidence readings', '/verify'],
  ['Metrics (JSON)', '/metrics'],
  ['Ledger verify (JSON)', '/ledger/verify'],
];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Extract a route's styles + body inner HTML, minus its own nav footer —
// keeps each page's table/badge styling inside its section.
function splice(html: string): string {
  const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const inner = body
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  return styles.join('\n') + inner;
}

export async function renderAllPage(
  fetcher: { fetch: typeof fetch }, origin: string,
): Promise<string> {
  const parts = await Promise.all(SECTIONS.map(async ([title, path]) => {
    try {
      const r = await fetcher.fetch(origin + path);
      const ct = r.headers.get('content-type') ?? '';
      if (ct.includes('json')) {
        const pretty = esc(JSON.stringify(await r.json(), null, 2));
        return { title, path, html: `<pre>${pretty}</pre>` };
      }
      return { title, path, html: splice(await r.text()) };
    } catch (e) {
      return { title, path, html: `<p><em>failed to load: ${esc(String(e))}</em></p>` };
    }
  }));
  const toc = parts.map((p, i) => `<a href="#s${i}">${p.title.split(' — ')[0]}</a>`).join(' · ');
  const secs = parts.map((p, i) => `
<section id="s${i}">
<h2>${i + 1}. ${p.title} <small><a href="${p.path}" target="_blank">open ${p.path} ↗</a></small></h2>
<div class="sec-body">${p.html}</div>
</section>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>All surfaces — Springforth</title>
<style>
html,body{overflow-x:hidden}
body{font-family:system-ui,sans-serif;max-width:80rem;margin:1.5rem auto;padding:0 1rem;color:#1a1a1a}
h1{margin-bottom:.2rem}h2{font-size:1rem;margin:2rem 0 .4rem}
section{border-top:2px solid #ddd;padding-top:.5rem}
.sec-body{overflow-x:auto}   /* wide tables scroll inside their section only */
.sec-body pre{white-space:pre-wrap}
small{font-weight:normal;font-size:.8rem}
</style></head><body>
<h1>All surfaces</h1>
<p class="toc">${toc}</p>
${secs}
${footer()}
</body></html>`;
}
