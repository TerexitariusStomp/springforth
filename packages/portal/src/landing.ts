import type { Possibility } from '@springforth/core';
import { effectiveStatus, type PlanNode } from '@springforth/coordination';
import { t, type Lang } from './i18n.ts';
import { pageShell } from './theme.ts';

// Landing — Figma structure, live data only. Nothing here is a placeholder:
// the orbit card is the real nearest-to-quorum card, the ticker is real
// ledger events, and the impact panel is real participation/hours/quorum
// counts computed by the edge handler.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface LandingCard { possibility: Possibility; participants: number }

export interface LandingInput {
  cards: LandingCard[];             // live possibility cards + headcount
  proposedOverlaps: number;         // machine-flagged, awaiting humans
  unmetNeeds: number;               // no community offer matched yet
  actionNodes: PlanNode[];          // kind='action' nodes across imported plans
  planCount: number;
  ticker: string[];                 // recent ledger events, humanized
  participantsTotal: number;        // distinct actors across participations
  placesCount: number;              // distinct places across cards
  hoursTotal: number;               // declared hours pledged
  completedCount: number;           // cards marked complete
  quorumRate: number;               // % of cards that reached quorum
  lang?: Lang;                      // 'en' default; 'sw' localizes chrome copy
}

// Minimal shape of a ledger row — only what the ticker needs.
export interface TickerEvent {
  seq: number; at: string; actor: string; kind: string;
  payload: Record<string, unknown>;
}

// Humanize a curated slice of the ledger into ticker lines. Defensive —
// payloads vary by event kind; anything unrecognized is skipped.
export function tickerLines(
  events: TickerEvent[],
  possById: Map<string, Possibility>,
  take = 8,
): string[] {
  const title = (id: unknown) => {
    const p = possById.get(String(id ?? ''));
    return p ? `“${p.title}”` : 'a card';
  };
  const out: string[] = [];
  for (const e of [...events].reverse()) {
    if (out.length >= take) break;
    const p = e.payload ?? {};
    let line: string | null = null;
    switch (e.kind) {
      case 'possibility.declared': {
        const pos = possById.get(String(p.id ?? ''));
        line = `${title(p.id)} declared${pos?.place ? ` in ${pos.place}` : ''}`;
        break;
      }
      case 'possibility.quorum':
        line = `${title(p.id)} reached quorum — coordination activating`;
        break;
      case 'possibility.joined':
        line = `${e.actor} joined ${title(p.id)}`;
        break;
      case 'possibility.completed':
        line = `${title(p.id)} marked complete`;
        break;
      case 'possibility.appreciated':
        line = `${e.actor} appreciated ${p.to ?? 'a collaborator'}`;
        break;
      case 'donation.recorded':
        line = `${p.amount ?? ''} ${p.currency ?? ''} committed to a round`.trim();
        break;
      case 'pledge.pending':
        line = `${p.amount ?? ''} ${p.currency ?? ''} pledged to ${title(p.possibilityId)}`.trim();
        break;
      case 'round.opened':
        line = 'funding round opened';
        break;
    }
    if (line) out.push(line);
  }
  return out;
}

export const tickerHtml = (lines: string[]): string =>
  lines.length
    ? lines.map((l) => `<span><b></b>${esc(l)}</span>`).join('')
    : '<span><b></b>The ledger is quiet — declare a possibility to start.</span>';

const daysLeft = (deadline?: string): string => {
  if (!deadline) return '—';
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return d < 0 ? 'overdue' : `${d}d`;
};

const toneFor = (status: string, pct: number): string =>
  status === 'quorum' ? 'blue'
    : status === 'completed' ? 'coral'
      : status === 'expired' ? 'muted'
        : pct >= 80 ? 'gold' : '';

// Shared deck-card markup — used on the landing preview and /possibilities.
export function deckCard(
  c: LandingCard,
  opts: { needs?: string[]; base?: string } = {},
): string {
  const p = c.possibility;
  const status = effectiveStatus(p);
  const min = p.minParticipants || 0;
  const pct = min ? Math.min(100, Math.round((c.participants / min) * 100)) : 0;
  const more = Math.max(0, min - c.participants);
  const base = opts.base ?? '/possibilities';
  const needs = opts.needs?.slice(0, 3) ?? [];
  return `<article class="possibility-card${toneFor(status, pct) ? ` ${toneFor(status, pct)}` : ''}" data-status="${esc(status)}" data-search="${esc(`${p.title} ${p.place ?? ''}`.toLowerCase())}">
<div class="card-top"><span class="category">${esc(status)}</span>
<span class="card-status"><i></i>${pct}% to quorum</span></div>
<h3><a href="${base}#${esc(p.id)}" style="color:inherit;text-decoration:none">${esc(p.title)}</a></h3>
<p class="location">${esc(p.place ?? 'anywhere')}</p>
<div class="card-metric"><div><strong>${c.participants}</strong><span>committed</span></div>
<div><strong>${min || '—'}</strong><span>goal</span></div>
<div><strong>${daysLeft(p.deadline)}</strong><span>left</span></div></div>
<div class="card-progress"><span style="width:${pct}%"></span></div>
${needs.length ? `<p class="needs"><span>Needs</span>${needs.map((n) => `<b>${esc(n)}</b>`).join('')}</p>` : ''}
<a class="join-button" href="${base}#${esc(p.id)}"><span>${more > 0 ? `${more} more to activate` : status === 'quorum' ? 'At quorum' : 'See the card'}</span><span>→</span></a>
</article>`;
}

