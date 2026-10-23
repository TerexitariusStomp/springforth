// /plans — the plan document lens. OnePlanet shows plans as mindmaps /
// tables behind a login; here every imported plan is a readable,
// server-rendered document with its overlap count and provenance.

import { marked } from 'marked';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, emptyState } from './ui.ts';
import { sparkline, type Reading } from './sparkline.ts';
import type { OverlapRecord, PlanNode } from '../coordination';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Escape-then-parse: markdown syntax renders, raw HTML never survives.
const md = (s: string) => marked.parse(esc(s), { async: false }) as string;

export interface PlanSummary {
  id: string;
  title: string;
  source: string;
  importedAt: string;
  nodeCount: number;
  outcomes: number;
  actions: number;
  indicators: number;
  offers: number;
  needs: number;
  /** detected overlaps that span this plan and another source */
  overlaps: number;
}

export interface PlansPageInput { lang: Lang; plans: PlanSummary[] }

export interface PlanPageInput {
  lang: Lang;
  plan: PlanSummary;
  nodes: PlanNode[];
  overlaps: OverlapRecord[];
  /** oracle-check score series per node id — drives indicator sparklines */
  checks?: Record<string, Reading[]>;
}

const KIND_ORDER: PlanNode['kind'][] =
  ['outcome', 'action', 'indicator', 'framework', 'organisation', 'place', 'offer', 'need'];

export function renderPlansPage(o: PlansPageInput): string {
  const rows = o.plans.map((p) => `<tr>
<td><a href="/plans/${encodeURIComponent(p.id)}">${esc(p.title)}</a></td>
<td class="muted">${esc(p.source.split(':')[0] ?? p.source)}</td>
<td>${p.nodeCount}</td>
<td>${p.outcomes} · ${p.actions} · ${p.indicators}</td>
<td>${p.offers} · ${p.needs}</td>
<td>${p.overlaps || '—'}</td>
<td>${esc(p.importedAt.slice(0, 10))}</td>
</tr>`).join('\n');
  return pageShell({
    title: `${t(o.lang, 'plans.h1')} — Springforth`, lang: o.lang, htmx: false,
  }, `<div class="page">
${pageHeader({
    kicker: t(o.lang, 'plans.kicker'),
    title: t(o.lang, 'plans.h1'),
    em: t(o.lang, 'plans.h1.em'),
    lede: t(o.lang, 'plans.lede'),
    back: { href: '/collaborate', label: t(o.lang, 'nav.collaborate') },
  })}
${o.plans.length ? `<table>
<tr><th scope="col">${esc(t(o.lang, 'col.plan'))}</th><th scope="col">${esc(t(o.lang, 'col.source'))}</th>
<th scope="col">${esc(t(o.lang, 'col.nodes'))}</th><th scope="col">${esc(t(o.lang, 'plans.cols.oai'))}</th>
<th scope="col">${esc(t(o.lang, 'plans.cols.on'))}</th><th scope="col">${esc(t(o.lang, 'plans.cols.overlaps'))}</th>
<th scope="col">${esc(t(o.lang, 'plans.cols.imported'))}</th></tr>
${rows}</table>` : emptyState(t(o.lang, 'plans.none'))}
</div>`);
}

export function renderPlanPage(o: PlanPageInput): string {
  const { plan } = o;
  const children = new Map<string, PlanNode[]>();
  for (const n of o.nodes) {
    if (!n.parentOutcomeId) continue;
    children.set(n.parentOutcomeId, [...(children.get(n.parentOutcomeId) ?? []), n]);
  }
  const nodeItem = (n: PlanNode): string => {
    const kids = children.get(n.id) ?? [];
    const series = o.checks?.[n.id] ?? [];
    const spark = sparkline(series);
    return `<li>
<strong>${esc(n.label)}</strong>${n.placeId ? ` <span class="muted">· ${esc(n.placeId)}</span>` : ''}
${spark ? ` ${spark}` : n.kind === 'indicator' ? ` <span class="muted">${esc(t(o.lang, 'plans.doc.noreadings'))}</span>` : ''}
${n.description ? `<div class="plan-desc">${md(n.description)}</div>` : ''}
${kids.length ? `<ul>${kids.map(nodeItem).join('')}</ul>` : ''}
</li>`;
  };
  const byKind = new Map<PlanNode['kind'], PlanNode[]>();
  for (const k of KIND_ORDER) byKind.set(k, []);
  for (const n of o.nodes) byKind.get(n.kind)?.push(n);
  // children rendered under their parent — skip them at top level
  const isChild = new Set(o.nodes.filter((n) => n.parentOutcomeId).map((n) => n.id));
  const sections = KIND_ORDER.map((k) => {
    const items = (byKind.get(k) ?? [])
      .filter((n) => !isChild.has(n.id))
      .map(nodeItem).join('\n');
    return items
      ? `<h3>${esc(t(o.lang, `plans.kind.${k}`))} (${(byKind.get(k) ?? []).length})</h3><ul class="plan-nodes">${items}</ul>`
      : '';
  }).join('\n');
  const overlapRows = o.overlaps.slice(0, 20).map((r) => {
    const other = r.nodeIds.find((id) => !o.nodes.some((n) => n.id === id)) ?? r.nodeIds[0];
    return `<li><a href="/collaborate?node=${encodeURIComponent(other)}"><code>${esc(other)}</code></a>
      <span class="badge ${r.status === 'confirmed' || r.status === 'coordinated' ? 'lime' : ''}">${esc(r.status)}</span>
      <span class="muted">${(r.confidence * 100).toFixed(0)}%</span></li>`;
  }).join('\n');
  return pageShell({
    title: `${plan.title} — Springforth`, lang: o.lang, htmx: false,
    extraCss: `.plan-nodes ul{margin:.25rem 0 .5rem 1.2rem}.plan-desc{font-size:.9rem;color:var(--sf-muted)}.plan-desc p{margin:.2rem 0}`,
  }, `<div class="page">
${pageHeader({
    kicker: `${t(o.lang, 'plans.doc.kicker')} · ${plan.source.split(':')[0]}`,
    title: plan.title, em: '',
    lede: `${plan.nodeCount} ${t(o.lang, 'plans.doc.nodes')} · ${plan.overlaps} ${t(o.lang, 'plans.doc.overlaps')} · ${t(o.lang, 'plans.doc.imported')} ${plan.importedAt.slice(0, 10)}`,
    back: { href: '/plans', label: t(o.lang, 'plans.back') },
  })}
${sections || emptyState(t(o.lang, 'plans.none'))}
${o.overlaps.length ? `<h3>${esc(t(o.lang, 'plans.doc.linked'))}</h3><ul>${overlapRows}</ul>` : ''}
</div>`);
}
