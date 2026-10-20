import { isNeed, triScore, type OverlapRecord, type PlanNode } from '@springforth/coordination';
import type { Signal } from '@springforth/core';
import { footer } from './nav.ts';

// /coordination — public overlap report page. Same constraints as the rest
// of the portal: one self-contained HTML file, no JS framework, no tracker.
// Validation posts use plain HTML forms so community reviewers need nothing
// but a browser.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const KIND_COLOR: Record<string, string> = {
  duplicate: '#f6c344', overlap: '#7fb3e8', complement: '#8fd18f', conflict: '#e88f8f',
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

// Human correction form — per node, plain POST. Fixes are attributed and
// diffed on the ledger; the extraction trail stays visible.
function correctForm(n: PlanNode | undefined, id: string): string {
  return `<details><summary>Correct ${esc(n?.label ?? id)}</summary>
<form method="post" action="/nodes/${esc(id)}/correct" class="val">
  <input name="actor" placeholder="your name" required>
  <input name="label" value="${esc(n?.label ?? '')}" placeholder="label">
  <input name="placeId" value="${esc(n?.placeId ?? '')}" placeholder="place">
  <input name="timeframeFrom" value="${esc(n?.timeframe.from ?? '')}" placeholder="from (YYYY-MM-DD)">
  <input name="timeframeTo" value="${esc(n?.timeframe.to ?? '')}" placeholder="to (YYYY-MM-DD)">
  <input name="budget" value="${n?.budget ?? ''}" placeholder="budget">
  <input name="note" placeholder="why is this correction right?">
  <button>Submit correction</button>
</form></details>`;
}

function card(rec: OverlapRecord, byId: Map<string, PlanNode>, signals: Signal[], maxBudget: number): string {
  // Canopy-style public intent: named actors sign support on either side's
  // node — cheap legibility ("who wants this?") before validation or money.
  const signed = signals.filter((s) =>
    rec.nodeIds.includes(s.targetId) && s.intent === 'support');
  const [a, b] = rec.nodeIds.map((id) => byId.get(id));
  // Complements are directional — nodeIds = [need, offer]; head it that way.
  const heading = rec.kind === 'complement'
    ? `${esc(a?.label ?? rec.nodeIds[0])} <span class="dir">&#8592; met by</span> ${esc(b?.label ?? rec.nodeIds[1])}`
    : `${esc(a?.label ?? rec.nodeIds[0])} &harr; ${esc(b?.label ?? rec.nodeIds[1])}`;
  const evRows = rec.evidence
    .map((e) => `<tr><td>${esc(e.field)}</td><td>${esc(e.a.slice(0, 60))}</td><td>${esc(e.b.slice(0, 60))}</td><td>${e.score.toFixed(2)}</td></tr>`)
    .join('');
  // Counter-signals — fields both sides stated that argue AGAINST the
  // match. Shown beside supporting evidence: reviewers decide with full
  // sight, contradictions are never silently dropped.
  const ce = rec.counterEvidence ?? [];
  const ceRows = ce.map((e) =>
    `<tr class="con"><td>${esc(e.field)}</td><td>${esc(e.a.slice(0, 60))}</td><td>${esc(e.b.slice(0, 60))}</td><td>mismatch</td></tr>`)
    .join('');
  const tri = triScore(rec, byId, maxBudget);
  const votes = rec.validations
    .map((v) => `<li>${esc(v.actor)} — ${v.verdict}${v.note ? ` (${esc(v.note)})` : ''}</li>`)
    .join('');
  const scen = rec.scenario
    ? `<p class="res">Scenario chosen: <strong>${esc(rec.scenario.choice)}</strong> by ${esc(rec.scenario.actor)}${rec.scenario.rationale ? ` — ${esc(rec.scenario.rationale)}` : ''}${rec.scenario.objections ? ` <em>(objections: ${esc(rec.scenario.objections)})</em>` : ''}</p>`
    : '';
  const actions = rec.status === 'proposed' || rec.status === 'confirmed' ? `
  <form method="post" action="/overlaps/${esc(rec.id)}/validate" class="val">
    <input name="actor" placeholder="your name" required>
    <input name="note" placeholder="note (optional)">
    <select name="scenario">
      <option value="">scenario…</option>
      <option value="separate">keep separate</option>
      <option value="coordinate">coordinate delivery</option>
      <option value="combine">combine funding</option>
    </select>
    <input name="rationale" placeholder="rationale (optional)">
    <button name="verdict" value="confirm">Confirm</button>
    <button name="verdict" value="reject">Not the same</button>
  </form>
  ${rec.status === 'confirmed' ? `
  <form method="post" action="/overlaps/${esc(rec.id)}/confirm" class="val">
    <input name="actor" placeholder="your name" required>
    <select name="scenario">
      <option value="coordinate">coordinate delivery</option>
      <option value="combine">combine funding</option>
    </select>
    <input name="rationale" placeholder="rationale (optional)">
    <button>Coordinate: materialise shared action</button>
  </form>` : ''}` : '';
  const res = rec.resolution
    ? `<p class="res">Coordinated — <a href="/overlaps/${esc(rec.id)}/agreement">agreement artifact</a></p>`
    : '';
  // Treegens-sourced nodes carry filmed evidence — link out to it and to
  // the sponsor lane. Deep-link only: settlement stays on their side.
  const tg = [a, b].some((n) => n?.source.startsWith('treegens'))
    ? `<p class="dir">Treegens evidence — <a href="https://world.treegens.app">filmed records + sponsor verified plantings &rarr; world.treegens.app</a></p>`
    : '';
  return `<div class="card" style="border-left:6px solid ${KIND_COLOR[rec.kind] ?? '#ccc'}">
<h3>${heading}</h3>
<p><span class="badge">${esc(rec.kind)}</span> <span class="badge">${esc(rec.status)}</span>
<span class="badge">strength ${pct(tri.strength)}</span>
<span class="badge">materiality ${tri.materiality !== undefined ? pct(tri.materiality) : '—'}</span>
<span class="badge">readiness ${pct(tri.readiness)}</span>
${signed.length ? `<span class="badge">${signed.length} public support${signed.length === 1 ? '' : 's'}</span>` : ''}</p>
<p>${esc(rec.reasoning)}</p>
<details><summary>Evidence (${rec.evidence.length} for${ce.length ? ` · ${ce.length} against` : ''})</summary>
<table><tr><th>Field</th><th>Plan A</th><th>Plan B</th><th>Score</th></tr>${evRows}${ceRows}</table></details>
${votes ? `<ul>${votes}</ul>` : '<p><em>Awaiting community validation.</em></p>'}
${scen}${actions}${res}${tg}
<details><summary>Correct an extracted field</summary>${correctForm(a, rec.nodeIds[0]!)}${correctForm(b, rec.nodeIds[1]!)}</details>
<form method="post" action="/signals" class="val" enctype="application/x-www-form-urlencoded">
  <input name="actor" placeholder="your name" required>
  <input type="hidden" name="targetId" value="${esc(rec.nodeIds[0]!)}">
  <input type="hidden" name="targetKind" value="node">
  <input type="hidden" name="intent" value="support">
  <button>Sign support for ${esc(a?.label ?? 'this need')}</button>
</form>
</div>`;
}

