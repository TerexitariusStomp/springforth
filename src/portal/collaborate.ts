// /collaborate — the dedupe hub. Sections: needs & offers (internal
// matching first), the plan-overlap review queue, shared goals, the plan
// portfolio, the resource commons, and the cited agent reader.
// Everything degrades to plain links/forms; hubScript only polishes.
import { isNeed, triScore, type ExternalPlan, type OverlapRecord, type PlanNode } from '../coordination';
import type { AssuranceCredit, OracleCheck, Signal } from '../core';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import {
  pageHeader, hubNav, hubSection, howItWorks, emptyState, pager,
  displayName, hubScript,
} from './ui.ts';
import { renderNetworkSvg, NETWORK_CSS, type NetworkGraph } from './network.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/* ── moved from coordination.ts ─────────────────────────────────── */

// Human correction form — per node, plain POST. Fixes are attributed and
// diffed on the ledger; the extraction trail stays visible.
function correctForm(n: PlanNode | undefined, id: string, lang: Lang): string {
  return `<details><summary>${esc(t(lang, 'form.correctPrefix'))} ${esc(n?.label ?? id)}</summary>
<form method="post" action="/nodes/${esc(id)}/correct" class="val">
  <input name="actor" placeholder="${esc(t(lang, 'form.name'))}" aria-label="${esc(t(lang, 'form.name'))}" required>
  <input name="label" value="${esc(n?.label ?? '')}" placeholder="${esc(t(lang, 'form.label'))}" aria-label="${esc(t(lang, 'form.label'))}">
  <input name="placeId" value="${esc(n?.placeId ?? '')}" placeholder="${esc(t(lang, 'form.place'))}" aria-label="${esc(t(lang, 'form.place'))}">
  <input name="timeframeFrom" value="${esc(n?.timeframe.from ?? '')}" placeholder="${esc(t(lang, 'form.from'))}" aria-label="${esc(t(lang, 'form.from'))}">
  <input name="timeframeTo" value="${esc(n?.timeframe.to ?? '')}" placeholder="${esc(t(lang, 'form.to'))}" aria-label="${esc(t(lang, 'form.to'))}">
  <input name="budget" value="${n?.budget ?? ''}" placeholder="${esc(t(lang, 'form.budget'))}" aria-label="${esc(t(lang, 'form.budget'))}">
  <input name="note" placeholder="${esc(t(lang, 'form.whyCorrection'))}" aria-label="${esc(t(lang, 'form.whyCorrection'))}">
  <button>${esc(t(lang, 'form.submitCorrection'))}</button>
</form></details>`;
}

