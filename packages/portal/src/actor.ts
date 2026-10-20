import type { ActorWallet, Attestation, Donation } from '@springforth/core';
import { footer } from './nav.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.45rem;text-align:left;font-size:.92rem}
.muted{color:#666}code{background:#f4f4f4;padding:.1rem .3rem}</style></head><body>
${body}
${footer()}
</body></html>`;

export interface ActorProfileInput {
  actor: string;
  created: number; joined: number;
  appreciatedBy: number; appreciated: number;
  earned: number; assuranceCredits: number;
  trustScore: number;
  wallets: ActorWallet[];
  donations: Donation[];
}

export function renderActorProfile(i: ActorProfileInput): string {
  const wallets = i.wallets.map((w) =>
    `<tr><td><code>${esc(w.address)}</code></td><td class="muted">${esc(w.at.slice(0, 10))}</td></tr>`).join('\n');
  const donations = i.donations.map((d) =>
    `<tr><td><a href="/rounds/${esc(d.roundId)}">${esc(d.roundId)}</a></td>
<td>${esc(d.needNodeId)}</td><td>${d.amount} ${esc(d.currency)}</td>
<td class="muted">${esc(d.settlement)}${d.settlementRef ? ` · <code>${esc(d.settlementRef.slice(0, 18))}…</code>` : ''}</td></tr>`).join('\n');
  return shell(`Actor ${i.actor}`, `
<h1>${esc(i.actor)}</h1>
<table><tr><th>Metric</th><th>Value</th></tr>
<tr><td>Cards declared / joined</td><td>${i.created} / ${i.joined}</td></tr>
<tr><td>Appreciated by / gave</td><td>${i.appreciatedBy} / ${i.appreciated}</td></tr>
<tr><td>Earned recognition</td><td>${i.earned.toFixed(2)}</td></tr>
<tr><td>Assurance credits</td><td>${i.assuranceCredits}</td></tr>
<tr><td>Trust score (EigenTrust, relative to mean)</td><td>${i.trustScore}</td></tr></table>
<h2>Bound wallets</h2>
<table><tr><th>Address</th><th>Bound</th></tr>
${wallets || '<tr><td colspan="2"><em>None — POST /actors/:id/bind-wallet with an EIP-191 signature.</em></td></tr>'}</table>
<h2>Donations</h2>
<table><tr><th>Round</th><th>Need</th><th>Amount</th><th>Settlement</th></tr>
${donations || '<tr><td colspan="4"><em>No donations recorded.</em></td></tr>'}</table>
<p class="muted">Wallet binding proves address control — sign
<code>springforth bind actor:${esc(i.actor)}</code> in your wallet, then POST
<code>{actor, address, signature}</code>.</p>`);
}

export interface DonorPageInput {
  roundId: string; donor: string;
  donations: Donation[];
  receipts: Attestation[];   // springforth.donation.v1 attestations
}

export function renderDonorPage(i: DonorPageInput): string {
  const total = i.donations.reduce((a, d) => a + d.amount, 0);
  const rows = i.donations.map((d) =>
    `<tr><td>${esc(d.needNodeId)}</td><td>${d.amount} ${esc(d.currency)}</td>
<td class="muted">${esc(d.settlement)}</td><td class="muted">${esc(d.at.slice(0, 10))}</td></tr>`).join('\n');
  const receipts = i.receipts.map((a) =>
    `<tr><td><code>${esc(a.id)}</code></td><td class="muted">${a.uid ? `<code>${esc(a.uid.slice(0, 16))}…</code>` : 'ledger-recorded'}</td></tr>`).join('\n');
  return shell(`Donor ${i.donor} — ${i.roundId}`, `
<h1>${esc(i.donor)}</h1>
<p class="muted">${i.donations.length} donation(s), ${total} total, in round
<a href="/rounds/${esc(i.roundId)}">${esc(i.roundId)}</a>.</p>
<table><tr><th>Need</th><th>Amount</th><th>Settlement</th><th>Date</th></tr>${rows}</table>
<h2>Recognition receipts</h2>
<table><tr><th>Receipt</th><th>On-chain uid</th></tr>
${receipts || '<tr><td colspan="2"><em>Receipts are issued when settlement confirms on-chain.</em></td></tr>'}</table>`);
}
