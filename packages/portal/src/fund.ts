// /fund — the money hub. Sections: open rounds (quadratic matching +
// demand gates), dominant-assurance pledges, retroactive rounds,
// recurring/yield streams, and the permanent endowment.
import type { DemandGate, Donation, FundingRound, Pledge, RetroRound } from '@springforth/core';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import {
  pageHeader, hubNav, hubSection, howItWorks, emptyState, displayName,
  hubScript,
} from './ui.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONEY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const fmt = (o: Record<string, number>) => Object.entries(o).filter(([, v]) => v > 0)
  .map(([c, v]) => `${esc(c)} ${MONEY.format(Math.round(v * 100) / 100)}`).join(' · ');

export interface StreamRow {
  id: string; roundId: string; needNodeId?: string; supporter: string;
  token: string; flowRate: string; state: string; accruedUnits: string;
  createdAt: string;
}
export interface YieldRow {
  id: string; roundId: string; sponsor: string; label: string;
  yieldAccrued: number; state: string;
}

export interface FundPageInput {
  lang: Lang;
  rounds: FundingRound[];
  donations: Donation[];
  gates: Map<string, DemandGate>;
  endowment?: { accrued: Record<string, number>; principal: Record<string, number> };
  pledges: Pledge[];
  retroRounds: RetroRound[];
  badgeholders: string[];
  streams: StreamRow[];
  yieldStreams: YieldRow[];
  // id → card title, for human pledge targets
  possibilities: { id: string; title: string }[];
}

