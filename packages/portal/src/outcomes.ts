import type { OverlapRecord, PlanNode } from '@springforth/coordination';
import { footer } from './nav.ts';

// /outcomes — the common outcome layer (overlap-report spec): "who else
// is trying to achieve the same thing, and which existing actions could
// contribute or strengthen it?" Outcomes cluster by canonical label and
// by resolver-confirmed overlap; every entry traces back to source plans.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderOutcomesPage(
  nodes: PlanNode[], recs: OverlapRecord[], indicators: PlanNode[],
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outcomes = nodes.filter((n) => n.kind === 'outcome');

  // Cluster outcomes: same canonical text, or linked by an overlap record —
  // directly, or through an overlapped action that points at the outcome
  // (county says the same thing differently; the action link proves it).
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

  const cards = groups.map((g) => {
    const pursuers = g.map((o) =>
      `<a href="/coordination?node=${encodeURIComponent(o.id)}">${esc(o.label)}</a> <small>(${esc(o.source)}${o.orgIds.length ? ` · ${esc(o.orgIds.join(', '))}` : ''})</small>`).join(', ');
    // Contributing actions — parentOutcomeId edges from any source.
    const actions = nodes.filter((n) =>
      n.kind === 'action' && n.parentOutcomeId && g.some((o) => o.id === n.parentOutcomeId));
    const actionList = actions.map((a) =>
      `<li>${esc(a.label)} <small>— ${esc(a.source)}${a.timeframe.from ? ` · ${esc(a.timeframe.from)}` : ''}</small></li>`).join('');
    // Linked overlap records touching any member — provenance.
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
<p>${g.length > 1 ? `<span class="badge">${g.length} pursuing this outcome</span> ` : ''}${stat ? `<span class="badge">${stat}</span>` : ''}</p>
<p><strong>Who:</strong> ${pursuers}</p>
${actionList ? `<p><strong>Actions that could strengthen it:</strong></p><ul>${actionList}</ul>`
  : '<p><em>No actions point at this outcome yet — a contribution gap.</em></p>'}
${indList ? `<p><strong>Indicators:</strong> ${indList}</p>` : ''}
</div>`;
  }).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Outcomes — Springforth</title>
<style>body{font-family:system-ui,sans-serif;overflow-x:auto;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
.badge{background:#e6f4ea;padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem}
.card{border:1px solid #ddd;border-radius:.5rem;padding:1rem;margin:1rem 0}
small{color:#555}</style></head><body>
<h1>Common outcome layer</h1>
<p>Who else is pursuing each outcome, and which existing actions could
strengthen it — every entry traces to its source plan.
<a href="/">home</a> · <a href="/portfolio">portfolio</a> · <a href="/coordination">coordination</a></p>
${cards || '<p><em>No outcome nodes yet — import plans with outcomes (markdown, OnePlanet).</em></p>'}
${footer()}
</body></html>`;
}
