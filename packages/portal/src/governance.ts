import type { GovernanceBallot, GovernanceParam, GovernanceProposal } from '@springforth/core';
import { footer } from './nav.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.45rem;text-align:left;font-size:.92rem}
.muted{color:#666}.badge{padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem;background:#dfe}
input,button{font:inherit;padding:.4rem .6rem;margin:.2rem 0}</style></head><body>
${body}
${footer()}
</body></html>`;

export interface GovernancePageInput {
  proposals: GovernanceProposal[];
  ballots: GovernanceBallot[];
  params: GovernanceParam[];
  governable: Record<string, { default: string; describe: string }>;
  voterCount: number;
}

export function renderGovernancePage(i: GovernancePageInput): string {
  const propRows = i.proposals.map((p) => {
    const bs = i.ballots.filter((b) => b.proposalId === p.id);
    const forW = bs.filter((b) => b.support).reduce((a, b) => a + Math.sqrt(b.points), 0);
    const againstW = bs.filter((b) => !b.support).reduce((a, b) => a + Math.sqrt(b.points), 0);
    return `<tr>
<td><strong>${esc(p.title)}</strong><br><small class="muted">${esc(p.param)} → ${esc(p.proposedValue)}</small></td>
<td><span class="badge">${esc(p.state)}</span></td>
<td>${forW.toFixed(2)} / ${againstW.toFixed(2)}</td>
<td class="muted">${esc(p.closesAt.slice(0, 10))}</td>
<td>${p.state === 'open' ? `
<form method="post" action="/governance/${esc(p.id)}/vote" style="display:inline">
<input name="voter" placeholder="actor" required style="width:7rem">
<input name="points" type="number" min="1" step="1" value="1" style="width:4rem">
<button name="support" value="true">for</button>
<button name="support" value="false">against</button></form>` : ''}</td></tr>`;
  }).join('\n');
  const paramRows = Object.entries(i.governable).map(([k, g]) => {
    const cur = i.params.find((p) => p.id === k);
    return `<tr><td><code>${esc(k)}</code></td><td>${esc(cur?.value ?? g.default)}</td>
<td class="muted">${esc(g.describe)}${cur ? ` · set by ${esc(cur.setBy)}` : ' · default'}</td></tr>`;
  }).join('\n');
  return shell('Governance', `
<h1>Governance</h1>
<p>Parameter votes by the EigenTrust-eligible cohort — standing in the
appreciation graph is the franchise, not a token. Ballots cost points;
weight is √points, so broad conviction beats deep pockets.
${i.voterCount} eligible voter(s) today.</p>
<h2>Proposals</h2>
<table><tr><th>Proposal</th><th>State</th><th>For / Against (√pts)</th><th>Closes</th><th>Vote</th></tr>
${propRows || '<tr><td colspan="5"><em>No proposals.</em></td></tr>'}</table>
<h3>Propose a change</h3>
<form method="post" action="/governance/proposals">
<select name="param">${Object.keys(i.governable).map((k) => `<option>${esc(k)}</option>`).join('')}</select>
<input name="title" placeholder="title" required>
<input name="proposedValue" placeholder="new value" required>
<input name="proposer" placeholder="actor" required>
<button>propose</button></form>
<h2>Parameters</h2>
<table><tr><th>Param</th><th>Current</th><th>Meaning</th></tr>${paramRows}</table>`);
}
