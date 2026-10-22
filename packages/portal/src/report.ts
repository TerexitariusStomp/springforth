import type {
  Appreciation, ImpactClaim, OracleCheck, Participation, Possibility,
} from '@springforth/core';
import type { PlanNode } from '@springforth/coordination';
import type { Trajectory } from '@springforth/oracle';
import { pageShell } from './theme.ts';

// /report/:possibilityId — the composed field report. Auto-assembled
// from structured records (report + participants + evidence readings +
// appreciation round + linked claim) — not a free-text narrative
// entity. Every section cites its sources.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderReportPage(opts: {
  possibility: Possibility;
  participants: Participation[];
  nodes: PlanNode[];
  checks: (OracleCheck & { nodeId?: string })[];
  appreciations: Appreciation[];
  claim?: ImpactClaim;
  trajectories: Trajectory[];
}): string {
  const { possibility: p, participants, nodes, checks, appreciations, claim, trajectories } = opts;
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const checksByNode = new Map<string, OracleCheck[]>();
  for (const c of checks) {
    if (!c.nodeId) continue;
    if (!checksByNode.has(c.nodeId)) checksByNode.set(c.nodeId, []);
    checksByNode.get(c.nodeId)!.push(c);
  }
  const evidenceRows = [...checksByNode.entries()].map(([nid, cs]) => {
    const tj = trajectories.find((t) => t.nodeId === nid);
    return `<tr><td>${esc(label.get(nid) ?? nid)}</td><td>${cs.length}</td>
<td>${cs.filter((c) => c.result === 'match').length} match /
${cs.filter((c) => c.result === 'mismatch').length} mismatch</td>
<td>${tj ? `${tj.slopePerDay > 0 ? '+' : ''}${tj.slopePerDay}/day${tj.daysToThreshold != null ? ` · ~${tj.daysToThreshold}d to threshold` : ''}` : '—'}</td></tr>`;
  }).join('\n');
  const appList = appreciations.map((a) =>
    `<li><strong>${esc(a.fromActor)}</strong> → <strong>${esc(a.toActor)}</strong>${a.note ? ` — ${esc(a.note)}` : ''}</li>`).join('\n');
  return pageShell({ title: `Field report — ${p.title}`, htmx: false,
    extraCss: `.box{background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:12px;padding:1.2rem;margin:1rem 0}` },
    `<div class="page">
<h1>Field report — ${esc(p.title)}</h1>
<p class="muted">${esc(p.place ?? '')} · declared by ${esc(p.declarerId)} · status ${esc(p.status)}</p>
${p.report ? `<div class="box"><h2 style="margin-top:0">What happened</h2>
<p>${esc(p.report.summary)}</p>
<p><strong>Evidence:</strong> ${esc(p.report.evidence)}</p>
<p><strong>Learnings:</strong> ${esc(p.report.learnings)}</p></div>` : '<p><em>No completion report filed yet.</em></p>'}
<h2>Who participated</h2>
<p>${participants.length} participant${participants.length === 1 ? '' : 's'}: ${participants.map((x) => esc(x.actor)).join(', ') || '—'}</p>
<h2>Open-evidence readings</h2>
<table><tr><th>Target</th><th>Readings</th><th>Result</th><th>Trend</th></tr>
${evidenceRows || '<tr><td colspan="4"><em>No readings on linked nodes yet.</em></td></tr>'}</table>
<h2>Appreciation round</h2>
<ul>${appList || '<li><em>None recorded.</em></li>'}</ul>
${claim ? `<h2>Impact claim</h2>
<p>Claim <code>${esc(claim.id)}</code> — state <strong>${esc(claim.state)}</strong> —
<a href="/claims/${esc(claim.id)}?format=lexicon">hypercerts lexicon JSON</a>.
${claim.oracleCheckIds.length} evidence checks cited; ${claim.contributors.length} contributors.</p>` : ''}
<p class="muted"><a href="/possibilities#${esc(p.id)}">the card</a> · generated ${new Date().toISOString()}</p>
</div>`);
}
