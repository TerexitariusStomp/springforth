// The Springforth whitepaper — rendered, not PDF'd. Every mechanism
// described here corresponds to a live route or a committed entity; nothing
// is aspirational without being marked as such. All prose lives in the
// wp.* string table (en/sw/fr); those strings intentionally carry inline
// HTML (<em>, <code>, <a>) and are injected unescaped. Anchors s1–s12 are
// structural — hub how-notes deep-link to them.
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader } from './ui.ts';

export function renderWhitepaper(lang: Lang = 'en'): string {
  const w = (k: string) => t(lang, k);   // raw — wp.* strings carry markup
  return pageShell({ title: `${t(lang, 'nav.whitepaper')} — Springforth`, htmx: false, lang,
    extraCss: `.paper{max-width:52rem;margin:0 auto}
.paper h2{margin-top:3rem}
.paper h2 .no{color:var(--sf-coral-a11y);font-family:var(--sf-sans);font-size:.55em;
  font-weight:700;letter-spacing:.12em;display:block;margin-bottom:.3rem}
.paper h3{margin-top:1.8rem}
.paper .toc{columns:2;column-gap:2.5rem;padding-left:1.2rem}
.paper .toc li{break-inside:avoid;margin:.2rem 0}
.paper table{width:100%;font-size:.9rem}
.paper code{font-size:.85em}
.paper .abstract{border-left:3px solid var(--sf-lime);padding:.4rem 0 .4rem 1.2rem;
  font-size:1.05rem}
@media(max-width:43.75rem){.paper .toc{columns:1}}` }, `<div class="page">
${pageHeader({
    kicker: t(lang, 'wp.kicker'),
    title: 'Springforth',
    lede: w('wp.lede'),
    back: { href: '/how-it-works', label: t(lang, 'nav.howItWorks') },
  })}
<article class="paper">

<div class="abstract">${w('wp.abstract')}</div>

<h2>${w('wp.toc')}</h2>
<ol class="toc">
<li><a href="#s1">${w('wp.toc.1')}</a></li>
<li><a href="#s2">${w('wp.toc.2')}</a></li>
<li><a href="#s3">${w('wp.toc.3')}</a></li>
<li><a href="#s4">${w('wp.toc.4')}</a></li>
<li><a href="#s5">${w('wp.toc.5')}</a></li>
<li><a href="#s6">${w('wp.toc.6')}</a></li>
<li><a href="#s7">${w('wp.toc.7')}</a></li>
<li><a href="#s8">${w('wp.toc.8')}</a></li>
<li><a href="#s9">${w('wp.toc.9')}</a></li>
<li><a href="#s10">${w('wp.toc.10')}</a></li>
<li><a href="#s11">${w('wp.toc.11')}</a></li>
<li><a href="#s12">${w('wp.toc.12')}</a></li>
</ol>

<h2 id="s1"><span class="no">01</span>${w('wp.s1.h')}</h2>
<p>${w('wp.s1.p1')}</p>
<p>${w('wp.s1.p2')}</p>
<p>${w('wp.s1.p3')}</p>

<h2 id="s2"><span class="no">02</span>${w('wp.s2.h')}</h2>
<p>${w('wp.s2.p1')}</p>
<p>${w('wp.s2.p2')}</p>
<p>${w('wp.s2.p3')}</p>
${w('wp.s2.table')}
<p>${w('wp.s2.p4')}</p>
<p>${w('wp.s2.p5')}</p>

<h2 id="s3"><span class="no">03</span>${w('wp.s3.h')}</h2>
<p>${w('wp.s3.p1')}</p>
<p>${w('wp.s3.p2')}</p>
<p>${w('wp.s3.p3')}</p>

<h2 id="s4"><span class="no">04</span>${w('wp.s4.h')}</h2>
<p>${w('wp.s4.p1')}</p>
<p>${w('wp.s4.p2')}</p>
<p>${w('wp.s4.p3')}</p>

<h2 id="s5"><span class="no">05</span>${w('wp.s5.h')}</h2>
<p>${w('wp.s5.intro')}</p>
<h3>5.1 ${w('wp.s5.sub1.h')}</h3>
<p>${w('wp.s5.sub1.p')}</p>
<h3>5.2 ${w('wp.s5.sub2.h')}</h3>
<p>${w('wp.s5.sub2.p')}</p>
<h3>5.3 ${w('wp.s5.sub3.h')}</h3>
<p>${w('wp.s5.sub3.p')}</p>
<h3>5.4 ${w('wp.s5.sub4.h')}</h3>
<p>${w('wp.s5.sub4.p')}</p>
<p>${w('wp.s5.live')}</p>

<h2 id="s6"><span class="no">06</span>${w('wp.s6.h')}</h2>
<p>${w('wp.s6.p1')}</p>
<p>${w('wp.s6.p2')}</p>
<p>${w('wp.s6.p3')}</p>

<h2 id="s7"><span class="no">07</span>${w('wp.s7.h')}</h2>
<p>${w('wp.s7.p1')}</p>
${w('wp.s7.table')}
<p>${w('wp.s7.p2')}</p>

<h2 id="s8"><span class="no">08</span>${w('wp.s8.h')}</h2>
<p>${w('wp.s8.p1')}</p>

<h2 id="s9"><span class="no">09</span>${w('wp.s9.h')}</h2>
${w('wp.s9.table')}
<p>${w('wp.s9.p1')}</p>

<h2 id="s10"><span class="no">10</span>${w('wp.s10.h')}</h2>
<p>${w('wp.s10.p1')}</p>
<p>${w('wp.s10.p2')}</p>
<p>${w('wp.s10.p3')}</p>

<h2 id="s11"><span class="no">11</span>${w('wp.s11.h')}</h2>
${w('wp.s11.list')}

<h2 id="s12"><span class="no">12</span>${w('wp.s12.h')}</h2>
${w('wp.s12.table')}
<p class="muted">${w('wp.s12.end')}</p>
</article>
</div>`);
}