// Linked-evidence card for the focused node: its plan, inferred/explicit
// parentage, child actions, oracle checks and verification credits —
// the attachments OnePlanet hides behind its app surface.
function focusEvidence(f: NonNullable<CollaboratePageInput['focus']>,
  parentInferred: boolean, lang: Lang): string {
  const rows: string[] = [];
  if (f.plan)
    rows.push(`<tr><th scope="row">${esc(t(lang, 'hub.collaborate.focus.plan'))}</th><td>${esc(f.plan.title)}</td></tr>`);
  if (f.parent)
    rows.push(`<tr><th scope="row">${esc(t(lang, 'hub.collaborate.focus.parent'))}</th><td><a href="/collaborate?node=${encodeURIComponent(f.parent.id)}">${esc(f.parent.label)}</a>${parentInferred ? ` <span class="badge">${esc(t(lang, 'hub.collaborate.focus.inferred'))}</span>` : ''}</td></tr>`);
  if (f.children.length)
    rows.push(`<tr><th scope="row">${esc(t(lang, 'hub.collaborate.focus.children'))}</th><td>${f.children.map((c) => `<a href="/collaborate?node=${encodeURIComponent(c.id)}">${esc(c.label)}</a>`).join('<br>')}</td></tr>`);
  if (f.credits.length)
    rows.push(`<tr><th scope="row">${esc(t(lang, 'hub.collaborate.focus.credits'))}</th><td>${f.credits.length}</td></tr>`);
  rows.push(`<tr><th scope="row">${esc(t(lang, 'hub.collaborate.focus.overlaps'))}</th><td>${f.overlaps.length}</td></tr>`);
  const checkRows = f.checks.map((c) =>
    `<tr><td>${esc(c.source)}</td><td><span class="badge ${c.result === 'match' ? 'lime' : c.result === 'mismatch' ? 'coral' : ''}">${esc(c.result)}</span></td><td>${c.score.toFixed(2)}</td><td>${esc(c.detail.slice(0, 80))}</td><td>${esc(c.at.slice(0, 10))}</td></tr>`).join('');
  return `<div class="card">
<span class="kicker">${esc(t(lang, 'hub.collaborate.focus.k'))}</span>
<table>${rows.join('')}</table>
${checkRows ? `<h4>${esc(t(lang, 'hub.collaborate.focus.checks'))}</h4>
<table><tr><th scope="col">${esc(t(lang, 'col.source'))}</th><th scope="col">${esc(t(lang, 'col.result'))}</th><th scope="col">${esc(t(lang, 'col.score'))}</th><th scope="col">${esc(t(lang, 'col.detail'))}</th><th scope="col">${esc(t(lang, 'col.date'))}</th></tr>${checkRows}</table>` : ''}
</div>`;
}

const KIND_BADGE: Record<string, string> = {
  duplicate: 'coral', overlap: 'blue', complement: 'lime', conflict: 'coral',
};

