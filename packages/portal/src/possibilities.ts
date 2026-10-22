import type { PlanNode, TrustEdge } from '@springforth/coordination';
import type { PossibilityStatus, Valuation } from '@springforth/core';
import { deckCard } from './landing.ts';
import { pageShell } from './theme.ts';
import type { Lang } from './i18n.ts';

// /possibilities — the card deck. Compact Figma cards in a filterable grid;
// each card opens a full detail overlay (pure CSS :target — no JS needed)
// carrying needs, bringing, participants, forms, and the value block.
// #declare is a real form posting to POST /possibilities.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface PossibilityCard {
  id: string; title: string; description: string; declarerId: string;
  place?: string; timeStart?: string; timeEnd?: string; deadline?: string;
  minParticipants: number; maxParticipants?: number;
  status: PossibilityStatus;
  score: number; tipping?: boolean;
  scoring: { score: number; trust: number; urgency: number; cover: number };
  participantCount: number;
  // Identity gradation — undefined until critical mass (cover ≥ 0.5 or
  // quorum reached). Counts are always public; names reveal late.
  participants?: { actor: string; bringingNodeId?: string }[];
  needs: (PlanNode & { met: boolean })[];
  bringing: PlanNode[];
  quorum: { met: boolean; required: number; requiredMet: number };
  report?: { summary: string; evidence: string; learnings: string; at: string };
  context?: { datasets?: { name: string; value: string; source: string; fetchedAt: string }[] };
  // Derived monetary valuation (ledger + declared + cited-benchmark inputs,
  // per currency) — see docs/hackathon/VALUATION.md for the methodology.
  value?: Valuation;
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 })
    .format(amount);

// "Coordinated value (est.)" — derived at render from ledger donations/match,
// participant-declared hours and offer budgets, and cited benchmark rates.
// Per-currency rows, never converted; every component carries its provenance.
function valueBlock(v: Valuation): string {
  const rows = Object.entries(v.byCurrency).filter(([, c]) => c.total > 0 || c.asked > 0 || c.riskAvoided > 0)
    .map(([cur, c]) => {
      const parts: string[] = [];
      if (c.committed > 0) parts.push(`${money(c.committed, cur)} committed`);
      if (c.matched > 0) parts.push(`${money(c.matched, cur)} matched`);
      if (c.inKind > 0) parts.push(`${money(c.inKind, cur)} in-kind (declared)`);
      if (c.volunteerTime > 0) parts.push(`${money(c.volunteerTime, cur)} volunteer time (est.)`);
      if (c.asked > 0) parts.push(`${money(c.asked, cur)} declared cost of open needs`);
      const risk = c.riskAvoided > 0
        ? ` <em>+ est. ${money(c.riskAvoided, cur)} damage risk mitigated` +
          (c.riskPerUnit > 0 ? ` (est. ${money(Math.round(c.riskPerUnit), cur)} per ${money(1, cur)})` : '') +
          `</em>` : '';
      const lev = c.leverage > 0 ? ` <small>(×${c.leverage} mobilization)</small>` : '';
      return `<li>${esc(cur)} <strong>${money(c.total, cur)}</strong>${lev} — ${parts.join(' · ')}${risk}</li>`;
    }).join('');
  if (!rows && !(v.hoursTotal > 0)) return '';
  return `<p class="meta"><strong>Coordinated value (est.)</strong> —
environmental units in money, for treasurers:
<ul class="needs">${rows}</ul>
${v.method.length ? `<small>${v.method.map(esc).join(' · ')}</small>` : ''}
<small><a href="https://github.com/TerexitariusStomp/springforth/blob/main/docs/hackathon/VALUATION.md">methodology</a></small></p>`;
}

