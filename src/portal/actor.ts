import type { ActorWallet, Attestation, Donation } from '../core';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, displayName, displayNameText, howItWorks } from './ui.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (title: string, body: string, lang: Lang = 'en') =>
  pageShell({ title: `${title} — Springforth`, htmx: false, lang }, `<div class="page">${body}</div>`);

export interface ActorProfileInput {
  actor: string;
  created: number; joined: number;
  appreciatedBy: number; appreciated: number;
  earned: number; assuranceCredits: number;
  trustScore: number;
  wallets: ActorWallet[];
  donations: Donation[];
  // Appreciations received — rendered as quotable recognitions.
  recognitions?: { from: string; note: string; possibilityId?: string }[];
}

export function renderActorProfile(i: ActorProfileInput, lang: Lang = 'en'): string {
  const wallets = i.wallets.map((w) =>
    `<tr><td><code>${esc(w.address)}</code></td><td class="muted">${esc(w.at.slice(0, 10))}</td></tr>`).join('\n');
  const donations = i.donations.map((d) =>
    `<tr><td><a href="/rounds/${esc(d.roundId)}">${esc(d.roundId)}</a></td>
<td>${esc(d.needNodeId)}</td><td>${d.amount} ${esc(d.currency)}</td>
<td class="muted">${esc(d.settlement)}${d.settlementRef ? ` · <code>${esc(d.settlementRef.slice(0, 18))}…</code>` : ''}</td></tr>`).join('\n');
  const recList = (i.recognitions ?? []).filter((r) => r.note.trim()).map((r) =>
    `<li><em>“${esc(r.note)}”</em> — ${displayName(r.from)}${r.possibilityId ? ` · <a href="/possibilities#${esc(r.possibilityId)}">${esc(t(lang, 'detail.actor.cardLink'))}</a>` : ''}</li>`).join('\n');
  return shell(displayNameText(i.actor), `
${pageHeader({
    kicker: t(lang, 'detail.actor.kicker'),
    title: displayNameText(i.actor),
    back: { href: '/community#people', label: t(lang, 'nav.community') },
  })}
<p class="muted">${esc(t(lang, 'detail.actor.id'))}: <code>${esc(i.actor)}</code></p>
<table><tr><th scope="col">${esc(t(lang, 'col.metric'))}</th><th scope="col">${esc(t(lang, 'col.value'))}</th></tr>
<tr><td>${esc(t(lang, 'detail.actor.cards'))}</td><td>${i.created} / ${i.joined}</td></tr>
<tr><td>${esc(t(lang, 'detail.actor.appreciated'))}</td><td>${i.appreciatedBy} / ${i.appreciated}</td></tr>
<tr><td>${esc(t(lang, 'detail.actor.earned'))}</td><td>${i.earned.toFixed(2)}</td></tr>
<tr><td>${esc(t(lang, 'detail.actor.credits'))}</td><td>${i.assuranceCredits}</td></tr>
<tr><td>${esc(t(lang, 'detail.actor.trust'))}</td><td>${i.trustScore}</td></tr></table>
${recList ? `<h2>${esc(t(lang, 'detail.actor.recognitions'))}</h2><ul>${recList}</ul>` : ''}
${howItWorks(lang, 'how.actor.trust', 's3')}
<h2>${esc(t(lang, 'detail.actor.wallets'))}</h2>
<table><tr><th scope="col">${esc(t(lang, 'col.address'))}</th><th scope="col">${esc(t(lang, 'col.bound'))}</th></tr>
${wallets || `<tr><td colspan="2"><em>${esc(t(lang, 'detail.actor.noWallets'))}</em></td></tr>`}</table>
<h2>${esc(t(lang, 'detail.actor.donations'))}</h2>
<table><tr><th scope="col">${esc(t(lang, 'col.round'))}</th><th scope="col">${esc(t(lang, 'col.need'))}</th><th scope="col">${esc(t(lang, 'col.amount'))}</th><th scope="col">${esc(t(lang, 'col.settlement'))}</th></tr>
${donations || `<tr><td colspan="4"><em>${esc(t(lang, 'detail.actor.noDonations'))}</em></td></tr>`}</table>
<p class="muted">${esc(t(lang, 'detail.actor.bindNote'))}
<code>springforth bind actor:${esc(i.actor)}</code></p>`, lang);
}

export interface DonorPageInput {
  roundId: string; donor: string;
  donations: Donation[];
  receipts: Attestation[];   // springforth.donation.v1 attestations
}

export function renderDonorPage(i: DonorPageInput, lang: Lang = 'en'): string {
  const total = i.donations.reduce((a, d) => a + d.amount, 0);
  const rows = i.donations.map((d) =>
    `<tr><td>${esc(d.needNodeId)}</td><td>${d.amount} ${esc(d.currency)}</td>
<td class="muted">${esc(d.settlement)}</td><td class="muted">${esc(d.at.slice(0, 10))}</td></tr>`).join('\n');
  const receipts = i.receipts.map((a) =>
    `<tr><td><code>${esc(a.id)}</code></td><td class="muted">${a.uid ? `<code>${esc(a.uid.slice(0, 16))}…</code>` : esc(t(lang, 'detail.donor.ledgerRecorded'))}</td></tr>`).join('\n');
  return shell(`${displayNameText(i.donor)} — ${i.roundId}`, `
${pageHeader({
    kicker: t(lang, 'detail.donor.kicker'),
    title: displayNameText(i.donor),
    back: { href: `/rounds/${i.roundId}`, label: t(lang, 'detail.round.kicker') },
  })}
<p class="muted">${i.donations.length} ${esc(t(lang, 'detail.donor.donations'))}, ${total} ${esc(t(lang, 'detail.donor.total'))}, ${esc(t(lang, 'detail.donor.inRound'))}
<a href="/rounds/${esc(i.roundId)}">${esc(i.roundId)}</a>.</p>
<table><tr><th scope="col">${esc(t(lang, 'col.need'))}</th><th scope="col">${esc(t(lang, 'col.amount'))}</th><th scope="col">${esc(t(lang, 'col.settlement'))}</th><th scope="col">${esc(t(lang, 'col.date'))}</th></tr>${rows}</table>
<h2>${esc(t(lang, 'detail.donor.receipts'))}</h2>
<table><tr><th scope="col">${esc(t(lang, 'col.receipt'))}</th><th scope="col">${esc(t(lang, 'col.uid'))}</th></tr>
${receipts || `<tr><td colspan="2"><em>${esc(t(lang, 'detail.donor.noReceipts'))}</em></td></tr>`}</table>`, lang);
}