export function renderFundPage(o: FundPageInput): string {
  const lang = o.lang;
  const possTitle = new Map(o.possibilities.map((p) => [p.id, p.title]));

  /* #rounds — round cards with gate badges + committed totals. */
  const byCur = new Map<string, number>();
  for (const d of o.donations) byCur.set(d.currency, (byCur.get(d.currency) ?? 0) + d.amount);
  const totals = [...byCur.entries()]
    .map(([c, a]) => `${esc(c)} ${MONEY.format(a)}`).join(' · ');
  const open = o.rounds.filter((r) => !r.endowment);
  const roundCards = open.map((r) => {
    const g = o.gates.get(r.id);
    const gate = g?.gated
      ? g.active
        ? `<span class="badge lime">${esc(t(lang, 'hub.fund.rounds.demandMet'))} — ${g.backers.length} ${esc(t(lang, 'hub.fund.rounds.backers'))} · ${MONEY.format(g.pledged)} ${esc(t(lang, 'hub.fund.rounds.pledged'))}</span>`
        : `<span class="badge gold">${esc(t(lang, 'hub.fund.rounds.matchingLocked'))} — ${g.backers.length}/${g.minBackers} ${esc(t(lang, 'hub.fund.rounds.backers'))} · ${MONEY.format(g.pledged)}/${MONEY.format(g.goal)} ${esc(t(lang, 'hub.fund.rounds.pledged'))}</span>`
      : '';
    const skim = r.skimBps
      ? `<span class="badge">${r.skimBps / 100}% ${esc(t(lang, 'hub.fund.rounds.skim'))}</span>` : '';
    return `<div class="card">
<h3><a href="/rounds/${esc(r.id)}" style="color:inherit;text-decoration:none">${esc(r.title)}</a></h3>
<p><span class="badge">${esc(t(lang, `status.${r.state}`))}</span>
<span class="badge">${esc(r.matchingFund.currency)} ${MONEY.format(r.matchingFund.amount)}</span>
<span class="badge">${r.eligibleNeedIds.length} ${esc(t(lang, 'col.needs').toLowerCase())}</span>
${gate}${skim}</p>
${r.description ? `<p>${esc(r.description)}</p>` : ''}
<p class="muted">${esc(t(lang, 'col.closes'))} ${esc(r.closesAt.slice(0, 10))}</p>
</div>`;
  }).join('\n');
  const roundsBody = `
${totals ? `<p class="muted">${esc(t(lang, 'hub.fund.rounds.committed'))} <strong>${totals}</strong> — ${esc(t(lang, 'hub.fund.rounds.converted'))}.</p>` : ''}
${roundCards || emptyState(t(lang, 'hub.fund.rounds.none'))}
${howItWorks(lang, 'how.fund.rounds', 's5')}`;

  /* #pledges — plain state labels, card titles, humanized pledgers. */
  const pledgeRows = o.pledges.map((p) => `<tr>
<td><a href="/actors/${esc(p.pledger)}">${displayName(p.pledger)}</a></td>
<td><strong>${MONEY.format(p.amount)} ${esc(p.currency)}</strong></td>
<td><a href="/possibilities#${esc(p.possibilityId)}">${esc(possTitle.get(p.possibilityId) ?? p.possibilityId)}</a></td>
<td><span class="badge">${esc(t(lang, `state.pledge.${p.state}`))}</span></td>
</tr>`).join('\n');
  const pledgesBody = o.pledges.length
    ? `<table><tr><th scope="col">${esc(t(lang, 'col.pledger'))}</th><th scope="col">${esc(t(lang, 'col.amount'))}</th><th scope="col">${esc(t(lang, 'col.possibility'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th></tr>${pledgeRows}</table>
${howItWorks(lang, 'how.fund.pledges', 's5')}`
    : emptyState(t(lang, 'hub.fund.pledges.none')) + howItWorks(lang, 'how.fund.pledges', 's5');

  /* #retro — retroactive rounds + badgeholders. */
  const retroRows = o.retroRounds.map((r) => `<tr>
<td>${esc(r.title || r.id)}</td>
<td>${r.fund ? `${MONEY.format(r.fund.amount)} ${esc(r.fund.currency)}` : '—'}</td>
<td>${r.claimIds?.length ?? 0}</td>
<td class="muted">${esc(r.ballotClose.slice(0, 10))}</td>
<td><span class="badge">${esc(t(lang, `status.${r.state}`))}</span></td>
</tr>`).join('\n');
  const retroBody = `
${retroRows ? `<table><tr><th scope="col">${esc(t(lang, 'col.round'))}</th><th scope="col">${esc(t(lang, 'col.fund'))}</th><th scope="col">${esc(t(lang, 'col.claims'))}</th><th scope="col">${esc(t(lang, 'col.ballotClose'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th></tr>${retroRows}</table>`
    : emptyState(t(lang, 'hub.fund.retro.none'))}
${o.badgeholders.length ? `<p class="muted"><strong>${esc(t(lang, 'hub.fund.retro.badgeholders'))}:</strong> ${o.badgeholders.map((b) => `<a href="/actors/${esc(b)}">${displayName(b)}</a>`).join(' · ')}</p>` : ''}
${howItWorks(lang, 'how.fund.retro', 's5')}`;

  /* #streams — recurring support + yield streams. */
  const streamRows = o.streams.map((s) => `<tr>
<td><a href="/actors/${esc(s.supporter)}">${displayName(s.supporter)}</a></td>
<td><a href="/rounds/${esc(s.roundId)}">${esc(s.roundId)}</a></td>
<td class="muted"><code>${esc(s.flowRate)}</code>/s</td>
<td><span class="badge">${esc(t(lang, `status.${s.state}`))}</span></td>
</tr>`).join('\n');
  const yieldRows = o.yieldStreams.map((y) => `<tr>
<td><a href="/actors/${esc(y.sponsor)}">${displayName(y.sponsor)}</a></td>
<td><a href="/rounds/${esc(y.roundId)}">${esc(y.roundId)}</a></td>
<td class="muted">${esc(y.label)}</td>
<td>${MONEY.format(y.yieldAccrued)}</td>
<td><span class="badge">${esc(t(lang, `status.${y.state}`))}</span></td>
</tr>`).join('\n');
  const streamsBody = (streamRows || yieldRows)
    ? `${streamRows ? `<table><tr><th scope="col">${esc(t(lang, 'col.supporter'))}</th><th scope="col">${esc(t(lang, 'col.round'))}</th><th scope="col">${esc(t(lang, 'col.flow'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th></tr>${streamRows}</table>` : ''}
${yieldRows ? `<table><tr><th scope="col">${esc(t(lang, 'col.supporter'))}</th><th scope="col">${esc(t(lang, 'col.round'))}</th><th scope="col">${esc(t(lang, 'col.source'))}</th><th scope="col">${esc(t(lang, 'col.accrued'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th></tr>${yieldRows}</table>` : ''}
${howItWorks(lang, 'how.fund.streams', 's5')}`
    : emptyState(t(lang, 'hub.fund.streams.none')) + howItWorks(lang, 'how.fund.streams', 's5');

  /* #endowment — locked principal + accrued skim. */
  const accruedStr = o.endowment ? fmt(o.endowment.accrued) : '';
  const principalStr = o.endowment ? fmt(o.endowment.principal) : '';
  const endowBody = accruedStr || principalStr
    ? `<p class="muted">${esc(t(lang, 'hub.fund.endowment.principal'))} <strong>${principalStr || '—'}</strong> · ${esc(t(lang, 'hub.fund.endowment.accrued'))} <strong>${accruedStr || '—'}</strong> — ${esc(t(lang, 'hub.fund.endowment.body'))}</p>`
    : emptyState(t(lang, 'hub.fund.endowment.none'));

  const sections: Array<[string, number | undefined, string, string | undefined]> = [
    ['rounds', open.length, roundsBody, t(lang, 'hub.fund.rounds.lede')],
    ['pledges', o.pledges.length, pledgesBody, t(lang, 'hub.fund.pledges.lede')],
    ['retro', o.retroRounds.length, retroBody, t(lang, 'hub.fund.retro.lede')],
    ['streams', o.streams.length + o.yieldStreams.length, streamsBody, t(lang, 'hub.fund.streams.lede')],
    ['endowment', undefined, endowBody, undefined],
  ];

  const body = `<div class="page hub-head">${pageHeader({
    kicker: t(lang, 'hub.fund.kicker'),
    title: t(lang, 'hub.fund.h1'),
    em: t(lang, 'hub.fund.h1.em'),
    lede: t(lang, 'hub.fund.lede'),
  })}</div>
${hubNav(sections.map(([id]) => ({ href: `#${id}`, label: t(lang, `hub.fund.${id}.t`) })), lang)}
<div class="page hub-body">
${sections.map(([id, count, secBody, lede], i) => hubSection({
    id, kicker: t(lang, `hub.fund.${id}.k`), title: t(lang, `hub.fund.${id}.t`),
    count, lede, body: secBody, index: i + 1,
  })).join('\n')}
</div>${hubScript}`;

  return pageShell({ title: `${t(lang, 'nav.fund')} — Springforth`,
    htmx: false, lang }, body);
}
