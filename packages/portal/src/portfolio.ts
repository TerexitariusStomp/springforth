import { isNeed, triScore, type ExternalPlan, type OverlapRecord, type PlanNode } from '@springforth/coordination';

// /portfolio — the plan portfolio made navigable (overlap-report spec):
// plans as comparable objects — themes, geographies, funding asks, data
// gaps — and the overlap clusters that link them. Every cluster links to
// its evidence; every gap is visible before it becomes a wrong answer.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Union-find over overlap edges → clusters of nodes flagged together.
function clusters(recs: OverlapRecord[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const r of recs) {
    const [a, b] = r.nodeIds;
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  }
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  return [...groups.values()];
}

const money = (n?: number) => (n ? `£${n.toLocaleString('en-GB')}` : '—');

export function renderPortfolioPage(
  plans: ExternalPlan[], nodes: PlanNode[], recs: OverlapRecord[],
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const maxBudget = Math.max(1, ...nodes.map((n) => n.budget ?? 0));

  const planRows = plans.map((p) => {
    const pn = p.nodes ?? nodes.filter((n) => n.source === p.source);
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
<td><strong>${esc(p.title)}</strong><br><small>${esc(p.source)}</small></td>
<td>${pn.length}</td>
<td>${[...places].slice(0, 4).map(esc).join(', ') || '—'}</td>
<td>${money(budget)}</td>
<td>${gaps || 'none'}</td></tr>`;
  }).join('');

  const cl = clusters(recs.filter((r) => r.status !== 'rejected'));
  const clusterCards = cl.map((ids) => {
    const members = ids.map((id) => byId.get(id)).filter((n): n is PlanNode => !!n);
    const linkRecs = recs.filter((r) => r.nodeIds.some((id) => ids.includes(id)));
    const status = new Set(linkRecs.map((r) => r.status));
    const stat = status.has('coordinated') ? 'coordinated'
      : status.has('confirmed') ? 'confirmed' : 'proposed';
    const tris = linkRecs.map((r) => triScore(r, byId, maxBudget));
    const top = tris.reduce((m, t) => Math.max(m, t.strength), 0);
    const membersList = members
      .map((n) => `<li>${esc(n.label)} <small>— ${esc(n.source)}${n.budget ? ` · ${money(n.budget)}` : ''}</small></li>`)
      .join('');
    return `<div class="card">
<h3>${members.map((m) => esc(m.label)).join(' ↔ ') || 'cluster'}</h3>
<p><span class="badge">${stat}</span> <span class="badge">${linkRecs.length} link${linkRecs.length === 1 ? '' : 's'}</span>
<span class="badge">top strength ${(top * 100).toFixed(0)}%</span></p>
<ul>${membersList}</ul>
<p><a href="/coordination">review evidence &amp; validate →</a></p></div>`;
  }).join('\n');

  const needs = nodes.filter(isNeed);
  const offers = nodes.filter((n) => n.kind === 'offer');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Portfolio — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
table{border-collapse:collapse;width:100%;margin:.5rem 0}td,th{border:1px solid #ddd;padding:.4rem;text-align:left;font-size:.85rem}
.badge{background:#e6f4ea;padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem}
.card{border:1px solid #ddd;border-radius:.5rem;padding:1rem;margin:1rem 0}
h2{margin-top:2rem}</style></head><body>
<h1>Plan portfolio</h1>
<p>${plans.length} plans · ${nodes.length} nodes · ${recs.length} overlap records ·
${needs.length} needs · ${offers.length} offers.
<a href="/">home</a> · <a href="/coordination">coordination</a> · <a href="/outcomes">outcomes</a></p>
<h2>Plans</h2>
<table><tr><th>Plan</th><th>Nodes</th><th>Places</th><th>Funding ask</th><th>Data gaps</th></tr>
${planRows || '<tr><td colspan="5"><em>No plans imported yet.</em></td></tr>'}</table>
<h2>Overlap clusters</h2>
<p>Groups of nodes the resolver flagged as related — each cluster is a
coordination opportunity or a deduplication decision awaiting review.</p>
${clusterCards || '<p><em>No clusters yet — run <code>POST /overlaps/detect</code>.</em></p>'}
<footer><small>Springforth — generated ${new Date().toISOString()}</small></footer>
</body></html>`;
}
