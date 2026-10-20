import type { Donation, FundingRound, RoundApplication } from '@springforth/core';
import type { PlanNode } from '@springforth/coordination';
import type { NodeMatch } from '@springforth/funding';
import { footer } from './nav.ts';

// /rounds — quadratic funding rounds (Liberal Radicalism; Gitcoin/Allo
// public mechanism): donors give small amounts to financial needs the
// coordination layer surfaced; a sponsor matching fund distributes by
// breadth of support — (Σ√cᵢ)² — not size of gift.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MONEY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Springforth</title>
<style>body{font-family:system-ui,sans-serif;overflow-x:auto;max-width:64rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.45rem;text-align:left;font-size:.92rem}
.badge{padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem;background:#dfe}
.muted{color:#666}.bar{background:#e8f4e8;border-radius:.3rem;padding:.15rem .5rem;display:inline-block}
input,button{font:inherit;padding:.4rem .6rem;margin:.2rem 0}</style></head><body>
${body}
${footer()}
</body></html>`;

export function renderRoundsPage(rounds: FundingRound[]): string {
  const rows = rounds.map((r) => `<tr>
<td><a href="/rounds/${esc(r.id)}">${esc(r.title)}</a></td>
<td>${esc(r.matchingFund.currency)} ${MONEY.format(r.matchingFund.amount)}</td>
<td>${r.eligibleNeedIds.length}</td>
<td><span class="badge">${esc(r.state)}</span></td>
<td class="muted">${esc(r.closesAt.slice(0, 10))}</td></tr>`).join('\n');
  return shell('Funding rounds', `
<h1>Funding rounds</h1>
<p>Small donations attract a sponsor matching fund allocated by
<strong>quadratic matching</strong> — breadth of support counts, not size of
gift. Donations are records of intent; settlement rides external rails.
Mechanism: Weyl–Buterin–Hitzig "Liberal Radicalism" (2018), as run by
Gitcoin Grants / Allo Protocol.</p>
<table><tr><th>Round</th><th>Matching fund</th><th>Eligible needs</th><th>State</th><th>Closes</th></tr>
${rows || '<tr><td colspan="5"><em>No rounds yet — POST /rounds (admin) opens one.</em></td></tr>'}</table>`);
}

export function renderRoundPage(
  round: FundingRound, donations: Donation[], allocation: NodeMatch[], nodes: PlanNode[],
): string {
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const maxTotal = Math.max(...allocation.map((a) => a.total), 1);
  const rows = allocation.map((a) => {
    const pct = Math.round((a.total / maxTotal) * 100);
    return `<tr>
<td>${esc(label.get(a.needNodeId) ?? a.needNodeId)}</td>
<td>${a.donorCount}</td>
<td>${MONEY.format(a.donations)}</td>
<td>${MONEY.format(a.match)}</td>
<td><span class="bar" style="min-width:${pct}%">${MONEY.format(a.total)}</span></td>
<td><form method="post" action="/rounds/${esc(round.id)}/donate" style="display:inline">
<input type="hidden" name="needNodeId" value="${esc(a.needNodeId)}">
<input name="donor" placeholder="name" required style="width:8rem">
<input name="amount" type="number" min="1" step="any" placeholder="amt" required style="width:5rem">
<button ${round.state === 'open' ? '' : 'disabled'}>donate</button></form></td></tr>`;
  }).join('\n');
  const donors = new Set(donations.map((d) => d.donor)).size;
  return shell(round.title, `
<h1>${esc(round.title)}</h1>
<p class="muted">${esc(round.description)} Matching fund:
<strong>${esc(round.matchingFund.currency)} ${MONEY.format(round.matchingFund.amount)}</strong> ·
state <strong>${esc(round.state)}</strong> ·
mechanism <strong>${round.matchingMode === 'pairwise' ? 'pairwise (collusion-discounted)' : 'quadratic'}${round.conviction ? ' + conviction' : ''}</strong> ·
closes ${esc(round.closesAt.slice(0, 10))} ·
${donations.length} donation${donations.length === 1 ? '' : 's'} from ${donors} donor${donors === 1 ? '' : 's'}.</p>
<p>Match column = the round's allocation preview: <em>(Σ√donations)²</em>
per need, scaled to the fund. Ten small donors outweigh one large one —
that is the point of the mechanism.</p>
<table><tr><th>Need</th><th>Donors</th><th>Given</th><th>Match</th><th>Total</th><th>Donate</th></tr>
${rows || '<tr><td colspan="6"><em>No eligible needs.</em></td></tr>'}</table>
<p class="muted"><a href="/rounds">all rounds</a> · JSON: <code>?format=json</code> ·
<a href="/rounds/${esc(round.id)}/admin">operator</a></p>`);
}

// Operator console for a round — pending applications with approve/
// reject actions, close control. Admin-gated at the route layer;
// the page is just the form surface.
export function renderRoundAdmin(
  round: FundingRound, applications: RoundApplication[], nodes: PlanNode[],
): string {
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const rows = applications.map((a) => `<tr>
<td>${esc(label.get(a.needNodeId) ?? a.needNodeId)}</td>
<td>${esc(a.applicant)}</td>
<td class="muted">${esc(a.statement || '—')}</td>
<td><span class="badge">${esc(a.state)}</span></td>
<td>${a.state === 'pending' ? `
<form method="post" action="/rounds/${esc(round.id)}/applications/${esc(a.id)}/review" style="display:inline">
<input type="hidden" name="approve" value="true"><button>approve</button></form>
<form method="post" action="/rounds/${esc(round.id)}/applications/${esc(a.id)}/review" style="display:inline">
<input type="hidden" name="approve" value="false"><button>reject</button></form>` : ''}</td></tr>`).join('\n');
  return shell(`${round.title} — operator`, `
<h1>Operator — ${esc(round.title)}</h1>
<p class="muted">${applications.filter((a) => a.state === 'pending').length} pending application(s) ·
round is <strong>${esc(round.state)}</strong></p>
<table><tr><th>Need</th><th>Applicant</th><th>Statement</th><th>State</th><th>Review</th></tr>
${rows || '<tr><td colspan="5"><em>No applications yet.</em></td></tr>'}</table>
${round.state === 'open' ? `
<form method="post" action="/rounds/${esc(round.id)}/close" style="margin-top:1rem">
<button>Close round (freeze allocation)</button></form>` : ''}
<p class="muted"><a href="/rounds/${esc(round.id)}">back to round</a></p>`);
}