// One overlap/complement record as a review card — moved verbatim in
// spirit from coordination.ts: evidence AND counter-evidence, signed
// support, human validation + scenario forms, agreement link.
function overlapCard(
  rec: OverlapRecord, byId: Map<string, PlanNode>, signals: Signal[],
  maxBudget: number, lang: Lang,
): string {
  const signed = signals.filter((s) =>
    rec.nodeIds.includes(s.targetId) && s.intent === 'support');
  const [a, b] = rec.nodeIds.map((id) => byId.get(id));
  // Complements are directional — nodeIds = [need, offer]; head it that way.
  const heading = rec.kind === 'complement'
    ? `${esc(a?.label ?? rec.nodeIds[0])} <span class="dir">← ${esc(t(lang, 'hub.collaborate.metBy'))}</span> ${esc(b?.label ?? rec.nodeIds[1])}`
    : `${esc(a?.label ?? rec.nodeIds[0])} &harr; ${esc(b?.label ?? rec.nodeIds[1])}`;
  const evRows = rec.evidence
    .map((e) => `<tr><td>${esc(e.field)}</td><td>${esc(e.a.slice(0, 60))}</td><td>${esc(e.b.slice(0, 60))}</td><td>${e.score.toFixed(2)}</td></tr>`)
    .join('');
  const ce = rec.counterEvidence ?? [];
  const ceRows = ce.map((e) =>
    `<tr class="con"><td>${esc(e.field)}</td><td>${esc(e.a.slice(0, 60))}</td><td>${esc(e.b.slice(0, 60))}</td><td>${esc(t(lang, 'misc.mismatch'))}</td></tr>`)
    .join('');
  const tri = triScore(rec, byId, maxBudget);
  const votes = rec.validations
    .map((v) => `<li>${displayName(v.actor)} — ${esc(t(lang, `verdict.${v.verdict}`))}${v.note ? ` (${esc(v.note)})` : ''}</li>`)
    .join('');
  const scen = rec.scenario
    ? `<p class="res">${esc(t(lang, 'hub.collaborate.scenario'))} <strong>${esc(rec.scenario.choice)}</strong> ${esc(t(lang, 'hub.collaborate.by'))} ${displayName(rec.scenario.actor)}${rec.scenario.rationale ? ` — ${esc(rec.scenario.rationale)}` : ''}${rec.scenario.objections ? ` <em>(${esc(t(lang, 'hub.collaborate.objections'))} ${esc(rec.scenario.objections)})</em>` : ''}</p>`
    : '';
  const actions = rec.status === 'proposed' || rec.status === 'confirmed' ? `
  <form method="post" action="/overlaps/${esc(rec.id)}/validate" class="val">
    <input name="actor" placeholder="${esc(t(lang, 'form.name'))}" aria-label="${esc(t(lang, 'form.name'))}" required>
    <input name="note" placeholder="${esc(t(lang, 'form.note'))}" aria-label="${esc(t(lang, 'form.note'))}">
    <select name="scenario" aria-label="${esc(t(lang, 'form.scenario'))}">
      <option value="">${esc(t(lang, 'form.scenario'))}</option>
      <option value="separate">${esc(t(lang, 'form.keepSeparate'))}</option>
      <option value="coordinate">${esc(t(lang, 'form.coordinateDelivery'))}</option>
      <option value="combine">${esc(t(lang, 'form.combineFunding'))}</option>
    </select>
    <input name="rationale" placeholder="${esc(t(lang, 'form.rationale'))}" aria-label="${esc(t(lang, 'form.rationale'))}">
    <button name="verdict" value="confirm">${esc(t(lang, 'form.confirm'))}</button>
    <button name="verdict" value="reject">${esc(t(lang, 'form.notSame'))}</button>
  </form>
  ${rec.status === 'confirmed' ? `
  <form method="post" action="/overlaps/${esc(rec.id)}/confirm" class="val">
    <input name="actor" placeholder="${esc(t(lang, 'form.name'))}" aria-label="${esc(t(lang, 'form.name'))}" required>
    <select name="scenario" aria-label="${esc(t(lang, 'form.scenario'))}">
      <option value="coordinate">${esc(t(lang, 'form.coordinateDelivery'))}</option>
      <option value="combine">${esc(t(lang, 'form.combineFunding'))}</option>
    </select>
    <input name="rationale" placeholder="${esc(t(lang, 'form.rationale'))}" aria-label="${esc(t(lang, 'form.rationale'))}">
    <button>${esc(t(lang, 'form.coordinateAction'))}</button>
  </form>` : ''}` : '';
  const res = rec.resolution
    ? `<p class="res">${esc(t(lang, 'hub.collaborate.coordinated'))} — <a href="/overlaps/${esc(rec.id)}/agreement">${esc(t(lang, 'hub.collaborate.agreement'))}</a></p>`
    : '';
  // Treegens-sourced nodes carry filmed evidence — link out to it and to
  // the sponsor lane. Deep-link only: settlement stays on their side.
  const tg = [a, b].some((n) => n?.source.startsWith('treegens'))
    ? `<p class="dir">${esc(t(lang, 'hub.collaborate.treegens'))} <a href="https://world.treegens.app">world.treegens.app</a></p>`
    : '';
  return `<div class="card">
<h3>${heading}</h3>
<p><span class="badge ${KIND_BADGE[rec.kind] ?? ''}">${esc(t(lang, `kind.${rec.kind}`))}</span> <span class="badge">${esc(t(lang, `status.${rec.status}`))}</span>
<span class="badge">${esc(t(lang, 'hub.collaborate.strength'))} ${pct(tri.strength)}</span>
<span class="badge">${esc(t(lang, 'hub.collaborate.materiality'))} ${tri.materiality !== undefined ? pct(tri.materiality) : '—'}</span>
<span class="badge">${esc(t(lang, 'hub.collaborate.readiness'))} ${pct(tri.readiness)}</span>
${signed.length ? `<span class="badge">${signed.length} ${esc(t(lang, 'hub.collaborate.supports'))}</span>` : ''}</p>
<p>${esc(rec.reasoning)}</p>
<details><summary>${esc(t(lang, 'hub.collaborate.evidence'))} (${rec.evidence.length} ${esc(t(lang, 'hub.collaborate.ev.for'))}${ce.length ? ` · ${ce.length} ${esc(t(lang, 'hub.collaborate.ev.against'))}` : ''})</summary>
<table><tr><th scope="col">${esc(t(lang, 'col.field'))}</th><th scope="col">${esc(t(lang, 'col.planA'))}</th><th scope="col">${esc(t(lang, 'col.planB'))}</th><th scope="col">${esc(t(lang, 'col.score'))}</th></tr>${evRows}${ceRows}</table></details>
${votes ? `<ul>${votes}</ul>` : `<p><em>${esc(t(lang, 'hub.collaborate.awaiting'))}</em></p>`}
${scen}${actions}${res}${tg}
<details><summary>${esc(t(lang, 'form.correctTitle'))}</summary>${correctForm(a, rec.nodeIds[0]!, lang)}${correctForm(b, rec.nodeIds[1]!, lang)}</details>
<form method="post" action="/signals" class="val" enctype="application/x-www-form-urlencoded">
  <input name="actor" placeholder="${esc(t(lang, 'form.name'))}" aria-label="${esc(t(lang, 'form.name'))}" required>
  <input type="hidden" name="targetId" value="${esc(rec.nodeIds[0]!)}">
  <input type="hidden" name="targetKind" value="node">
  <input type="hidden" name="intent" value="support">
  <button>${esc(t(lang, 'form.signSupport'))} ${esc(a?.label ?? t(lang, 'col.need').toLowerCase())}</button>
</form>
</div>`;
}