export function renderLandingPage(i: LandingInput): string {
  const lang = i.lang ?? 'en';
  const tt = (k: string) => t(lang, k);
  const live = i.cards.filter((c) => ['active', 'draft'].includes(effectiveStatus(c.possibility)));
  const atQuorum = i.cards.filter((c) => effectiveStatus(c.possibility) === 'quorum');
  const near = [...live]
    .filter((c) => c.possibility.minParticipants > 0)
    .sort((x, y) => (y.participants / y.possibility.minParticipants)
      - (x.participants / x.possibility.minParticipants));
  const orbit = near[0];
  const featured = [...live, ...atQuorum].slice(0, 4);

  const attn: string[] = [];
  if (i.proposedOverlaps) attn.push(
    `<div class="att"><strong>${i.proposedOverlaps} overlap${i.proposedOverlaps === 1 ? '' : 's'} need review</strong><br>
Machine-flagged across imported plans — humans decide.
<a href="/coordination">review evidence →</a></div>`);
  for (const c of near.slice(0, 3)) attn.push(
    `<div class="att"><strong>${esc(c.possibility.title)}</strong><br>
${c.participants}/${c.possibility.minParticipants} committed — ${c.possibility.minParticipants - c.participants} more to activate.
<a href="/possibilities#${esc(c.possibility.id)}">join this card →</a></div>`);
  if (i.unmetNeeds) attn.push(
    `<div class="att"><strong>${i.unmetNeeds} unmet need${i.unmetNeeds === 1 ? '' : 's'}</strong><br>
Nothing in the commons covers these yet.
<a href="/coordination">see the queue →</a></div>`);
  if (i.actionNodes.length) attn.push(
    `<div class="att"><strong>${i.actionNodes.length} action${i.actionNodes.length === 1 ? '' : 's'} already in motion</strong><br>
Real work from imported plans and field records.
<a href="/outcomes">see who's pursuing what →</a></div>`);

  const pct = orbit?.possibility.minParticipants
    ? Math.min(100, Math.round((orbit.participants / orbit.possibility.minParticipants) * 100)) : 0;

  const body = `
<section class="hero">
  <div class="hero-glow glow-one"></div><div class="hero-glow glow-two"></div>
  <p class="eyebrow"><span class="live-dot"></span>${tt('eyebrow')}</p>
  <h1>${tt('hero.h1.pre')} <em>${tt('hero.h1.em')}</em></h1>
  <p class="hero-copy">${tt('hero.copy')}</p>
  <div class="hero-actions">
    <a class="primary-button" href="/possibilities">${tt('hero.cta.deck')} →</a>
    <a class="secondary-button" href="#how">${tt('hero.cta.how')}</a>
  </div>
  <div class="trust-line">
    <div class="avatar-stack"><span>S</span><span>T</span><span>K</span><span>+</span></div>
    <p><strong>${i.participantsTotal}</strong> ${tt('hero.trust')} <strong>${i.placesCount}</strong> ${tt('hero.trust.places')}</p>
  </div>
  ${orbit ? `<aside class="orbit-card">
    <div class="orbit-topline"><span>NEAREST TO QUORUM</span>
      <span class="status-pill"><span></span>BUILDING</span></div>
    <h3>${esc(orbit.possibility.title)}</h3>
    <p>${esc(orbit.possibility.place ?? 'anywhere')} · ${tt('hero.orbit.closes')} ${esc(daysLeft(orbit.possibility.deadline))}</p>
    <div class="progress-label"><strong>${orbit.participants} in</strong>
      <span>${Math.max(0, orbit.possibility.minParticipants - orbit.participants)} ${tt('hero.orbit.more')}</span></div>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="orbit-footer"><span class="mini-avatars"><i></i><i></i><i></i></span>
      <a href="/possibilities#${esc(orbit.possibility.id)}">${tt('hero.orbit.join')} →</a></div>
  </aside>` : ''}
  <a class="float-badge badge-one" href="/outcomes">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:#699556"><path d="M20 6L9 17l-5-5"/></svg>
    <span><strong>${i.completedCount}</strong>${tt('hero.badge.actions')}</span></a>
  <a class="float-badge badge-two" href="/possibilities">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="color:#699556"><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg>
    <span><strong>${i.cards.length}</strong>${tt('hero.badge.open')}</span></a>
</section>

<div class="ticker" role="status" aria-label="Live activity">
  <span class="ticker-label">${tt('ticker.label')}</span>
  <div class="ticker-track" id="ticker-track"
    hx-get="/partials/ticker" hx-trigger="every 30s" hx-swap="innerHTML">
    ${tickerHtml(i.ticker)}
  </div>
</div>

${attn.length ? `<section class="attention"><h2>${tt('attention.title')}</h2>${attn.join('')}</section>` : ''}

<section class="section possibilities" id="deck">
  <div class="section-heading">
    <div><span class="kicker">${tt('deck.kicker')}</span>
      <h2>${tt('deck.h2')} <em>${tt('deck.h2.em')}</em></h2></div>
    <p>${tt('deck.copy')}</p>
  </div>
  <div class="deck-controls">
    <nav class="filters" aria-label="Filter cards">
      <a class="active" href="/possibilities">${tt('deck.all')}</a>
      <a href="/possibilities?status=active">${tt('deck.building')}</a>
      <a href="/possibilities?status=quorum">${tt('deck.quorum')}</a>
      <a href="/possibilities?status=completed">${tt('deck.completed')}</a>
    </nav>
    <a class="muted" href="/possibilities" style="text-decoration:none">${i.cards.length} cards · ${live.length} open · ${atQuorum.length} at quorum →</a>
  </div>
  <div class="card-grid">
    ${featured.map((c) => deckCard(c)).join('') ||
    `<div class="empty-state">${tt('attention.none')}</div>`}
  </div>
</section>

<section class="section how" id="how">
  <div class="how-intro">
    <span class="kicker light">${tt('how.kicker')}</span>
    <h2>${tt('how.h2')} <em>${tt('how.h2.em')}</em></h2>
    <p>${tt('how.copy')}</p>
    <a href="/docs">${tt('how.api')} →</a>
  </div>
  <div class="steps">
    <div class="step"><span>01</span><div><h3>${tt('step.declare')}</h3><p>${tt('step.declare.body')}</p></div></div>
    <div class="step"><span>02</span><div><h3>${tt('step.commit')}</h3><p>${tt('step.commit.body')}</p></div></div>
    <div class="step"><span>03</span><div><h3>${tt('step.activate')}</h3><p>${tt('step.activate.body')}</p></div></div>
    <div class="step"><span>04</span><div><h3>${tt('step.verify')}</h3><p>${tt('step.verify.body')}</p></div></div>
  </div>
</section>

<section class="section impact" id="impact">
  <div class="impact-copy">
    <span class="kicker">${tt('impact.kicker')}</span>
    <h2>${tt('impact.h2')} <em>${tt('impact.h2.em')}</em></h2>
    <p>${tt('impact.copy')}</p>
    <div class="impact-points">
      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>${tt('impact.point.1')}</span>
      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>${tt('impact.point.2')}</span>
      <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>${tt('impact.point.3')}</span>
    </div>
  </div>
  <aside class="impact-panel">
    <div class="panel-header"><span>${tt('impact.panel')}</span><span class="live-pill">● live</span></div>
    <div class="big-stat"><strong>${i.hoursTotal.toLocaleString()}</strong><span>${tt('impact.hours')}</span></div>
    <div class="panel-stats">
      <div><strong>${i.completedCount}</strong><span>${tt('impact.actions')}</span></div>
      <div><strong>${i.cards.length}</strong><span>${tt('impact.cards')}</span></div>
      <div><strong>${i.quorumRate}%</strong><span>${tt('impact.quorum')}</span></div>
    </div>
  </aside>
</section>

<section class="section cta">
  <div class="cta-mark">${'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v5m0 10v5M2 12h5m10 0h5M5.6 5.6l3.2 3.2m6.4 6.4l3.2 3.2M5.6 18.4l3.2-3.2m6.4-6.4l3.2-3.2"/></svg>'}</div>
  <span class="kicker">${tt('cta.kicker')}</span>
  <h2>${tt('cta.h2.pre')} <em>${tt('cta.h2.em')}</em></h2>
  <p>${tt('cta.copy')}</p>
  <a class="lime-button" href="/possibilities#declare">${tt('cta.button')} →</a>
</section>`;

  return pageShell({
    title: `Springforth — ${tt('tagline')}`,
    desc: tt('hero.copy'),
    lang,
  }, body);
}
