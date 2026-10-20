import type { Possibility } from '@springforth/core';
import { effectiveStatus, type PlanNode } from '@springforth/coordination';
import { t, type Lang } from './i18n.ts';

// Landing — first-time-user home: how the platform works up front, then
// "what needs attention" — the triage a newcomer needs to know where to
// start and what to do next.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface LandingCard { possibility: Possibility; participants: number }

export interface LandingInput {
  cards: LandingCard[];             // live possibility cards + headcount
  proposedOverlaps: number;         // machine-flagged, awaiting humans
  unmetNeeds: number;               // no community offer matched yet
  actionNodes: PlanNode[];          // kind='action' nodes across imported plans
  planCount: number;
  lang?: Lang;                      // 'en' default; 'sw' localizes chrome copy
}

export function renderLandingPage(i: LandingInput): string {
  const lang = i.lang ?? 'en';
  const tt = (k: string) => t(lang, k);
  const live = i.cards.filter((c) => ['active', 'draft'].includes(effectiveStatus(c.possibility)));
  const atQuorum = i.cards.filter((c) => effectiveStatus(c.possibility) === 'quorum');
  // Near-quorum: participants over the bar fraction, highest first.
  const near = [...live]
    .filter((c) => c.possibility.minParticipants > 0)
    .sort((x, y) => (y.participants / y.possibility.minParticipants)
      - (x.participants / x.possibility.minParticipants))
    .slice(0, 3);

  const attn: string[] = [];
  if (i.proposedOverlaps) attn.push(
    `<div class="att"><strong>${i.proposedOverlaps} overlap${i.proposedOverlaps === 1 ? '' : 's'} need review</strong><br>
Machine-flagged across imported plans — humans decide.
<a href="/coordination">review evidence →</a></div>`);
  for (const c of near) attn.push(
    `<div class="att"><strong>${esc(c.possibility.title)}</strong><br>
${c.participants}/${c.possibility.minParticipants} committed — ${c.possibility.minParticipants - c.participants} more to activate.
<a href="/possibilities">join this card →</a></div>`);
  if (i.unmetNeeds) attn.push(
    `<div class="att"><strong>${i.unmetNeeds} unmet need${i.unmetNeeds === 1 ? '' : 's'}</strong><br>
Nothing in the commons covers these yet.
<a href="/coordination">see the queue →</a></div>`);
  if (i.actionNodes.length) attn.push(
    `<div class="att"><strong>${i.actionNodes.length} action${i.actionNodes.length === 1 ? '' : 's'} already in motion</strong><br>
Real work from imported plans and field records.
<a href="/outcomes">see who's pursuing what →</a></div>`);

  const cardRows = i.cards.slice(0, 8)
    .map((c) => `<tr><td><a href="/possibilities#${esc(c.possibility.id)}">${esc(c.possibility.title)}</a></td>`
      + `<td><span class="badge">${esc(effectiveStatus(c.possibility))}</span></td>`
      + `<td>${c.participants}${c.possibility.minParticipants ? ` / ${c.possibility.minParticipants}` : ''} committed</td></tr>`)
    .join('\n');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>Springforth — ${tt('tagline')}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;color:#1a1a1a}
.wrap{max-width:62rem;margin:0 auto;padding:0 1.25rem}
.hero{background:#16331f;color:#eaf5ea;padding:3.5rem 0 2.5rem}
.hero h1{font-size:2.4rem;margin:0 0 .6rem}.hero p{max-width:44rem;line-height:1.55}
.hero a{color:#b8e6b8}
.steps{display:flex;gap:1rem;flex-wrap:wrap;margin:1.5rem 0 0}
.step{flex:1;min-width:12rem;background:#ffffff10;border-radius:.5rem;padding:.9rem}
.step b{display:block;margin-bottom:.3rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:1rem;margin:1rem 0}
.att{border:1px solid #ddd;border-left:5px solid #4a7a4a;border-radius:.4rem;padding:.9rem;background:#fbfdfb}
.att a{color:#2d6a2d}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.5rem;text-align:left}
.badge{background:#e6f4ea;padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem}
.muted{color:#555}h2{margin-top:2rem}</style></head><body>
<div class="hero"><div class="wrap">
<h1>Springforth</h1>
<p>${tt('tagline')} ${tt('hero')} — every
decision public on the <a href="/ledger">${tt('nav.ledger')}</a>.</p>
<div class="steps">
<div class="step"><b>1 · ${tt('step.declare')}</b>${tt('step.declare.body')} <a href="/possibilities">${tt('nav.possibilities')}</a></div>
<div class="step"><b>2 · ${tt('step.commit')}</b>${tt('step.commit.body')}</div>
<div class="step"><b>3 · ${tt('step.activate')}</b>${tt('step.activate.body')}</div>
<div class="step"><b>4 · ${tt('step.verify')}</b>${tt('step.verify.body')}</div>
</div></div></div>
<div class="wrap">
<h2>${tt('attention.title')}</h2>
${attn.length ? `<div class="grid">${attn.join('')}</div>`
  : `<p class="muted">${tt('attention.none')}</p>`}
${atQuorum.length ? `<p>${atQuorum.length} card${atQuorum.length === 1 ? '' : 's'} at quorum — commitments binding now.</p>` : ''}
<h2>${tt('cards.title')}</h2>
<p class="muted">${i.cards.length} cards · ${live.length} open · ${atQuorum.length} at quorum · ${i.planCount} plans in the graph · ${i.actionNodes.length} real actions</p>
<table><tr><th>Card</th><th>Status</th><th>Committed</th></tr>
${cardRows || '<tr><td colspan="3"><em>No cards yet — declare one in the deck or Telegram.</em></td></tr>'}</table>
<h2>${tt('explore.title')}</h2>
<p><a href="/portfolio">${tt('nav.portfolio')}</a> ·
<a href="/outcomes">${tt('nav.outcomes')}</a> ·
<a href="/coordination">${tt('nav.coordination')}</a> ·
<a href="/commitments">${tt('nav.commitments')}</a> ·
<a href="/verify">${tt('nav.verify')}</a></p>
<p class="muted"><a href="?lang=en">English</a> · <a href="?lang=sw">Kiswahili</a></p>
<footer><small>Springforth — generated ${new Date().toISOString()} ·
<a href="/ledger">${tt('nav.ledger')}</a></small></footer>
</div></body></html>`;
}
