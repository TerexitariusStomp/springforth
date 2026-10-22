import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader } from './ui.ts';

// /all — every surface inlined on one scrollable page (review mode).
// Server-side fetches each real route and splices its body content into a
// section — no duplicated render logic, always current, one scroll.
// Sections render without their own topbar/footer so nothing nests chrome.
// Hub URLs are spliced directly so there is no redirect chain; the lang
// choice rides through on the SELF fetch via ?lang=.

const SECTIONS: [string, string][] = [
  ['all.home', '/'],
  ['all.deck', '/possibilities'],
  ['nav.collaborate', '/collaborate'],
  ['nav.fund', '/fund'],
  ['nav.impact', '/impact'],
  ['nav.community', '/community'],
  ['nav.howItWorks', '/how-it-works'],
  ['nav.whitepaper', '/whitepaper'],
  ['nav.apiDocs', '/docs'],
  ['all.trust', '/trust'],
  ['all.metrics', '/metrics'],
  ['all.ledger', '/ledger/verify'],
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
    .replace(/<\/main>/gi, '')
    // Demote spliced page titles — /all keeps a single h1 of its own.
    .replace(/<h1(?=[\s>])/g, '<h2')
    .replace(/<\/h1>/g, '</h2>');
  return { styles, inner };
}

export async function renderAllPage(
  fetcher: { fetch: typeof fetch }, origin: string, lang: Lang = 'en',
): Promise<string> {
  const seenCss = new Set<string>();
  const parts = await Promise.all(SECTIONS.map(async ([titleKey, path]) => {
    const title = t(lang, titleKey);
    try {
      const r = await fetcher.fetch(origin + path + (path.includes('?') ? '&' : '?') + 'lang=' + lang);
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
      return { title, path, html: `<p><em>${esc(t(lang, 'all.failed'))} ${esc(String(e))}</em></p>` };
    }
  }));
  const toc = parts.map((p, i) => `<a href="#s${i}">${esc(p.title.split(' — ')[0])}</a>`).join(' · ');
  const secs = parts.map((p, i) => `
<section id="s${i}">
<h2>${i + 1}. ${esc(p.title)} <small><a href="${p.path}" target="_blank">${esc(t(lang, 'all.open'))} ${p.path} ↗</a></small></h2>
<div class="sec-body">${p.html}</div>
</section>`).join('\n');
  return pageShell({
    title: `${t(lang, 'all.title')} — Springforth`, htmx: false, lang,
    extraCss: `
html,body{overflow-x:hidden}
.allwrap{max-width:80rem;margin:0 auto;padding:1.5rem 1rem}
.allwrap h1{font-family:var(--sf-serif);font-weight:400;font-size:44px;margin-bottom:.2rem}
.allwrap h2{font-size:15px;margin:2rem 0 .4rem;font-family:var(--sf-sans)}
.allwrap section{border-top:2px solid var(--sf-line);padding-top:.5rem}
.allwrap .toc{font-size:12px;line-height:2}
.allwrap .page{padding:1rem 0}
/* spliced hero h1s arrive demoted to h2 — re-apply the hero scale */
.allwrap .hero h2{font-family:var(--sf-serif);font-weight:400;letter-spacing:-2.8px;line-height:.99;font-size:clamp(52px,5.5vw,71px);max-width:43.75rem;margin:0;color:var(--sf-pale)}
.allwrap .hero h2 em{color:var(--sf-coral-2);font-style:italic}
.sec-body{overflow-x:auto}   /* wide tables scroll inside their section only */
.sec-body pre{white-space:pre-wrap}
.allwrap small{font-weight:normal;font-size:.8rem}`,
  }, `<div class="allwrap">
${pageHeader({
    kicker: t(lang, 'all.kicker'),
    title: t(lang, 'all.title'),
    lede: t(lang, 'all.lede'),
    back: { href: '/how-it-works', label: t(lang, 'nav.howItWorks') },
  })}
<p class="toc">${toc}</p>
${secs}
</div>`);
}
