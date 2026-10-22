// /impact — the proof hub. Sections: results scoreboard, value in money,
// impact claims, open-evidence readings, the chain-verified ledger, and
// dataset releases. Every figure is ledger-derived — nothing invented.
import type { Attestation, DatasetRelease, ImpactClaim, OracleCheck, Possibility } from '@springforth/core';
import type { PlanNode } from '@springforth/coordination';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { tickerLines, type TickerEvent } from './landing.ts';
import {
  pageHeader, hubNav, hubSection, howItWorks, statGrid, emptyState,
  displayName, hubScript,
} from './ui.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONEY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export interface ValueRow {
  committed: number; matched: number; inKind: number; volunteerTime: number;
  total: number; asked: number; riskAvoided: number; leverage: number;
  riskPerUnit: number;
  capitals?: { financial: number; human: number; social: number; natural: number };
}
export interface SourceRow {
  key: string; source: string; name: string; license: string;
  methodology?: string;
  needs?: string | null; configured: boolean; lastFetch: string | null;
}
export interface LedgerEventRow {
  seq: number; at: string; actor: string; kind: string;
  payload: unknown; prev_hash: string; hash: string;
}
export interface LedgerVerify { ok: boolean; events?: number; brokenAt?: number }

export interface ImpactPageInput {
  lang: Lang;
  metrics: {
    possibilities?: number; activated?: number; quorumRate?: number;
    declaredHoursTotal?: number; complementsConfirmed?: number;
    successfulCoordinationsPerWeek?: number; expiringSoon?: number;
    valueByCurrency?: Record<string, Partial<ValueRow>>;
  } & Record<string, unknown>;
  checks: (OracleCheck & { nodeId?: string })[];
  nodes: PlanNode[];
  sources: SourceRow[];
  claims: ImpactClaim[];
  attestations: Attestation[];
  releases: DatasetRelease[];
  slices: Record<string, string>;
  verify: LedgerVerify;
  events: LedgerEventRow[];
  possibilities: Possibility[];   // for ticker humanization
}

const RESULT_KEYS = [
  ['possibilities', 'metric.possibilities'],
  ['activated', 'metric.activated'],
  ['quorumRate', 'metric.quorum'],
  ['completionRate', 'metric.completed'],
  ['evidenceCoverage', 'metric.evidence'],
  ['declaredHoursTotal', 'metric.hours'],
  ['complementsConfirmed', 'metric.matched'],
  ['successfulCoordinationsPerWeek', 'metric.coordinations'],
  ['expiringSoon', 'metric.closing'],
] as const;

const RATE_FIELDS = new Set(['quorumRate', 'completionRate', 'evidenceCoverage']);

