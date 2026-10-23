import type { DemandGate, Donation, FundingRound, RoundApplication } from '../core';
import type { PlanNode } from '../coordination';
import type { NodeMatch } from '../funding/index';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, howItWorks, displayName } from './ui.ts';

// /rounds — quadratic funding rounds: donors give small amounts to
// financial needs the coordination layer surfaced; a sponsor matching
// fund distributes by breadth of support — (Σ√cᵢ)² — not size of gift.
// The mechanism attribution lives in a how-note, not the lede.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MONEY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const shell = (title: string, body: string, lang: Lang = 'en') =>
  pageShell({ title: `${title} — Springforth`, htmx: false, lang }, `<div class="page">${body}</div>`);

// Retired /rounds list view — the browser route redirects to
// /fund#rounds, so this renderer is kept only for the smoke tests.
export function renderRoundsPage(
  rounds: FundingRound[], donations: Donation[] = [],
  gates?: Map<string, DemandGate>,
  endowment?: { accrued: Record<string, number>; principal: Record<string, number> },
  lang: Lang = 'en',
): string {
  const fmt = (o: Record<string, number>) => Object.entries(o).filter(([, v]) => v > 0)
    .map(([c, v]) => `${esc(c)} ${MONEY.format(Math.round(v * 100) / 100)}`).join(' · ');
  const rows = rounds.filter((r) => !r.endowment).map((r) => {
    const g = gates?.get(r.id);
    const gate = g?.gated
      ? g.active
        ? ` <span class="badge">${esc(t(lang, 'hub.fund.rounds.demandMet'))} — ${g.backers.length} ${esc(t(lang, 'hub.fund.rounds.backers'))} · ${MONEY.format(g.pledged)} ${esc(t(lang, 'hub.fund.rounds.pledged'))}</span>`
        : ` <span class="badge" style="background:var(--sf-gold-soft)">${esc(t(lang, 'hub.fund.rounds.matchingLocked'))} — ${g.backers.length}/${g.minBackers} ${esc(t(lang, 'hub.fund.rounds.backers'))} · ${MONEY.format(g.pledged)}/${MONEY.format(g.goal)} ${esc(t(lang, 'hub.fund.rounds.pledged'))}</span>`
      : '';
    const skim = r.skimBps ? ` <span class="muted">· ${r.skimBps / 100}% ${esc(t(lang, 'hub.fund.rounds.skim'))}</span>` : '';
    return `<tr>
<td><a href="/rounds/${esc(r.id)}">${esc(r.title)}</a>${gate}${skim}</td>
<td>${esc(r.matchingFund.currency)} ${MONEY.format(r.matchingFund.amount)}</td>
<td>${r.eligibleNeedIds.length}</td>
<td><span class="badge">${esc(t(lang, `status.${r.state}`))}</span></td>
<td class="muted" style="white-space:nowrap">${esc(r.closesAt.slice(0, 10))}</td></tr>`;
  }).join('\n');
  const accruedStr = endowment ? fmt(endowment.accrued) : '';
  const principalStr = endowment ? fmt(endowment.principal) : '';
  const endowCard = accruedStr || principalStr ? `
<h2>${esc(t(lang, 'hub.fund.endowment.t'))}</h2>
<p class="muted">${esc(t(lang, 'hub.fund.endowment.principal'))} <strong>${principalStr || '—'}</strong> ·
${esc(t(lang, 'hub.fund.endowment.accrued'))} <strong>${accruedStr || '—'}</strong> —
${esc(t(lang, 'hub.fund.endowment.body'))}</p>` : '';
  // Committed totals per currency — never converted, side by side.
  const byCur = new Map<string, number>();
  for (const d of donations) byCur.set(d.currency, (byCur.get(d.currency) ?? 0) + d.amount);
  const totals = [...byCur.entries()]
    .map(([c, a]) => `${esc(c)} ${MONEY.format(a)}`).join(' · ');
  return shell(t(lang, 'nav.rounds'), `
${pageHeader({
    kicker: t(lang, 'detail.round.kicker'),
    title: t(lang, 'nav.rounds'),
    back: { href: '/fund#rounds', label: t(lang, 'nav.fund') },
  })}
<p>${esc(t(lang, 'hub.fund.rounds.lede'))}</p>
${howItWorks(lang, 'how.rounds.lr', 's5')}
${totals ? `<p class="muted">${esc(t(lang, 'hub.fund.rounds.committed'))} <strong>${totals}</strong> —
${esc(t(lang, 'hub.fund.rounds.converted'))}.</p>` : ''}
<table><tr><th scope="col">${esc(t(lang, 'col.round'))}</th><th scope="col">${esc(t(lang, 'detail.round.matchingFund'))}</th><th scope="col">${esc(t(lang, 'detail.round.eligible'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th><th scope="col">${esc(t(lang, 'col.closes'))}</th></tr>
${rows || `<tr><td colspan="5"><em>${esc(t(lang, 'hub.fund.rounds.none'))}</em></td></tr>`}</table>
${endowCard}`, lang);
}

