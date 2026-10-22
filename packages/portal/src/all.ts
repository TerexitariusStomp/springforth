import { pageShell } from './theme.ts';

// /all — every surface inlined on one scrollable page (review mode).
// Server-side fetches each real route and splices its body content into a
// section — no duplicated render logic, always current, one scroll.
// Sections render without their own topbar/footer so nothing nests chrome.

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
  ['Trust graph (JSON)', '/trust'],
  ['Tour — judge self-serve', '/tour'],
  ['API docs', '/docs'],
  ['Verify — open-evidence readings', '/verify'],
  ['Metrics (JSON)', '/metrics'],
  ['Ledger verify (JSON)', '/ledger/verify'],
];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Extract a route's styles + body inner HTML, minus its chrome — topbar,
// skip link, main wrapper, footer, scripts. Page-specific <style> blocks
// ride along; the shared SF_CSS is deduped at the page level (the /all
// shell already includes it once).
function splice(html: string): { styles: string[]; inner: string } {
  const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const inner = body
    .replace(/<a class="skip-link"[\s\S]*?<\/a>/gi, '')
    .replace(/<header class="topbar">[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<main[^>]*>/gi, '')
    .replace(/<\/main>/gi, '');
  return { styles, inner };
}

export async function renderAllPage(
  fetcher: { fetch: typeof fetch }, origin: string,
): Promise<string> {
  const seenCss = new Set<string>();
  const parts = await Promise.all(SECTIONS.map(async ([title, path]) => {
    try {
      const r = await fetcher.fetch(origin + path);
      const ct = r.headers.get('content-type') ?? '';
      if (ct.includes('json')) {
        const pretty = esc(JSON.stringify(await r.json(), null, 2));
        return { title, path, html: `<pre>${pretty}</pre>` };
      }
      const { styles, inner } = splice(await r.text());
      // First copy of each unique stylesheet wins — the shared SF_CSS lands
      // once; page-specific extras (deck overlays, tour stops) still ship.
      const fresh = styles.filter((s) => !seenCss.has(s));
      for (const s of fresh) seenCss.add(s);
      return { title, path, html: fresh.join('\n') + inner };
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
  return pageShell({
    title: 'All surfaces — Springforth', htmx: false,
    extraCss: `
html,body{overflow-x:hidden}
.allwrap{max-width:80rem;margin:0 auto;padding:1.5rem 1rem}
.allwrap h1{font-family:var(--sf-serif);font-weight:400;font-size:44px;margin-bottom:.2rem}
.allwrap h2{font-size:15px;margin:2rem 0 .4rem;font-family:var(--sf-sans)}
.allwrap section{border-top:2px solid var(--sf-line);padding-top:.5rem}
.allwrap .toc{font-size:12px;line-height:2}
.sec-body{overflow-x:auto}   /* wide tables scroll inside their section only */
.sec-body pre{white-space:pre-wrap}
.allwrap small{font-weight:normal;font-size:.8rem}`,
  }, `<div class="allwrap">
<h1>All surfaces</h1>
<p class="toc">${toc}</p>
${secs}
</div>`);
}