function countdown(deadline: string | undefined): string {
  if (!deadline) return 'open-ended';
  const d = Math.ceil((Date.parse(deadline) - Date.now()) / 86_400_000);
  return d < 0 ? 'deadline passed' : d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} left`;
}

// Full card detail — lives inside the :target overlay panel.
function cardDetail(c: PossibilityCard): string {
  const live = c.status === 'active' || c.status === 'draft';
  const cover = c.scoring.cover;
  const needRows = c.needs.map((n) => `<li>
    ${n.met ? '&#10003;' : '&#8226;'} ${esc(n.label)}
    ${n.category ? `<span class="nice">[${esc(n.category)}]</span>` : ''}
    ${n.required ? '<span class="req">required</span>' : '<span class="nice">nice-to-have</span>'}
    ${n.flaggedBy ? `<span class="nice">flagged by ${esc(n.flaggedBy)}</span>` : ''}
    ${n.met ? '<span class="met">met</span>' : ''}</li>`).join('');
  const bringing = c.bringing.map((n) => `<li>${esc(n.label)} — ${esc(n.orgIds[0] ?? '')}</li>`).join('');
  const joined = (c.participants ?? []).map((x) => `<li>${esc(x.actor)}${x.bringingNodeId ? ' + bringing' : ''}</li>`).join('');
  const partCap = c.maxParticipants ? `/${c.maxParticipants} cap` : '';
  return `<div class="card-overlay" id="${esc(c.id)}">