export function renderRoundPage(
  round: FundingRound, donations: Donation[], allocation: NodeMatch[], nodes: PlanNode[],
  lang: Lang = 'en',
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
<input name="donor" placeholder="${esc(t(lang, 'form.name'))}" required style="width:8rem" aria-label="${esc(t(lang, 'form.name'))}">
<input name="amount" type="number" min="1" step="any" placeholder="${esc(t(lang, 'col.amount'))}" required style="width:5rem" aria-label="${esc(t(lang, 'col.amount'))}">
<button ${round.state === 'open' ? '' : 'disabled'}>${esc(t(lang, 'col.donate').toLowerCase())}</button></form></td></tr>`;
  }).join('\n');
  const donors = new Set(donations.map((d) => d.donor)).size;
  return shell(round.title, `
${pageHeader({
    kicker: t(lang, 'detail.round.kicker'),
    title: round.title,
    back: { href: '/fund#rounds', label: t(lang, 'nav.fund') },
  })}
<p class="muted">${esc(round.description)} ${esc(t(lang, 'detail.round.matchingFund'))}:
<strong>${esc(round.matchingFund.currency)} ${MONEY.format(round.matchingFund.amount)}</strong> ·
${esc(t(lang, 'detail.round.state'))} <strong>${esc(t(lang, `status.${round.state}`))}</strong> ·
${esc(t(lang, 'detail.round.mechanism'))} <strong>${round.matchingMode === 'pairwise' ? esc(t(lang, 'detail.round.pairwise')) : esc(t(lang, 'detail.round.quadratic'))}${round.conviction ? ` + ${esc(t(lang, 'detail.round.conviction'))}` : ''}</strong> ·
${esc(t(lang, 'detail.round.closes'))} ${esc(round.closesAt.slice(0, 10))} ·
${donations.length} ${esc(t(lang, 'misc.donations'))} ${esc(t(lang, 'misc.from'))} ${donors} ${esc(t(lang, 'misc.donors'))}.</p>
<p>${esc(t(lang, 'detail.round.matchNote'))}</p>
<table><tr><th scope="col">${esc(t(lang, 'col.need'))}</th><th scope="col">${esc(t(lang, 'col.donors'))}</th><th scope="col">${esc(t(lang, 'col.given'))}</th><th scope="col">${esc(t(lang, 'col.match'))}</th><th scope="col">${esc(t(lang, 'col.total'))}</th><th scope="col">${esc(t(lang, 'col.donate'))}</th></tr>
${rows || `<tr><td colspan="6"><em>${esc(t(lang, 'detail.round.noNeeds'))}</em></td></tr>`}</table>
<p class="muted"><a href="/fund#rounds">${esc(t(lang, 'detail.round.allRounds'))}</a> ·
<a href="/rounds/${esc(round.id)}/admin">${esc(t(lang, 'detail.round.operator'))}</a></p>
<details class="how-note"><summary>${esc(t(lang, 'detail.data'))}</summary>
<div class="hn-body"><a href="/rounds/${esc(round.id)}?format=json">JSON</a></div></details>`, lang);
}

// Operator console for a round — pending applications with approve/
// reject actions, close control. Admin-gated at the route layer;
// the page is just the form surface.
export function renderRoundAdmin(
  round: FundingRound, applications: RoundApplication[], nodes: PlanNode[],
  lang: Lang = 'en',
): string {
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const rows = applications.map((a) => `<tr>
<td>${esc(label.get(a.needNodeId) ?? a.needNodeId)}</td>
<td>${displayName(a.applicant)}</td>
<td class="muted">${esc(a.statement || '—')}</td>
<td><span class="badge">${esc(t(lang, `status.${a.state}`))}</span></td>
<td>${a.state === 'pending' ? `
<form method="post" action="/rounds/${esc(round.id)}/applications/${esc(a.id)}/review" style="display:inline">
<input type="hidden" name="approve" value="true"><button>${esc(t(lang, 'detail.admin.approve'))}</button></form>
<form method="post" action="/rounds/${esc(round.id)}/applications/${esc(a.id)}/review" style="display:inline">
<input type="hidden" name="approve" value="false"><button>${esc(t(lang, 'detail.admin.reject'))}</button></form>` : ''}</td></tr>`).join('\n');
  return shell(`${round.title} — ${t(lang, 'detail.admin.kicker')}`, `
${pageHeader({
    kicker: t(lang, 'detail.admin.kicker'),
    title: round.title,
    back: { href: '/fund#rounds', label: t(lang, 'nav.fund') },
  })}
<p class="muted">${applications.filter((a) => a.state === 'pending').length} ${esc(t(lang, 'detail.admin.pending'))} ·
${esc(t(lang, 'detail.admin.roundIs'))} <strong>${esc(t(lang, `status.${round.state}`))}</strong></p>
<table><tr><th scope="col">${esc(t(lang, 'col.need'))}</th><th scope="col">${esc(t(lang, 'col.applicant'))}</th><th scope="col">${esc(t(lang, 'col.statement'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th><th scope="col">${esc(t(lang, 'col.review'))}</th></tr>
${rows || `<tr><td colspan="5"><em>${esc(t(lang, 'detail.admin.none'))}</em></td></tr>`}</table>
${round.state === 'open' ? `
<form method="post" action="/rounds/${esc(round.id)}/close" style="margin-top:1rem">
<button>${esc(t(lang, 'detail.admin.close'))}</button></form>` : ''}
<p class="muted"><a href="/rounds/${esc(round.id)}">${esc(t(lang, 'detail.admin.backRound'))}</a></p>`, lang);
}