/* ── moved from outcomes.ts — cluster shared goals ──────────────── */

function outcomeCards(
  nodes: PlanNode[], recs: OverlapRecord[], indicators: PlanNode[], lang: Lang,
): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outcomes = nodes.filter((n) => n.kind === 'outcome');
  // Cluster outcomes: same canonical text, or linked by an overlap record —
  // directly, or through an overlapped action that points at the outcome.
  const linked = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!linked.has(a)) linked.set(a, new Set());
    if (!linked.has(b)) linked.set(b, new Set());
    linked.get(a)!.add(b); linked.get(b)!.add(a);
  };
  for (const r of recs) {
    const [a, b] = r.nodeIds;
    link(a, b);
    const pa = byId.get(a)?.parentOutcomeId, pb = byId.get(b)?.parentOutcomeId;
    if (pa && pb && pa !== pb) link(pa, pb);
  }
  const seen = new Set<string>();
  const groups: PlanNode[][] = [];
  for (const o of outcomes) {
    if (seen.has(o.id)) continue;
    const group = [o];
    seen.add(o.id);
    for (const p of outcomes) {
      if (seen.has(p.id)) continue;
      if (p.canonical === o.canonical || linked.get(o.id)?.has(p.id) || linked.get(p.id)?.has(o.id)) {
        group.push(p); seen.add(p.id);
      }
    }
    groups.push(group);
  }
  return groups.map((g) => {
    const pursuers = g.map((o) =>
      `<a href="/collaborate?node=${encodeURIComponent(o.id)}#overlaps">${esc(o.label)}</a> <small>(${esc(o.source)}${o.orgIds.length ? ` · ${esc(o.orgIds.join(', '))}` : ''})</small>`).join(', ');
    const actions = nodes.filter((n) =>
      n.kind === 'action' && n.parentOutcomeId && g.some((o) => o.id === n.parentOutcomeId));
    const actionList = actions.map((a) =>
      `<li>${esc(a.label)} <small>— ${esc(a.source)}${a.timeframe.from ? ` · ${esc(a.timeframe.from)}` : ''}</small></li>`).join('');
    const recLinks = recs
      .filter((r) => r.nodeIds.some((id) => g.some((o) => o.id === id)))
      .map((r) => r.status);
    const stat = recLinks.includes('coordinated') ? 'coordinated'
      : recLinks.includes('confirmed') ? 'confirmed'
      : recLinks.length ? 'proposed' : '';
    const inds = indicators.filter((i) =>
      g.some((o) => i.parentOutcomeId === o.id) ||
      g.some((o) => i.orgIds.some((org) => o.orgIds.includes(org))));
    const indList = inds.map((i) => esc(i.label)).join(', ');
    return `<div class="card">
<h3>${esc(g[0]!.label)}</h3>
<p>${g.length > 1 ? `<span class="badge">${g.length} ${esc(t(lang, 'hub.collaborate.outcomes.pursuing'))}</span> ` : ''}${stat ? `<span class="badge">${esc(t(lang, `status.${stat}`))}</span>` : ''}</p>
<p><strong>${esc(t(lang, 'hub.collaborate.outcomes.who'))}</strong> ${pursuers}</p>
${actionList ? `<p><strong>${esc(t(lang, 'hub.collaborate.outcomes.actions'))}</strong></p><ul>${actionList}</ul>`
  : `<p><em>${esc(t(lang, 'hub.collaborate.outcomes.noActions'))}</em></p>`}
${indList ? `<p><strong>${esc(t(lang, 'hub.collaborate.outcomes.indicators'))}</strong> ${indList}</p>` : ''}
</div>`;
  });
}