export function renderImpactPage(o: ImpactPageInput): string {
  const lang = o.lang;

  /* #results — fixed label map, live numbers only. */
  const stats = RESULT_KEYS.map(([field, key]) => {
    const v = Number(o.metrics[field] ?? 0);
    return {
      v: RATE_FIELDS.has(field) ? `${Math.round(v * 100)}%` : MONEY.format(v),
      l: t(lang, key),
    };
  });
  const resultsBody = statGrid(stats) +
    `<p class="muted"><small>${esc(t(lang, 'metric.benchmark'))}</small></p>`;

  /* #value — value-by-currency with human columns. */
  const vals = o.metrics.valueByCurrency ?? {};
  const valRows = Object.entries(vals).map(([cur, r]) => {
    const cap = r.capitals
      ? [r.capitals.financial > 0 ? `${MONEY.format(r.capitals.financial)} ${t(lang, 'val.cap.financial')}` : '',
        r.capitals.human > 0 ? `${MONEY.format(r.capitals.human)} ${t(lang, 'val.cap.human')}` : '',
        r.capitals.social > 0 ? `${MONEY.format(r.capitals.social)} ${t(lang, 'val.cap.social')}` : '',
        r.capitals.natural > 0 ? `${MONEY.format(r.capitals.natural)} ${t(lang, 'val.cap.natural')}` : '',
      ].filter(Boolean).join('<br>')
      : '—';
    return `<tr>
<td><strong>${esc(cur)}</strong></td>
<td>${MONEY.format(r.committed ?? 0)}</td><td>${MONEY.format(r.matched ?? 0)}</td>
<td>${MONEY.format(r.inKind ?? 0)}</td><td>${MONEY.format(r.volunteerTime ?? 0)}</td>
<td><strong>${MONEY.format(r.total ?? 0)}</strong></td>
<td>${MONEY.format(r.riskAvoided ?? 0)}</td><td>${r.leverage ?? 0}×</td>
<td class="muted"><small>${cap}</small></td>
</tr>`;
  }).join('\n');
  const askRows = Object.entries(vals).map(([cur, r]) => `<tr>
<td><strong>${esc(cur)}</strong></td><td>${MONEY.format(r.asked ?? 0)}</td>
<td>${r.riskPerUnit ? `${MONEY.format(r.riskPerUnit)}` : '—'}</td>
</tr>`).join('\n');
  const valueBody = Object.keys(vals).length ? `
<table><tr><th scope="col">${esc(t(lang, 'col.currency'))}</th><th scope="col">${esc(t(lang, 'val.committed'))}</th><th scope="col">${esc(t(lang, 'val.matched'))}</th>
<th scope="col">${esc(t(lang, 'val.inKind'))}</th><th scope="col">${esc(t(lang, 'val.volunteer'))}</th>
<th scope="col">${esc(t(lang, 'val.total'))}</th><th scope="col">${esc(t(lang, 'val.risk'))}</th>
<th scope="col">${esc(t(lang, 'val.leverage'))}</th><th scope="col">${esc(t(lang, 'val.cap'))}</th></tr>${valRows}</table>
<details class="how-note"><summary>${esc(t(lang, 'hub.impact.value.more'))}<span class="hn-mark" aria-hidden="true"></span></summary>
<div class="hn-body"><table><tr><th scope="col">${esc(t(lang, 'col.currency'))}</th><th scope="col">${esc(t(lang, 'val.asked'))}</th><th scope="col">${esc(t(lang, 'val.riskPerUnit'))}</th></tr>${askRows}</table></div></details>`
    : emptyState(t(lang, 'hub.impact.value.none'));

  /* #claims — claim cards → /claims/:id + source card. */
  const attCount = new Map<string, number>();
  for (const a of o.attestations)
    if (a.claimId) attCount.set(a.claimId, (attCount.get(a.claimId) ?? 0) + 1);
  const claimCards = o.claims.map((c) => `<div class="card">
<h3><a href="/claims/${esc(c.id)}" style="color:inherit;text-decoration:none">${esc(c.workScope)}</a></h3>
<p><span class="badge">${esc(t(lang, `status.${c.state}`))}</span>
<span class="badge">${attCount.get(c.id) ?? 0} ${esc(t(lang, 'hub.impact.claims.atts'))}</span>
${c.timeframe.from ? `<span class="badge">${esc(c.timeframe.from.slice(0, 10))}${c.timeframe.to ? ` → ${esc(c.timeframe.to.slice(0, 10))}` : ''}</span>` : ''}</p>
${c.possibilityId ? `<p class="muted"><a href="/possibilities#${esc(c.possibilityId)}">${esc(t(lang, 'hub.impact.claims.source'))} →</a></p>` : ''}
</div>`).join('\n');

  /* #evidence — latest 20 readings + collapsed source list. */
  const nodeLabel = new Map(o.nodes.map((n) => [n.id, n.label]));
  const latest = [...o.checks]
    .sort((x, y) => Date.parse(y.at) - Date.parse(x.at))
    .slice(0, 20);
  const checkRows = latest.map((c) => `<tr>
<td><span class="badge ${c.result === 'match' ? 'lime' : c.result === 'mismatch' ? 'coral' : ''}">${esc(c.result)}</span></td>
<td class="muted">${esc(c.source)}</td>
<td>${esc(c.nodeId ? nodeLabel.get(c.nodeId) ?? c.nodeId : '—')}</td>
<td class="muted"><small>${esc(c.methodologyRef ?? '—')}</small></td>
<td class="muted">${esc(c.at.slice(0, 10))}</td>
</tr>`).join('\n');
  const sourceList = o.sources.map((s) => `<li>
<strong>${esc(s.name)}</strong> <span class="muted">— ${esc(s.license)}${s.methodology ? ` · <small>${esc(s.methodology)}</small>` : ''}${s.configured ? '' : ` · ${esc(t(lang, 'hub.impact.evidence.unconfigured'))}`}${s.lastFetch ? ` · ${esc(s.lastFetch.slice(0, 10))}` : ''}</span></li>`).join('\n');
  const evidenceBody = `
${checkRows ? `<table><tr><th scope="col">${esc(t(lang, 'col.result'))}</th><th scope="col">${esc(t(lang, 'col.source'))}</th><th scope="col">${esc(t(lang, 'col.target'))}</th><th scope="col">${esc(t(lang, 'col.method'))}</th><th scope="col">${esc(t(lang, 'col.date'))}</th></tr>${checkRows}</table>`
    : emptyState(t(lang, 'hub.impact.evidence.none'))}
${sourceList ? `<details class="how-note"><summary>${esc(t(lang, 'hub.impact.evidence.sources'))} (${o.sources.length})<span class="hn-mark" aria-hidden="true"></span></summary>
<div class="hn-body"><ul>${sourceList}</ul></div></details>` : ''}
${howItWorks(lang, 'how.impact.evidence', 's6')}`;

  /* #proof — chain-verified banner + last 10 events + links. */
  const possById = new Map(o.possibilities.map((p) => [p.id, p]));
  const lines = tickerLines(o.events as unknown as TickerEvent[], possById, 10);
  const proofBody = `
<p>${o.verify.ok
  ? `<strong style="color:var(--sf-ok-ink)">✓ ${esc(t(lang, 'hub.impact.proof.ok'))}</strong> — ${o.verify.events ?? 0} ${esc(t(lang, 'hub.impact.proof.events'))}`
  : `<strong style="color:var(--sf-coral-ink)">✗ ${esc(t(lang, 'hub.impact.proof.broken'))} ${o.verify.brokenAt ?? '?'}</strong>`}</p>
${lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : `<p class="muted">${esc(t(lang, 'ticker.empty'))}</p>`}
<p><a href="/ledger">${esc(t(lang, 'hub.impact.proof.browse'))} →</a> · <a href="/ledger/verify">${esc(t(lang, 'hub.impact.proof.verify'))} →</a></p>
${howItWorks(lang, 'how.impact.ledger', 's6')}`;

  /* #data — signed releases + always-live slices. */
  const relRows = o.releases.map((r) => `<tr>
<td><strong>${esc(r.name)}</strong><br><small class="muted">${esc(r.id)}</small></td>
<td>${r.records}</td>
<td class="muted"><code>${esc(r.sha256.slice(0, 16))}…</code></td>
<td class="muted">${esc(r.createdAt.slice(0, 10))}</td>
</tr>`).join('\n');
  const sliceList = Object.entries(o.slices)
    .map(([k, d]) => `<li><code>${esc(k)}</code> — ${esc(d)}</li>`).join('\n');
  const dataBody = `
${relRows ? `<table><tr><th scope="col">${esc(t(lang, 'col.source'))}</th><th scope="col">${esc(t(lang, 'col.records'))}</th><th scope="col">sha256</th><th scope="col">${esc(t(lang, 'col.date'))}</th></tr>${relRows}</table>`
    : `<p class="muted">${esc(t(lang, 'hub.impact.data.none'))}</p>`}
${sliceList ? `<h3>${esc(t(lang, 'hub.impact.data.available'))}</h3><ul>${sliceList}</ul>` : ''}`;

  const sections: Array<[string, number | undefined, string, string | undefined]> = [
    ['results', undefined, resultsBody, undefined],
    ['value', Object.keys(vals).length, valueBody, t(lang, 'hub.impact.value.lede')],
    ['claims', o.claims.length, claimCards || emptyState(t(lang, 'hub.impact.claims.none')), t(lang, 'hub.impact.claims.lede')],
    ['evidence', o.checks.length, evidenceBody, t(lang, 'hub.impact.evidence.lede')],
    ['proof', undefined, proofBody, undefined],
    ['data', o.releases.length, dataBody, t(lang, 'hub.impact.data.lede')],
  ];

  const body = `<div class="page hub-head">${pageHeader({
    kicker: t(lang, 'hub.impact.kicker'),
    title: t(lang, 'hub.impact.h1'),
    em: t(lang, 'hub.impact.h1.em'),
    lede: t(lang, 'hub.impact.lede'),
  })}</div>
${hubNav(sections.map(([id]) => ({ href: `#${id}`, label: t(lang, `hub.impact.${id}.t`) })), lang)}
<div class="page hub-body">
${sections.map(([id, count, secBody, lede], i) => hubSection({
    id, kicker: t(lang, `hub.impact.${id}.k`), title: t(lang, `hub.impact.${id}.t`),
    count, lede, body: secBody, index: i + 1,
  })).join('\n')}
</div>${hubScript}`;

  return pageShell({ title: `${t(lang, 'nav.impact')} — Springforth`,
    htmx: false, lang }, body);
}