export function renderCoordinationPage(
  recs: OverlapRecord[], nodes: PlanNode[], signals: Signal[] = [],
  focusNode?: string,
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (focusNode) recs = recs.filter((r) => r.nodeIds.includes(focusNode));
  const counts = recs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  // Two relationship directions, one validation flow: overlaps are the
  // same work stated twice (merge); complements are a need met by an
  // offer (procure). CLC commitments land in the second section.
  const maxBudget = Math.max(1, ...nodes.map((n) => n.budget ?? 0));
  const complements = recs.filter((r) => r.kind === 'complement');
  // Reviewer queue: actionable records first, strongest candidates top —
  // at real-world scale the pairs most worth a human decision surface.
  const RANK: Record<string, number> = { confirmed: 0, proposed: 1, coordinated: 2, rejected: 3 };
  const ordered = [...recs].sort((x, y) =>
    (RANK[x.status] ?? 4) - (RANK[y.status] ?? 4) || y.confidence - x.confidence);
  // Page cap — the reviewer queue shows the top records per section; the
  // full set stays available at /overlaps (JSON) and ?node= focus views.
  const CAP = 60;
  const nonComp = ordered.filter((r) => r.kind !== 'complement');
  const comp = ordered.filter((r) => r.kind === 'complement');
  const cards = nonComp.slice(0, CAP).map((r) => card(r, byId, signals, maxBudget)).join('\n')
    + (nonComp.length > CAP ? `<p><em>+ ${nonComp.length - CAP} more overlap records — see /overlaps (JSON).</em></p>` : '');
  const complementCards = comp.slice(0, CAP)
    .map((r) => card(r, byId, signals, maxBudget)).join('\n')
    + (comp.length > CAP ? `<p><em>+ ${comp.length - CAP} more need↔offer matches — see /overlaps?kind=complement.</em></p>` : '');
  const offerCount = nodes.filter((n) => n.kind === 'offer').length;
  const needCount = nodes.filter((n) => n.kind === 'need' || isNeed(n)).length;
  // Needs-first sequencing: internal matching before external money.
  // "Resources rallied" = confirmed/coordinated complements on a need —
  // demonstrated resource mobilisation, the funding signal Roberto Valenti
  // argues should replace "how many NFTs did you sell".
  const ralliedBy = new Map<string, number>();
  for (const r of complements)
    if (r.status === 'confirmed' || r.status === 'coordinated')
      ralliedBy.set(r.nodeIds[0]!, (ralliedBy.get(r.nodeIds[0]!) ?? 0) + 1);
  const unmet = nodes.filter((n) => isNeed(n) && !(ralliedBy.get(n.id) ?? 0));
  const ralliedTotal = [...ralliedBy.values()].reduce((s, c) => s + c, 0);
  const unmetRows = unmet.map((n) => `<tr>
<td>${esc(n.label)}</td><td>${esc(n.orgIds.join(', ') || '—')}</td>
<td>${esc(n.timeframe.from ?? '—')}${n.timeframe.to ? ` → ${esc(n.timeframe.to)}` : ''}</td>
<td>${esc(n.source)}${n.kind === 'action' ? ' (inferred)' : ''}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Coordination — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
table{border-collapse:collapse;width:100%;margin:.5rem 0}td,th{border:1px solid #ddd;padding:.4rem;text-align:left;font-size:.85rem}
.badge{background:#e6f4ea;padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem}
.card{border:1px solid #ddd;border-radius:.5rem;padding:1rem;margin:1rem 0}
.val{display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap}
.val input{padding:.3rem;flex:1;min-width:8rem}.val button{padding:.35rem .8rem;cursor:pointer}
.val select{padding:.3rem}
tr.con td{background:#fdecea;color:#7a2828}
.res{background:#e6f4ea;padding:.4rem;border-radius:.25rem}
.dir{color:#4a7a4a;font-size:.8rem;font-style:italic}
details{margin:.4rem 0}summary{cursor:pointer}</style></head><body>
<h1>Coordination layer</h1>
<p>Overlaps detected across ${new Set(nodes.map((n) => n.source)).size} plan sources —
${nodes.length} nodes scanned. Machine flags, humans decide: no merge happens
without community validation, and every decision is on the
<a href="/ledger">audit ledger</a>.</p>
<p>${['proposed', 'confirmed', 'coordinated', 'rejected'].map((s) => `<span class="badge">${s}: ${counts[s] ?? 0}</span>`).join(' ')}</p>
${focusNode ? `<p class="res">Showing records for <strong>${esc(byId.get(focusNode)?.label ?? focusNode)}</strong> — <a href="/coordination">show all</a></p>` : ''}
<p><a href="/overlaps">JSON</a> · <a href="/possibilities">possibility deck</a> · <a href="/commitments">commitments</a> · <a href="/outcomes">outcomes</a> · <a href="/agent?q=what%20should%20we%20do%20next">ask the agent</a></p>
${cards || '<p><em>No overlaps detected yet — import plans from two sources and run detection.</em></p>'}
<h2>Needs met by offers — internal matching first</h2>
<p>${offerCount} offer${offerCount === 1 ? '' : 's'} and ${needCount} need${needCount === 1 ? '' : 's'} in the graph
(CLC commitment vocabulary — a voucher is a published offer, not proof of delivery).
Resources are matched inside the community before money is sought outside it:
a confirmed match coordinates the offer against the need,
and counts as <strong>resources rallied</strong> — demonstrated resource
mobilisation (${ralliedTotal} so far). Only what can't be met internally
goes to the open-ask list below.</p>
${complementCards || '<p><em>No need↔offer matches yet — import commitments (<code>format:"clc"</code>) and run detection.</em></p>'}
<h2>Unmet needs — open asks beyond the community</h2>
<p>Needs with no confirmed offer match. These are what external support is
for — the ask is concrete because everything the community could
supply itself is already accounted for above.</p>
${unmetRows ? `<table><tr><th>Need</th><th>Owner</th><th>Deadline</th><th>Source</th></tr>${unmetRows}</table>`
  : '<p><em>Every declared need has a confirmed offer.</em></p>'}
${unmet.some((n) => n.capital === 'living')
  ? `<p class="dir">External lane: verified plantings can be sponsored directly on <a href="https://world.treegens.app">Treegens Earth</a> — filmed, AI-counted records.</p>` : ''}
${footer()}
</body></html>`;
}