/* ── moved from portfolio.ts — the plan table ───────────────────── */

const money = (n?: number) => (n ? `£${n.toLocaleString('en-GB')}` : '—');

function planRows(plans: ExternalPlan[], nodes: PlanNode[], lang: Lang): string {
  return plans.map((p) => {
    const pn = p.nodes?.length ? p.nodes : nodes.filter((n) => n.source === p.source);
    const places = new Set(pn.map((n) => n.placeId).filter((x): x is string => !!x));
    const budget = pn.reduce((s, n) => s + (n.budget ?? 0), 0);
    // Data gaps — fields a reviewer needs that ingest didn't supply.
    const gaps = [
      pn.filter((n) => !n.placeId && !n.h3).length && 'place',
      pn.filter((n) => !n.timeframe.from).length && 'timeframe',
      pn.filter((n) => !n.orgIds.length).length && 'owner',
      !budget && 'budget',
    ].filter(Boolean).join(', ');
    return `<tr>
<td><strong>${esc(p.title)}</strong><br><small class="muted">${esc(p.source)}${gaps ? ` · ${esc(t(lang, 'hub.collaborate.plans.missing'))} ${esc(gaps)}` : ''}</small></td>
<td>${[...places].slice(0, 4).map(esc).join(', ') || '—'}</td>
<td>${money(budget)}</td></tr>`;
  }).join('');
}

/* ── input + page ───────────────────────────────────────────────── */

export interface CommitmentRow extends PlanNode {
  role: string;                  // 'offer' | 'need' — loader widens to string
  inferred: boolean;
  offersMatched?: number;
}

export interface ResourceRow {
  id: string; label: string; owner: string; terms?: string;
  capacity?: string; capital?: string; timesContributed: number; source?: string;
}

export interface AgentOut {
  answer: string; citedNodeIds: string[]; citedOverlapIds: string[]; intent: string;
}

// Matches views.ts#loadCommitments / loadResources / loadCardConnections
// shapes without importing the edge package.
export interface CollaboratePageInput {
  lang: Lang;
  commitments: CommitmentRow[];
  byCapital: Record<string, number>;
  resources: ResourceRow[];
  overlaps: OverlapRecord[];
  nodes: PlanNode[];
  plans: ExternalPlan[];
  signals: Signal[];
  // query state
  nodeFocus?: string;        // ?node=<id> — all statuses for one node
  overlapsAll?: boolean;     // ?overlaps=all — include <0.5 confidence
  page?: number;             // ?page=n — 12 per page
  outcomesAll?: boolean;     // ?outcomes=all — lift the 12-cap
  ask?: { q: string; out?: AgentOut };
  network?: NetworkGraph;    // #network — cross-plan overlap graph
  // ?node=<id> — the focused node's linked evidence bundle.
  focus?: {
    plan: ExternalPlan | null;
    parent: PlanNode | null;
    children: PlanNode[];
    checks: OracleCheck[];
    credits: AssuranceCredit[];
    overlaps: OverlapRecord[];
  };
}