<div class="detail-panel" role="dialog" aria-modal="true" aria-label="${esc(c.title)}">
<a class="modal-close" href="#deck" aria-label="Close">✕</a>
<h3>&#8220;${esc(c.title)}&#8221;</h3>
<p><span class="badge lime">${esc(c.status)}</span>
${c.tipping ? '<span class="badge gold">tipping — 30% reached, momentum building</span>' : ''}
<span class="badge">${esc(countdown(c.deadline))}</span>
<span class="badge">${c.participantCount}/${c.minParticipants} in${partCap}</span>
<span class="badge">needs ${c.quorum.requiredMet}/${c.quorum.required}</span>
<span class="badge">score ${c.score.toFixed(2)}</span></p>
<div class="bar"><div class="fill" style="width:${Math.round(cover * 100)}%"></div></div>
<p class="meta">needs:resources cover ${(cover * 100).toFixed(0)}% ·
trust ${c.scoring.trust.toFixed(2)} · urgency ${c.scoring.urgency.toFixed(2)}</p>
${c.value ? valueBlock(c.value) : ''}
<p>Declared by <strong>${esc(c.declarerId)}</strong>${c.place ? ` · ${esc(c.place)}` : ''}
${c.timeStart ? ` · ${esc(c.timeStart.slice(0, 10))}${c.timeEnd ? ` → ${esc(c.timeEnd.slice(0, 10))}` : ''}` : ''}
· <a href="/possibilities/${esc(c.id)}/ics">add to calendar (.ics)</a></p>
${c.description ? `<p>${esc(c.description)}</p>` : ''}
${c.context?.datasets?.length ? `<p class="ctx"><strong>Verified context</strong></p><ul class="needs">${c.context.datasets.map((d) => `<li>&#9670; ${esc(d.name)}: ${esc(d.value)}${d.source ? ` <span class="nice">(${esc(d.source)})</span>` : ''}</li>`).join('')}</ul>` : ''}
${needRows ? `<p><strong>Needs</strong></p><ul class="needs">${needRows}</ul>` : ''}
${bringing ? `<p><strong>Being brought</strong></p><ul class="needs">${bringing}</ul>` : ''}
${c.participants === undefined
  ? `<p><strong>In:</strong> ${c.participantCount} — <em>names reveal as quorum nears</em></p>`
  : joined ? `<p><strong>In (${c.participantCount})</strong></p><ul class="needs">${joined}</ul>` : ''}
${live ? `<form method="post" action="/possibilities/${esc(c.id)}/join" class="val">
  <input name="actor" placeholder="your name" required>
  <input name="bringing" placeholder="what you'll bring (optional)">
  <input name="hours" type="number" min="0" step="0.5" placeholder="hours (optional)" style="max-width:7rem">
  <button>I'm coming</button>
</form>
<form method="post" action="/possibilities/${esc(c.id)}/need" class="val">
  <input name="actor" placeholder="your name" required>
  <input name="title" placeholder="a need this card is missing" required>
  <input name="category" placeholder="equipment|venue|skill|person|consumable">
  <button>Flag a need</button>
</form>
<form method="post" action="/possibilities/${esc(c.id)}/pass" class="val">
  <input name="actor" placeholder="your name" required>
  <button>Not for me (logged, private)</button>
</form>` : ''}
${c.status === 'completed' || c.status === 'quorum' ? `<form method="post" action="/possibilities/${esc(c.id)}/appreciate" class="val">
  <input name="from" placeholder="your name" required>
  <input name="to" placeholder="who showed up" required>
  <input name="note" placeholder="brought X and it was clutch">
  <button>Appreciate</button>
</form>` : ''}
${c.report ? `<p class="res"><strong>Report:</strong> ${esc(c.report.summary)}${c.report.learnings ? ` — <em>${esc(c.report.learnings)}</em>` : ''}</p>` : ''}
</div></div>`;
}

const STATUS_FILTERS: Array<[string, string]> = [
  ['', 'All'], ['active', 'Building'], ['quorum', 'At quorum'],
  ['completed', 'Completed'], ['draft', 'Draft'], ['expired', 'Expired'],
];

const DECK_CSS = `
.card-overlay{display:none}
.card-overlay:target{display:grid;position:fixed;inset:0;z-index:50;padding:20px;place-items:center;background:rgba(8,28,20,.7);backdrop-filter:blur(8px)}
.detail-panel{width:min(700px,100%);max-height:88vh;overflow:auto;padding:36px;position:relative;border-radius:18px;background:#f8f9f4;box-shadow:0 30px 100px rgba(0,0,0,.3)}
.detail-panel h3{margin:0 0 12px;font-family:var(--sf-serif);font-weight:400;color:#183a2d;font-size:30px;line-height:1.16}
.detail-panel .needs{list-style:none;padding-left:.25rem;margin:.2rem 0;font-size:13px}
.detail-panel .needs li{padding:.15rem 0}
.val{display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap}
.val input{padding:.5rem .7rem;flex:1;min-width:8rem;border:1px solid var(--sf-line);border-radius:8px;font:inherit;font-size:13px}
.val button{padding:.5rem 1.1rem;cursor:pointer;background:var(--sf-green-3);color:#fff;border:0;border-radius:99px;font-weight:800;font-size:12px}
.res{background:rgba(200,243,109,.25);padding:.6rem .8rem;border-radius:.5rem;font-size:13px}
.req{color:#a33;font-size:.8rem}.nice{color:#888;font-size:.8rem}.met{color:#4a7a4a;font-size:.8rem}
.tip{background:#fde8c8;color:#7a5a00}.meta{font-size:.8rem;color:#777}
.bar{background:#edf0ea;border-radius:99px;height:6px;margin:.5rem 0;overflow:hidden}
.fill{background:var(--sf-lime);height:100%}
.ctx{color:#2f5c67;font-size:13px}
.mutual-panel{max-width:1250px;margin:3rem auto 0;background:#fff;border:1px solid var(--sf-line-2);border-radius:12px;padding:26px}
.mutual-panel h3{font-family:var(--sf-serif);font-weight:400;font-size:24px;margin:0 0 6px}
.mutual-panel ul{list-style:none;padding:0;font-size:13px}
@media(max-width:720px){.detail-panel{padding:26px 18px}}
`;

export function renderPossibilitiesPage(
  cards: PossibilityCard[], edges: TrustEdge[] = [], viewer?: string,
  opts: { status?: string; lang?: Lang } = {},
): string {
  const status = opts.status ?? '';
  const filtered = status ? cards.filter((c) => c.status === status) : cards;
  const grid = filtered.map((c) => deckCard({
    id: c.id, title: c.title, place: c.place,
    status: c.status, participants: c.participantCount,
    min: c.minParticipants || 0, deadline: c.deadline,
    needs: c.needs.filter((n) => !n.met).slice(0, 3).map((n) => n.label),
  }, { base: '' })).join('\n');
  const overlays = cards.map(cardDetail).join('\n');
  const mutual = edges.filter((e) => e.mutual > 0).slice(0, 10)
    .map((e) => `<li>${esc(e.from)} &harr; ${esc(e.to)} — mutual ${e.mutual}</li>`).join('');

  const body = `
<section class="section" id="deck" style="padding-top:60px">
  <div class="section-heading">
    <div><span class="kicker">Possibilities</span>
      <h2>The <em>deck</em></h2></div>
    <p>Every card is a real commitment window. When every required need is met
    and the participant threshold is reached, quorum binds the commitment —
    and appreciation afterward feeds the trust graph.
    ${viewer ? `<br><em>Sorting for ${esc(viewer)}</em>` : ''}</p>
  </div>
  <div class="deck-controls">
    <nav class="filters" aria-label="Filter by status">
      ${STATUS_FILTERS.map(([v, l]) =>
        `<a href="/possibilities${v ? `?status=${v}` : ''}" class="${status === v ? 'active' : ''}"
          ${status === v ? 'aria-pressed="true"' : ''}>${l}</a>`).join('')}
    </nav>
    <label class="search-field">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="deck-search" type="search" placeholder="Search title or place…" aria-label="Search cards">
    </label>
  </div>
  <div class="card-grid" id="card-grid">
    ${grid || `<div class="empty-state">No cards here yet — <a href="#declare">declare one</a>.</div>`}
  </div>
  ${mutual ? `<div class="mutual-panel"><h3>Mutual recognition</h3>
    <p class="muted">Pairwise appreciation made visible — mutual recognition steers which cards surface to whom.</p>
    <ul>${mutual}</ul></div>` : ''}
  <p class="muted" style="max-width:1250px;margin:2rem auto 0">
    <a href="/possibilities?format=json">JSON</a> ·
    <a href="/coordination">coordination</a> · <a href="/commitments">commitments</a> ·
    <a href="/outcomes">outcomes</a> · Cards sort by
    <code>score = 0.5·trust + 0.3·urgency + 0.2·cover</code></p>
</section>

${overlays}

<div class="modal-anchor" id="declare">
  <div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="declare-h">
      <a class="modal-close" href="#deck" aria-label="Close">✕</a>
      <span class="kicker">New card</span>
      <h2 id="declare-h">Declare a possibility</h2>
      <p>"I want to…" — what you'll make happen, where, by when, and how many
      people it takes to activate. Needs and offers come next on the card.</p>
      <form method="post" action="/possibilities">
        <input type="text" name="website" tabindex="-1" autocomplete="off"
          style="position:absolute;left:-9999px" aria-hidden="true">
        <label>Possibility
          <textarea name="title" required placeholder="I want to…"></textarea></label>
        <label>Your name
          <input name="declarerId" required placeholder="who's declaring"></label>
        <div class="modal-row">
          <label>Where <input name="place" placeholder="town, venue, or 'anywhere'"></label>
          <label>Deadline <input name="deadline" type="date"></label>
        </div>
        <div class="modal-row">
          <label>Min participants
            <input name="minParticipants" type="number" min="1" value="3"></label>
          <label>Description <input name="description" placeholder="one line (optional)"></label>
        </div>
        <button class="modal-submit" type="submit">Declare it</button>
      </form>
    </div>
  </div>
</div>

<script>
document.getElementById('deck-search')?.addEventListener('input', (e) => {
  const q = (e.target.value || '').toLowerCase();
  document.querySelectorAll('#card-grid .possibility-card').forEach((el) => {
    el.style.display = !q || (el.dataset.search || '').includes(q) ? '' : 'none';
  });
});
</script>`;

  return pageShell({
    title: 'The deck — Springforth',
    desc: 'Real commitment windows: join a card that is building, or declare the thing only you can start.',
    lang: opts.lang ?? 'en', extraCss: DECK_CSS,
  }, body);
}
