import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader } from './ui.ts';

// Meaning search — hybrid lexical (minisearch) + semantic (stored
// embeddings, cosine). Results link into the focused collaborate view.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SearchHit {
  id: string;
  label: string;
  source: string;
  kind: string;
  score: number;
  via: 'semantic' | 'lexical';
}

export interface SearchPageInput {
  lang: Lang;
  q: string;
  hits: SearchHit[];
}

export const SEARCH_CSS = `
.search-hits{list-style:none;padding:0;margin:1rem 0;display:grid;gap:.5rem}
.search-hits li{border:1px solid var(--sf-line);border-radius:10px;padding:.75rem 1rem;background:var(--sf-card)}
.search-hits a{font-weight:600;text-decoration:none}
.search-hits .muted{display:block;font-size:.8rem;margin-top:.15rem}
.search-badge{font-size:.7rem;padding:.1rem .45rem;border-radius:999px;border:1px solid var(--sf-line-2);color:var(--sf-muted);margin-left:.4rem;vertical-align:middle}
.search-form{display:flex;gap:.5rem;max-width:34rem;margin-top:1rem}
.search-form input{flex:1}
`;

export function renderSearchPage(o: SearchPageInput): string {
  const tt = (k: string) => t(o.lang, k);
  const rows = o.hits.map((h) => `<li>
<a href="/collaborate?node=${encodeURIComponent(h.id)}">${esc(h.label)}</a>
<span class="search-badge">${esc(h.kind)}</span>
<span class="search-badge">${esc(tt(h.via === 'semantic' ? 'search.semantic' : 'search.lexical'))} ${(h.score * 100).toFixed(0)}%</span>
<small class="muted">${esc(h.source)}</small>
</li>`).join('\n');
  return pageShell({
    title: `${tt('search.h1')} — Springforth`, lang: o.lang, htmx: false,
    extraCss: SEARCH_CSS,
  }, `<div class="page">
${pageHeader({
    kicker: tt('search.kicker'),
    title: tt('search.h1'),
    em: tt('search.h1.em'),
    lede: tt('search.lede'),
    back: { href: '/collaborate', label: tt('nav.collaborate') },
  })}
<form class="search-form" method="get" action="/search" role="search">
  <input type="search" name="q" value="${esc(o.q)}" placeholder="${esc(tt('search.placeholder'))}" aria-label="${esc(tt('search.placeholder'))}">
  <button type="submit" class="primary">${esc(tt('search.button'))}</button>
</form>
${o.q ? `<p class="muted">${esc(tt('search.count'))}: ${o.hits.length}</p>` : ''}
${o.hits.length ? `<ul class="search-hits">${rows}</ul>` : (o.q ? `<p class="muted">${esc(tt('search.none'))}</p>` : '')}
</div>`);
}