// Below this confidence a machine flag doesn't reach the default queue —
// confirmed/coordinated records are always shown regardless.
const MIN_CONFIDENCE = 0.5;
const PAGE_SIZE = 12;
const OUTCOME_CAP = 12;

export function renderCollaboratePage(o: CollaboratePageInput): string {
  const lang = o.lang;
  const byId = new Map(o.nodes.map((n) => [n.id, n]));
  const maxBudget = Math.max(1, ...o.nodes.map((n) => n.budget ?? 0));

  /* #needs — unmet needs first, then needs already met by offers. */
  const unmet = o.commitments.filter((n) => n.role === 'need' && !n.offersMatched);
  const unmetRows = unmet.map((n) => `<div class="card">
<h3>${esc(n.label)}</h3>
<p class="muted">${esc(n.placeId ?? '—')}${n.orgIds.length ? ` · ${n.orgIds.map((x) => displayName(x)).join(', ')}` : ''}</p>
<p><span class="badge coral">${esc(t(lang, 'hub.collaborate.needs.zero'))}</span>
${n.possibilityId ? `<a href="/possibilities#${esc(n.possibilityId)}">${esc(t(lang, 'hub.collaborate.needs.onCard'))} →</a>` : ''}</p>
</div>`).join('\n');
  const complements = o.overlaps.filter((r) => r.kind === 'complement')
    .sort((x, y) =>
      (Number(y.status === 'confirmed' || y.status === 'coordinated')
        - Number(x.status === 'confirmed' || x.status === 'coordinated'))
      || y.confidence - x.confidence);
  const compCards = complements.slice(0, PAGE_SIZE)
    .map((r) => overlapCard(r, byId, o.signals, maxBudget, lang)).join('\n');
  const capitalDisc = Object.keys(o.byCapital).length
    ? `<details class="how-note"><summary>${esc(t(lang, 'hub.collaborate.needs.capital'))}<span class="hn-mark" aria-hidden="true"></span></summary>
<div class="hn-body">${Object.entries(o.byCapital).map(([k, n]) => `<span class="badge">${esc(k)} × ${n}</span>`).join(' ')}</div></details>`
    : '';
  const needsBody = `
${capitalDisc}
${unmetRows || emptyState(t(lang, 'hub.collaborate.needs.none'))}
${complements.length ? `<h3>${esc(t(lang, 'hub.collaborate.needs.matched'))}</h3>${compCards}` : `<p class="muted">${esc(t(lang, 'hub.collaborate.needs.noComplements'))}</p>`}
${howItWorks(lang, 'how.collaborate.needs', 's4')}`;

  /* #overlaps — the reviewer queue, filtered + paged. */
  let recs = o.overlaps.filter((r) => r.kind !== 'complement');
  let focusNote = '';
  if (o.nodeFocus) {
    recs = recs.filter((r) => r.nodeIds.includes(o.nodeFocus!));
    focusNote = `<p class="res">${esc(t(lang, 'hub.collaborate.overlaps.focus'))} <strong>${esc(byId.get(o.nodeFocus)?.label ?? o.nodeFocus)}</strong> — <a href="/collaborate#overlaps">${esc(t(lang, 'hub.collaborate.overlaps.all'))}</a></p>`
      + correctForm(byId.get(o.nodeFocus), o.nodeFocus, lang)
      + (o.focus ? focusEvidence(o.focus,
        byId.get(o.nodeFocus)?.parentInferred ?? false, lang) : '');
  } else if (!o.overlapsAll) {
    recs = recs.filter((r) =>
      r.confidence >= MIN_CONFIDENCE || r.status === 'confirmed' || r.status === 'coordinated');
  }
  const RANK: Record<string, number> = { confirmed: 0, coordinated: 0, proposed: 1, rejected: 2 };
  const ordered = [...recs].sort((x, y) =>
    (RANK[x.status] ?? 3) - (RANK[y.status] ?? 3) || y.confidence - x.confidence);
  const page = Math.max(1, o.page ?? 1);
  const pageRecs = o.nodeFocus ? ordered : ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hidden = o.overlaps.filter((r) => r.kind !== 'complement').length
    - o.overlaps.filter((r) => r.kind !== 'complement'
      && (r.confidence >= MIN_CONFIDENCE || r.status === 'confirmed' || r.status === 'coordinated')).length;
  const overlapsBody = `
${focusNote}
${!o.nodeFocus && !o.overlapsAll && hidden > 0
  ? `<p><a href="/collaborate?overlaps=all#overlaps">${esc(t(lang, 'hub.collaborate.overlaps.showAll'))} (${hidden})</a></p>` : ''}
${!o.nodeFocus && o.overlapsAll
  ? `<p><a href="/collaborate#overlaps">${esc(t(lang, 'hub.collaborate.overlaps.hideLow'))}</a></p>` : ''}
${pageRecs.map((r) => overlapCard(r, byId, o.signals, maxBudget, lang)).join('\n')
  || emptyState(t(lang, 'hub.collaborate.overlaps.none'))}
${!o.nodeFocus ? pager({ page, hasMore: page * PAGE_SIZE < ordered.length,
    basePath: `/collaborate${o.overlapsAll ? '?overlaps=all' : ''}` }, lang) : ''}
${howItWorks(lang, 'how.collaborate.overlaps', 's4')}`;

  /* #outcomes — clustered shared goals, capped. */
  const indicators = o.nodes.filter((n) => n.kind === 'indicator');
  const allOutcomes = outcomeCards(o.nodes, o.overlaps, indicators, lang);
  const outcomesHtml = o.outcomesAll
    ? allOutcomes.join('\n')
    : allOutcomes.slice(0, OUTCOME_CAP).join('\n');
  const outcomesToggle = !o.outcomesAll && allOutcomes.length > OUTCOME_CAP
    ? `<p><a href="/collaborate?outcomes=all#outcomes">${esc(t(lang, 'hub.collaborate.outcomes.all'))}</a></p>`
    : o.outcomesAll
      ? `<p><a href="/collaborate#outcomes">${esc(t(lang, 'hub.collaborate.outcomes.fewer'))}</a></p>`
      : '';

  /* #plans — the portfolio table (overlap clusters live in #overlaps). */
  const plansBody = o.plans.length
    ? `<table><tr><th scope="col">${esc(t(lang, 'col.plan'))}</th><th scope="col">${esc(t(lang, 'col.places'))}</th><th scope="col">${esc(t(lang, 'col.ask'))}</th></tr>${planRows(o.plans, o.nodes, lang)}</table>`
    : emptyState(t(lang, 'hub.collaborate.plans.none'));

  /* #commons — every published offer, humanized owner. */
  const commonsBody = o.resources.length
    ? o.resources.map((r) => `<div class="card">
<h3>${esc(r.label)}</h3>
<p class="muted">${displayName(r.owner)} · ${r.timesContributed} ${esc(t(lang, 'hub.collaborate.commons.times'))}${r.capacity ? ` · ${esc(r.capacity)}` : ''}</p>
${r.terms ? `<p><small class="muted">${esc(r.terms)}</small></p>` : ''}
</div>`).join('\n')
    : emptyState(t(lang, 'hub.collaborate.commons.none'));

  /* #ask — the cited agent reader. */
  const out = o.ask?.out;
  const askBody = `
<form method="get" action="/collaborate#ask" class="val" style="max-width:40rem">
  <input type="search" name="q" value="${esc(o.ask?.q ?? '')}" placeholder="${esc(t(lang, 'hub.collaborate.ask.placeholder'))}" aria-label="${esc(t(lang, 'hub.collaborate.ask.t'))}" style="flex:1">
  <button type="submit">${esc(t(lang, 'hub.collaborate.ask.button'))}</button>
</form>
${out ? `<div class="card">
<span class="kicker">${esc(out.intent)}</span>
<p>${esc(out.answer)}</p>
${out.citedNodeIds.length || out.citedOverlapIds.length ? `<p class="muted">${esc(t(lang, 'hub.collaborate.ask.cited'))} ${[...out.citedOverlapIds, ...out.citedNodeIds].map((id) => `<code>${esc(id)}</code>`).join(' ')}</p>` : ''}
</div>` : ''}
<p class="muted" style="margin-top:1rem">${esc(t(lang, 'hub.collaborate.search.lede'))}</p>
<form method="get" action="/search" class="val" style="max-width:40rem">
  <input type="search" name="q" placeholder="${esc(t(lang, 'hub.collaborate.search.placeholder'))}" aria-label="${esc(t(lang, 'hub.collaborate.search.t'))}" style="flex:1">
  <button type="submit">${esc(t(lang, 'hub.collaborate.search.button'))}</button>
</form>`;

  const sections: Array<[string, string, number | undefined, string, string | undefined]> = [
    ['needs', t(lang, 'hub.collaborate.needs.t'), o.commitments.length, needsBody, t(lang, 'hub.collaborate.needs.lede')],
    ['overlaps', t(lang, 'hub.collaborate.overlaps.t'), recs.length, overlapsBody, t(lang, 'hub.collaborate.overlaps.lede')],
    ['outcomes', t(lang, 'hub.collaborate.outcomes.t'), allOutcomes.length,
      (outcomesHtml + outcomesToggle) || emptyState(t(lang, 'hub.collaborate.outcomes.none')),
      t(lang, 'hub.collaborate.outcomes.lede')],
    ['plans', t(lang, 'hub.collaborate.plans.t'), o.plans.length, plansBody, undefined],
    ['commons', t(lang, 'hub.collaborate.commons.t'), o.resources.length, commonsBody, t(lang, 'hub.collaborate.commons.lede')],
    ['network', t(lang, 'hub.collaborate.network.t'), o.network?.edges.length ?? 0,
      o.network?.edges.length
        ? `<p class="muted">${esc(t(lang, 'hub.collaborate.network.lede'))}</p>${renderNetworkSvg(o.network, lang)}`
        : emptyState(t(lang, 'hub.collaborate.network.none')), undefined],
    ['ask', t(lang, 'hub.collaborate.ask.t'), undefined, askBody, t(lang, 'hub.collaborate.ask.lede')],
  ];

  const body = `<div class="page hub-head">${pageHeader({
    kicker: t(lang, 'hub.collaborate.kicker'),
    title: t(lang, 'hub.collaborate.h1'),
    em: t(lang, 'hub.collaborate.h1.em'),
    lede: t(lang, 'hub.collaborate.lede'),
  })}</div>
${hubNav(sections.map(([id, label]) => ({ href: `#${id}`, label })), lang)}
<div class="page hub-body">
${sections.map(([id, title, count, secBody, lede], i) => hubSection({
    id, kicker: t(lang, `hub.collaborate.${id}.k`), title, count,
    lede, body: secBody, index: i + 1,
  })).join('\n')}
</div>${hubScript}`;

  return pageShell({ title: `${t(lang, 'nav.collaborate')} — Springforth`,
    htmx: false, lang, extraCss: NETWORK_CSS }, body);
}
