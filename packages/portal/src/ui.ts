// Shared UI kit for the hub pages — server-rendered helpers that emit
// semantic, token-driven markup. Everything here degrades without JS:
// sections are native <details>, the subnav is plain anchors, the pager
// is links. hubScript only polishes state on top of that.
import { t, type Lang } from './i18n.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── page header ────────────────────────────────────────────────── */
export const pageHeader = (o: {
  kicker: string;
  title: string;
  em?: string;
  lede?: string;
  back?: { href: string; label: string };
}): string => `
<header class="page-head">
  ${o.back ? `<a class="back-link" href="${esc(o.back.href)}">\u2190 ${esc(o.back.label)}</a>` : ''}
  <p class="kicker">${esc(o.kicker)}</p>
  <h1 class="hs-title">${esc(o.title)}${o.em ? ` <em>${esc(o.em)}</em>` : ''}</h1>
  ${o.lede ? `<p class="lede">${esc(o.lede)}</p>` : ''}
</header>`;

/* ── sticky in-page subnav ──────────────────────────────────────── */
export const hubNav = (items: Array<{ href: string; label: string }>, lang: Lang = 'en'): string =>
  `<nav class="hub-nav" role="navigation" aria-label="${esc(t(lang, 'a11y.sectionNav'))}">` +
  items.map(i => `<a href="${esc(i.href)}">${esc(i.label)}</a>`).join('') +
  '</nav>';

/* ── collapsible hub section (desktop: plain h2, mobile: details) ── */
export const hubSection = (o: {
  id: string;
  kicker: string;
  title: string;
  count?: number;
  lede?: string;
  body: string;
  index: number;
}): string => `
<details class="hub-sec" id="${esc(o.id)}" open data-hub-index="${o.index}">
  <summary>
    <div class="hs-head">
      <span class="hs-kick">${esc(o.kicker)}</span>
      <h2 class="hs-title">${esc(o.title)}${o.count != null
        ? ` <span class="hs-count">\u00b7 ${o.count}</span>` : ''}</h2>
    </div>
    <svg class="hs-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </summary>
  <div class="hs-body">
    ${o.lede ? `<p class="lede">${esc(o.lede)}</p>` : ''}
    ${o.body}
  </div>
</details>`;

/* ── "how this works" note — bordered note, not a Pico accordion ── */
export const howItWorks = (lang: Lang, key: string, whitepaperAnchor: string): string =>
  `<details class="how-note"><summary>${esc(t(lang, 'how.label'))}<span class="hn-mark" aria-hidden="true"></span></summary>` +
  `<div class="hn-body">${esc(t(lang, key))} ` +
  `<a href="/whitepaper#${esc(whitepaperAnchor)}">${esc(t(lang, 'how.more'))}</a></div></details>`;

/* ── stat grid — CSS lives in SF_CSS ────────────────────────────── */
export const statGrid = (items: Array<{ v: string; l: string }>): string =>
  `<div class="stat-grid">` +
  items.map(i => `<div class="stat"><b>${esc(i.v)}</b><span>${esc(i.l)}</span></div>`).join('') +
  '</div>';

export const emptyState = (text: string): string =>
  `<p class="muted">${esc(text)}</p>`;

/* ── pager ──────────────────────────────────────────────────────── */
export const pager = (o: { page: number; hasMore: boolean; basePath: string }, lang: Lang = 'en'): string => {
  const sep = o.basePath.includes('?') ? '&' : '?';
  return `<nav class="pager" aria-label="${esc(t(lang, 'a11y.pagination'))}">` +
    (o.page > 1
      ? `<a href="${esc(o.basePath)}${sep}page=${o.page - 1}">\u2190 ${esc(t(lang, 'pager.newer'))}</a>`
      : '') +
    `<span aria-current="page">${esc(t(lang, 'pager.page'))} ${o.page}</span>` +
    (o.hasMore
      ? `<a href="${esc(o.basePath)}${sep}page=${o.page + 1}">${esc(t(lang, 'pager.older'))} \u2192</a>`
      : '') +
    '</nav>';
};

/* ── humanize raw actor ids ─────────────────────────────────────── */
// displayNameText is the plain-text form — for page titles and
// aria-labels where markup would leak. displayName wraps it in a
// span carrying the raw id on hover.
export const displayNameText = (id: string): string => {
  let label = id;
  if (id.startsWith('tg:')) label = `@${id.slice(3)}`;
  else if (/^0x[0-9a-fA-F]{40}$/.test(id)) label = `${id.slice(0, 6)}\u2026${id.slice(-4)}`;
  else if (id.startsWith('demo-')) label = id.slice(5);
  if (!id.startsWith('tg:') && !/^0x[0-9a-fA-F]{40}$/.test(id)) {
    label = label
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  return label;
};
export const displayName = (id: string): string =>
  `<span title="${esc(id)}">${esc(displayNameText(id))}</span>`;

/* ── one small inline script per hub page (<1KB) ──────────────────
   1. mobile: collapse hub sections beyond the first three (native
      <details> still toggles — JS just sets initial state)
   2. open the section targeted by the URL hash (load + hashchange)
   3. IntersectionObserver keeps aria-current on the active subnav link */
export const hubScript = `<script>try{
var secs=document.querySelectorAll('.hub-sec'),links=document.querySelectorAll('.hub-nav a');
function openHash(){var id=location.hash.slice(1);if(!id)return;secs.forEach(function(s){if(s.id===id)s.open=true})}
if(matchMedia('(max-width:700px)').matches)secs.forEach(function(s){if(+s.dataset.hubIndex>=3)s.open=false});
openHash();addEventListener('hashchange',openHash);
if('IntersectionObserver' in window&&links.length){
var map={};links.forEach(function(a){map[a.hash.slice(1)]=a});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var a=map[e.target.id];if(!a)return;links.forEach(function(x){x.removeAttribute('aria-current')});a.setAttribute('aria-current','true')})},{rootMargin:'-20% 0px -70% 0px'});
secs.forEach(function(s){if(map[s.id])io.observe(s)})}
}catch(e){}</script>`;
