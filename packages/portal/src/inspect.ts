// Inspection surfaces — HTML views for backend resources that previously
// only answered JSON. Each is a read-only table/stat page in the standard
// shell; the JSON form stays available to API clients on the same route.
import { pageShell } from './theme.ts';

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONEY = new Intl.NumberFormat('en-US');
const short = (h?: string) => (h ? `${esc(h.slice(0, 12))}…` : '—');
const when = (iso?: string) => (iso ? esc(iso.replace('T', ' ').slice(0, 19)) : '—');

const statGrid = `.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin:1.5rem 0}
.stat-grid .stat{background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:12px;padding:1rem 1.2rem}
.stat-grid .stat b{display:block;font-size:1.6rem;font-family:var(--sf-display)}
.stat-grid .stat span{font-size:.8rem;color:var(--sf-ink-2)}`;

/* ── ledger ─────────────────────────────────────────────────────────── */

interface LedgerEventRow { seq: number; at: string; actor: string; kind: string; payload: unknown; prev_hash: string; hash: string }
interface LedgerVerify { ok: boolean; events?: number; brokenAt?: number }

export function renderLedgerPage(events: LedgerEventRow[], verify: LedgerVerify): string {
  return pageShell({ title: 'Ledger — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Audit trail</span>
<h1>The <em>ledger</em></h1>
<p class="lede">Every state transition — declarations, joins, quorums, appreciations,
donations, attestations — appended in order and hash-chained. Chain tip is
anchored to Bitcoin via OpenTimestamps.</p>
<p>${verify.ok
  ? `<strong style="color:var(--sf-green-3)">✓ chain verified</strong> — ${verify.events} events, every hash commits to its predecessor.`
  : `<strong style="color:var(--sf-coral)">✗ chain broken at event ${verify.brokenAt}</strong>`}
· <a href="/ledger/verify">verify independently</a> · <a href="/ledger?format=json">JSON</a></p>
<table>
<tr><th>#</th><th>at</th><th>event</th><th>actor</th><th>hash</th></tr>
${[...events].reverse().map((e) => `<tr>
<td>${e.seq}</td><td class="muted">${when(e.at)}</td>
<td><code>${esc(e.kind)}</code></td><td>${esc(e.actor)}</td>
<td class="muted" title="${esc(e.hash)}"><code>${short(e.hash)}</code></td>
</tr>`).join('')}
</table>
</div>`);
}

export function renderLedgerVerifyPage(v: LedgerVerify): string {
  return pageShell({ title: 'Verify — Springforth', htmx: false, extraCss: statGrid }, `<div class="page">
<span class="kicker">Integrity check</span>
<h1>${v.ok ? 'Chain <em>verified</em>' : 'Chain <em>broken</em>'}</h1>
<p class="lede">${v.ok
  ? `All ${v.events} ledger events checked — every <code>prev_hash</code> matches its predecessor and every payload rehashes correctly.`
  : `Verification failed at event #${v.brokenAt} — the chain was tampered with or corrupted.`}</p>
<div class="stat-grid">
<div class="stat"><b>${v.events ?? '—'}</b><span>events checked</span></div>
<div class="stat"><b>${v.ok ? '✓' : '✗'}</b><span>integrity</span></div>
<div class="stat"><b>OTS</b><span>Bitcoin-anchored tip</span></div>
</div>
<p class="muted"><a href="/ledger">browse the ledger</a> · <a href="/ledger/verify?format=json">JSON</a></p>
</div>`);
}

/* ── commitments / resources / overlaps-adjacent ─────────────────────── */

interface CommitmentRow {
  id: string; role: string; label: string; capital?: string;
  source?: string; placeId?: string; offersMatched?: number; inferred?: boolean;
}

export function renderCommitmentsPage(rows: CommitmentRow[], byCapital: Record<string, number>): string {
  return pageShell({ title: 'Commitments — Springforth', htmx: false, extraCss: statGrid }, `<div class="page">
<span class="kicker">Offers &amp; needs</span>
<h1>The <em>commitments</em></h1>
<p class="lede">Every published offer and open need across plans and possibilities —
the CLC commitment vocabulary: a voucher is a published offer, not proof of delivery.</p>
${Object.keys(byCapital).length ? `<div class="stat-grid">${Object.entries(byCapital)
  .map(([k, n]) => `<div class="stat"><b>${n}</b><span>${esc(k)} capital</span></div>`).join('')}</div>` : ''}
<table>
<tr><th>role</th><th>commitment</th><th>capital</th><th>place</th><th>source</th><th>matched</th></tr>
${rows.map((r) => `<tr>
<td><span class="badge" style="background:${r.role === 'offer' ? 'var(--sf-lime-soft)' : 'var(--sf-coral-soft)'}">${r.role}${r.inferred ? ' · inferred' : ''}</span></td>
<td>${esc(r.label)}</td><td class="muted">${esc(r.capital ?? '—')}</td>
<td class="muted">${esc(r.placeId ?? '—')}</td><td class="muted">${esc(r.source ?? '—')}</td>
<td>${r.role === 'need' ? (r.offersMatched ?? 0) : '—'}</td>
</tr>`).join('')}
</table>
<p class="muted"><a href="/coordination">coordination</a> · <a href="/commitments?format=json">JSON</a></p>
</div>`);
}

interface ResourceRow { id: string; label: string; owner: string; terms?: string; capital?: string; timesContributed: number; source?: string }

export function renderResourcesPage(rows: ResourceRow[]): string {
  return pageShell({ title: 'Resource commons — Springforth', htmx: false }, `<div class="page">
<span class="kicker">The commons</span>
<h1>Resource <em>commons</em></h1>
<p class="lede">Everything the community has already offered — each <code>bring</code>
from every card accumulates here. Times contributed counts coordinated complements.</p>
<table>
<tr><th>resource</th><th>owner</th><th>capital</th><th>terms</th><th>contributed</th><th>source</th></tr>
${rows.map((r) => `<tr>
<td>${esc(r.label)}</td><td>${esc(r.owner)}</td><td class="muted">${esc(r.capital ?? '—')}</td>
<td class="muted">${esc(r.terms ?? '—')}</td><td>${r.timesContributed}×</td>
<td class="muted">${esc(r.source ?? '—')}</td>
</tr>`).join('')}
</table>
<p class="muted"><a href="/portfolio">portfolio</a> · <a href="/resources?format=json">JSON</a></p>
</div>`);
}

/* ── trust / metrics / retro ─────────────────────────────────────────── */

interface TrustEdge { from: string; to: string; weight: number; mutual: number }

export function renderTrustPage(edges: TrustEdge[], rule: string): string {
  const sorted = [...edges].sort((a, b) => b.mutual - a.mutual || b.weight - a.weight);
  return pageShell({ title: 'Trust graph — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Earned, not claimed</span>
<h1>The <em>trust graph</em></h1>
<p class="lede">${esc(rule)}</p>
<table>
<tr><th>from</th><th>to</th><th>a → b</th><th>mutual</th></tr>
${sorted.map((e) => `<tr>
<td><a href="/actors/${esc(e.from)}">${esc(e.from)}</a></td>
<td><a href="/actors/${esc(e.to)}">${esc(e.to)}</a></td>
<td>${e.weight}</td><td><strong>${e.mutual}</strong></td>
</tr>`).join('')}
</table>
<p class="muted">Mutual recognition = <code>min(a→b, b→a)</code> — trust counts only
where it runs both ways. <a href="/trust?format=json">JSON</a></p>
</div>`);
}

export function renderMetricsPage(m: Record<string, unknown>): string {
  const vals = (m.valueByCurrency ?? {}) as Record<string, Record<string, number>>;
  const scalars = Object.entries(m).filter(([, v]) => typeof v === 'number');
  return pageShell({ title: 'Metrics — Springforth', htmx: false, extraCss: statGrid }, `<div class="page">
<span class="kicker">Network health</span>
<h1>The <em>metrics</em></h1>
<p class="lede">North-star and funnel metrics, computed from the live stores at request time.</p>
<div class="stat-grid">${scalars.map(([k, v]) =>
  `<div class="stat"><b>${typeof v === 'number' && v < 1 && v > 0 ? `${Math.round(v * 100)}%` : MONEY.format(v as number)}</b><span>${esc(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</span></div>`).join('')}</div>
${Object.keys(vals).length ? `<h2>Value by currency</h2>
<table><tr><th>currency</th>${Object.keys(Object.values(vals)[0]!).map((k) => `<th>${esc(k)}</th>`).join('')}</tr>
${Object.entries(vals).map(([cur, row]) => `<tr><td><strong>${esc(cur)}</strong></td>
${Object.values(row).map((v) => `<td>${MONEY.format(v)}</td>`).join('')}</tr>`).join('')}</table>` : ''}
<p class="muted"><a href="/metrics?format=json">JSON</a></p>
</div>`);
}

interface RetroRoundRow { id: string; title: string; fund?: { amount: number; currency: string }; claimIds?: string[]; ballotClose?: string; state?: string }

export function renderRetroPage(rounds: RetroRoundRow[], badgeholders: string[], rule: string): string {
  return pageShell({ title: 'Retroactive rounds — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Fund what worked</span>
<h1><em>Retroactive</em> allocation</h1>
<p class="lede">${esc(rule)}</p>
<table>
<tr><th>round</th><th>fund</th><th>claims</th><th>ballot closes</th><th>state</th></tr>
${rounds.map((r) => `<tr>
<td><a href="/retro/${esc(r.id)}">${esc(r.title || r.id)}</a></td>
<td>${r.fund ? `${MONEY.format(r.fund.amount)} ${esc(r.fund.currency)}` : '—'}</td>
<td>${r.claimIds?.length ?? 0}</td><td class="muted">${when(r.ballotClose)}</td>
<td><span class="badge">${esc(r.state ?? '—')}</span></td>
</tr>`).join('')}
</table>
${badgeholders.length ? `<h2>Badgeholders</h2>
<p class="muted">${badgeholders.map((b) => `<a href="/actors/${esc(b)}"><code>${esc(b)}</code></a>`).join(' · ')}</p>` : ''}
<p class="muted"><a href="/rounds">funding rounds</a> · <a href="/retro?format=json">JSON</a></p>
</div>`);
}

/* ── agent ───────────────────────────────────────────────────────────── */

interface AgentOut { answer: string; citedNodeIds: string[]; citedOverlapIds: string[]; intent: string }

export function renderAgentPage(q: string, out?: AgentOut): string {
  return pageShell({ title: 'Agent — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Ask the coordination graph</span>
<h1>The <em>agent</em></h1>
<p class="lede">A tool-bounded reader over stored plans, overlaps, signals, and trust —
deterministic parsing, every answer cites the records it used.</p>
<form method="get" action="/agent" style="display:flex;gap:.6rem;max-width:40rem;align-items:center">
<input type="search" name="q" value="${esc(q)}" placeholder="what overlaps in Thorntree?" aria-label="Ask the agent" style="flex:1;margin:0">
<button type="submit" style="width:auto;flex:none;padding:.6rem 2rem">Ask</button>
</form>
${out ? `<div class="card" style="margin-top:1.5rem;padding:1.2rem 1.4rem;border:1px solid var(--sf-line-2);border-radius:12px">
<span class="kicker">${esc(out.intent)}</span>
<p style="margin:.5rem 0 0">${esc(out.answer)}</p>
${out.citedNodeIds.length || out.citedOverlapIds.length ? `<p class="muted" style="margin-top:.8rem;font-size:.85rem">
Cited: ${[...out.citedOverlapIds, ...out.citedNodeIds].map((id) => `<code>${esc(id)}</code>`).join(' ')}</p>` : ''}
</div>` : ''}
<p class="muted" style="margin-top:1.5rem"><a href="/agent?q=${encodeURIComponent(q)}&format=json">JSON</a> · machine clients POST the same <code>q</code>.</p>
</div>`);
}

/* ── actors / claims / attestations / pledges ────────────────────────── */

interface ActorRow { id: string; created: number; joined: number; earned: number; trustScore: number }

export function renderActorsPage(rows: ActorRow[]): string {
  const sorted = [...rows].sort((a, b) => b.earned - a.earned || b.trustScore - a.trustScore);
  return pageShell({ title: 'Actors — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Who's in the graph</span>
<h1>The <em>actors</em></h1>
<p class="lede">Every identity that has declared, joined, appreciated, or attested —
one identity space across web, wallet, and Telegram.</p>
<table>
<tr><th>actor</th><th>declared</th><th>joined</th><th>earned recognition</th><th>trust score</th></tr>
${sorted.map((a) => `<tr>
<td><a href="/actors/${esc(a.id)}"><code>${esc(a.id)}</code></a></td>
<td>${a.created}</td><td>${a.joined}</td><td>${a.earned}</td><td>${a.trustScore}</td>
</tr>`).join('')}
</table>
<p class="muted"><a href="/trust">trust graph</a> · <a href="/coordination">coordination</a></p>
</div>`);
}

interface ClaimRow { id: string; workScope?: string; possibilityId?: string; timeframe?: { from?: string; to?: string }; nodeIds?: string[] }

export function renderClaimsPage(claims: ClaimRow[]): string {
  return pageShell({ title: 'Claims — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Stated outcomes</span>
<h1>Impact <em>claims</em></h1>
<p class="lede">Each claim is only as strong as its evidence panel — open it to see
the attestations and oracle readings that back it.</p>
<table>
<tr><th>claim</th><th>scope</th><th>window</th><th>nodes</th></tr>
${claims.map((c) => `<tr>
<td><a href="/claims/${esc(c.id)}"><code>${esc(c.id)}</code></a></td>
<td>${esc(c.workScope ?? '—')}</td>
<td class="muted">${when(c.timeframe?.from)} → ${when(c.timeframe?.to)}</td>
<td>${c.nodeIds?.length ?? 0}</td>
</tr>`).join('')}
</table>
<p class="muted"><a href="/outcomes">outcomes</a> · <a href="/verify">verification</a></p>
</div>`);
}

interface AttestationRow { id: string; claimId?: string; nodeId?: string; attester: string; schemaRef: string; at: string; uid?: string }

export function renderAttestationsPage(atts: AttestationRow[]): string {
  return pageShell({ title: 'Attestations — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Vouched</span>
<h1>The <em>attestations</em></h1>
<p class="lede">Independent vouchers for claims and node outcomes — some mirrored
on-chain (EAS uid), all on the ledger.</p>
<table>
<tr><th>attester</th><th>subject</th><th>schema</th><th>at</th><th>chain</th></tr>
${atts.map((a) => `<tr>
<td><a href="/actors/${esc(a.attester)}">${esc(a.attester)}</a></td>
<td>${a.claimId ? `<a href="/claims/${esc(a.claimId)}"><code>${esc(a.claimId)}</code></a>` : `<code>${esc(a.nodeId ?? '—')}</code>`}</td>
<td class="muted"><code>${esc(a.schemaRef)}</code></td><td class="muted">${when(a.at)}</td>
<td>${a.uid ? `<code>${short(a.uid)}</code>` : 'ledger'}</td>
</tr>`).join('')}
</table>
<p class="muted"><a href="/claims">claims</a> · <a href="/attestations?format=json">JSON</a></p>
</div>`);
}

interface PledgeRow { id: string; possibilityId: string; pledger: string; amount: number; currency: string; state: string; stateAt?: string }

export function renderPledgesPage(pledges: PledgeRow[]): string {
  return pageShell({ title: 'Pledges — Springforth', htmx: false }, `<div class="page">
<span class="kicker">Dominant assurance</span>
<h1>The <em>pledges</em></h1>
<p class="lede">Commitments that bind only if the campaign succeeds — funders are
never exposed to a failed raise.</p>
<table>
<tr><th>pledger</th><th>amount</th><th>possibility</th><th>state</th></tr>
${pledges.map((p) => `<tr>
<td><a href="/actors/${esc(p.pledger)}">${esc(p.pledger)}</a></td>
<td><strong>${MONEY.format(p.amount)} ${esc(p.currency)}</strong></td>
<td><a href="/possibilities#${esc(p.possibilityId)}"><code>${esc(p.possibilityId)}</code></a></td>
<td><span class="badge">${esc(p.state)}</span></td>
</tr>`).join('')}
</table>
<p class="muted"><a href="/rounds">funding rounds</a> · <a href="/pledges?format=json">JSON</a></p>
</div>`);
}
