// /how-it-works — the seven-stop walkthrough. Replaces the retired
// tour page: neutral copy, real routes, each stop points at the hub or
// deep page where that step happens.
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, hubScript } from './ui.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Each stop: title/do/look keys + where it sends you.
const STOPS: { n: number; href: string; label: string }[] = [
  { n: 1, href: '/possibilities', label: 'nav.possibilities' },
  { n: 2, href: '/collaborate#commons', label: 'nav.collaborate' },
  { n: 3, href: '/collaborate#overlaps', label: 'nav.collaborate' },
  { n: 4, href: '/fund', label: 'nav.fund' },
  { n: 5, href: '/impact', label: 'nav.impact' },
  { n: 6, href: '/community#trust', label: 'nav.community' },
  { n: 7, href: '/community', label: 'nav.community' },
];

export function renderHowItWorksPage(lang: Lang): string {
  const stops = STOPS.map((s) => `<div class="card">
<p><span class="kicker">${s.n}</span></p>
<h3>${esc(t(lang, `howto.stop.${s.n}.title`))}</h3>
<p><strong>${esc(t(lang, 'howto.do'))}:</strong> ${esc(t(lang, `howto.stop.${s.n}.do`))}</p>
<p class="muted"><strong>${esc(t(lang, 'howto.look'))}:</strong> ${esc(t(lang, `howto.stop.${s.n}.look`))}</p>
<p><a href="${s.href}">${esc(t(lang, s.label))} →</a></p>
</div>`).join('\n');

  const body = `<div class="page hub-head">${pageHeader({
    kicker: t(lang, 'howto.kicker'),
    title: t(lang, 'howto.h1'),
    em: t(lang, 'howto.h1.em'),
    lede: t(lang, 'howto.lede'),
  })}</div>
<div class="page hub-body">
${stops}
<p class="muted" style="margin-top:2rem">${esc(t(lang, 'howto.more'))}
<a href="/possibilities">${esc(t(lang, 'nav.possibilities'))} →</a></p>
<p class="muted"><a href="/whitepaper">${esc(t(lang, 'nav.whitepaper'))}</a> ·
<a href="/docs">${esc(t(lang, 'nav.apiDocs'))}</a></p>
</div>${hubScript}`;

  return pageShell({ title: `${t(lang, 'nav.howItWorks')} — Springforth`,
    htmx: false, lang }, body);
}
