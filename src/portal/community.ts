// /community — the social hub. Sections: the people directory, mutual
// recognition, protocol decisions (proposals + ballots + parameters),
// and the shared-resource commons.
import type { GovernanceBallot, GovernanceParam, GovernanceProposal } from '../core';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import {
  pageHeader, hubNav, hubSection, howItWorks, emptyState, displayName,
  hubScript,
} from './ui.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PEOPLE_CAP = 24;

export interface ActorRow { id: string; created: number; joined: number; earned: number; trustScore: number }
export interface MutualEdge { from: string; to: string; weight: number; mutual: number }

export interface CommunityPageInput {
  lang: Lang;
  people: ActorRow[];
  mutual: MutualEdge[];
  proposals: GovernanceProposal[];
  ballots: GovernanceBallot[];
  params: GovernanceParam[];
  governable: Record<string, { default: string; describe: string }>;
  voters: number;
  peopleAll?: boolean;
  // Community voices — real appreciation notes, site-wide.
  voices?: { from: string; to: string; note: string; possibilityId?: string; at: string }[];
  // Active councils — seats on quorum/completed cards.
  councils?: { possibilityId: string; title: string; status: string; seats: { actor: string; role: string }[] }[];
}

export function renderCommunityPage(o: CommunityPageInput): string {
  const lang = o.lang;

  /* #people — identity cards with declaration/join/recognition counts. */
  const sorted = [...o.people]
    .sort((a, b) => b.earned - a.earned || b.trustScore - a.trustScore);
  const peopleCards = (o.peopleAll ? sorted : sorted.slice(0, PEOPLE_CAP)).map((p) => `<div class="card">
<h3><a href="/actors/${esc(p.id)}" style="color:inherit;text-decoration:none">${displayName(p.id)}</a></h3>
<p class="muted">${p.created} ${esc(t(lang, 'hub.community.people.declared'))}
· ${p.joined} ${esc(t(lang, 'hub.community.people.joined'))}
· ${p.earned.toFixed(1)} ${esc(t(lang, 'hub.community.people.earned'))}</p>
</div>`).join('\n');
  const peopleBody = `
${peopleCards || emptyState(t(lang, 'hub.community.people.none'))}
${!o.peopleAll && o.people.length > PEOPLE_CAP
  ? `<p><a href="/community?people=all#people">${esc(t(lang, 'hub.community.people.all'))} (${o.people.length}) →</a></p>`
  : o.peopleAll ? `<p><a href="/community#people">${esc(t(lang, 'hub.community.people.fewer'))} →</a></p>` : ''}`;

  /* #trust — mutual pairs, humanized. */
  const mutualBody = o.mutual.length
    ? `<ul>${[...o.mutual].sort((a, b) => b.mutual - a.mutual).slice(0, 20).map((m) =>
        `<li><a href="/actors/${esc(m.from)}">${displayName(m.from)}</a> &harr; <a href="/actors/${esc(m.to)}">${displayName(m.to)}</a> — <strong>${m.mutual}</strong> × ${esc(t(lang, 'hub.community.trust.times'))}</li>`).join('')}</ul>
${howItWorks(lang, 'how.community.trust', 's3')}`
    : emptyState(t(lang, 'hub.community.trust.none')) + howItWorks(lang, 'how.community.trust', 's3');

  /* #decisions — open ballots, then parameters in plain terms. */
  const open = o.proposals.filter((p) => p.state === 'open');
  const closed = o.proposals.filter((p) => p.state !== 'open');
  const propRows = (rows: GovernanceProposal[]) => rows.map((p) => {
    const bs = o.ballots.filter((b) => b.proposalId === p.id);
    const forW = bs.filter((b) => b.support).reduce((a, b) => a + Math.sqrt(b.points), 0);
    const againstW = bs.filter((b) => !b.support).reduce((a, b) => a + Math.sqrt(b.points), 0);
    return `<tr>
<td><strong>${esc(p.title)}</strong><br>
<small class="muted">${esc(p.param)} → ${esc(p.proposedValue)}${p.description ? ` · ${esc(p.description)}` : ''} — ${displayName(p.proposer)}</small></td>
<td>${forW.toFixed(2)} / ${againstW.toFixed(2)}</td>
<td class="muted">${esc(p.closesAt.slice(0, 10))}</td>
<td><span class="badge">${esc(t(lang, `status.${p.state}`))}</span></td>
<td>${p.state === 'open' ? `
  <form method="post" action="/governance/${esc(p.id)}/vote" class="val">
    <input name="voter" placeholder="${esc(t(lang, 'form.actor'))}" aria-label="${esc(t(lang, 'form.actor'))}" required style="width:7rem">
    <input name="points" type="number" min="1" step="1" value="1" aria-label="${esc(t(lang, 'form.points'))}" style="width:4rem">
    <button name="support" value="true">${esc(t(lang, 'form.for'))}</button>
    <button name="support" value="false">${esc(t(lang, 'form.against'))}</button>
  </form>` : ''}</td>
</tr>`;
  }).join('\n');
  const paramRows = Object.entries(o.governable).map(([k, g]) => {
    const cur = o.params.find((p) => p.id === k);
    return `<tr><td><code>${esc(k)}</code></td><td><strong>${esc(cur?.value ?? g.default) || '—'}</strong></td>
<td class="muted">${esc(t(lang, `gov.param.${k}`))}</td>
<td class="muted">${cur && cur.setBy !== 'default' ? `${esc(t(lang, 'hub.community.decisions.setBy'))} <code>${esc(cur.setBy)}</code>` : esc(t(lang, 'hub.community.decisions.default'))}</td></tr>`;
  }).join('\n');
  const decisionsBody = `
<p class="muted">${o.voters} ${esc(t(lang, 'hub.community.decisions.voters'))}</p>
${o.proposals.length ? `<table><tr><th scope="col">${esc(t(lang, 'col.proposal'))}</th><th scope="col">${esc(t(lang, 'col.votes'))}</th><th scope="col">${esc(t(lang, 'col.ballotClose'))}</th><th scope="col">${esc(t(lang, 'col.state'))}</th><th scope="col">${esc(t(lang, 'col.vote'))}</th></tr>${propRows([...open, ...closed])}</table>`
    : `<p class="muted">${esc(t(lang, 'hub.community.decisions.none'))}</p>`}
<details><summary>${esc(t(lang, 'hub.community.decisions.propose'))}</summary>
<form method="post" action="/governance/proposals" class="val" style="max-width:40rem">
  <select name="param" aria-label="${esc(t(lang, 'col.param'))}">${Object.keys(o.governable).map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select>
  <input name="title" placeholder="${esc(t(lang, 'form.title'))}" aria-label="${esc(t(lang, 'form.title'))}" required>
  <input name="proposedValue" placeholder="${esc(t(lang, 'form.newValue'))}" aria-label="${esc(t(lang, 'form.newValue'))}" required>
  <input name="proposer" placeholder="${esc(t(lang, 'form.actor'))}" aria-label="${esc(t(lang, 'form.actor'))}" required>
  <button>${esc(t(lang, 'form.propose'))}</button>
</form></details>
${paramRows ? `<table><tr><th scope="col">${esc(t(lang, 'col.param'))}</th><th scope="col">${esc(t(lang, 'col.current'))}</th><th scope="col">${esc(t(lang, 'col.meaning'))}</th><th scope="col">${esc(t(lang, 'col.setBy'))}</th></tr>${paramRows}</table>` : ''}
${howItWorks(lang, 'how.community.gov', 's8')}`;

  /* #voices — appreciation notes as public reviews. */
  const voicesBody = (o.voices ?? []).length
    ? `<ul>${(o.voices ?? []).slice(0, 15).map((v) =>
        `<li><em>“${esc(v.note)}”</em> — <a href="/actors/${esc(v.from)}">${displayName(v.from)}</a> → <a href="/actors/${esc(v.to)}">${displayName(v.to)}</a>${v.possibilityId ? ` · <a href="/possibilities#${esc(v.possibilityId)}">${esc(t(lang, 'hub.community.voices.card'))}</a>` : ''} <span class="muted">${esc(v.at.slice(0, 10))}</span></li>`).join('')}</ul>`
    : emptyState(t(lang, 'hub.community.voices.none'));

  /* #councils — per-card councils across quorum/completed cards. */
  const councilsBody = (o.councils ?? []).length
    ? `<ul>${(o.councils ?? []).map((c) =>
        `<li><a href="/possibilities#${esc(c.possibilityId)}"><strong>${esc(c.title)}</strong></a>
<span class="badge">${esc(c.status)}</span> — ${c.seats.length} ${esc(t(lang, 'hub.community.councils.seats'))}
<span class="muted">(${c.seats.map((s) => displayName(s.actor)).join(', ')})</span></li>`).join('')}</ul>`
    : emptyState(t(lang, 'hub.community.councils.none'));

  const sections: Array<[string, number | undefined, string, string | undefined]> = [
    ['people', o.people.length, peopleBody, undefined],
    ['trust', o.mutual.length, mutualBody, t(lang, 'hub.community.trust.lede')],
    ['voices', (o.voices ?? []).length, voicesBody, t(lang, 'hub.community.voices.lede')],
    ['councils', (o.councils ?? []).length, councilsBody, t(lang, 'hub.community.councils.lede')],
    ['decisions', open.length, decisionsBody, t(lang, 'hub.community.decisions.lede')],
  ];

  const body = `<div class="page hub-head">${pageHeader({
    kicker: t(lang, 'hub.community.kicker'),
    title: t(lang, 'hub.community.h1'),
    em: t(lang, 'hub.community.h1.em'),
    lede: t(lang, 'hub.community.lede'),
  })}</div>
${hubNav(sections.map(([id]) => ({ href: `#${id}`, label: t(lang, `hub.community.${id}.t`) })), lang)}
<div class="page hub-body">
${sections.map(([id, count, secBody, lede], i) => hubSection({
    id, kicker: t(lang, `hub.community.${id}.k`), title: t(lang, `hub.community.${id}.t`),
    count, lede, body: secBody, index: i + 1,
  })).join('\n')}
<p class="muted" style="margin-top:2rem"><a href="https://t.me/springforth_bot">${esc(t(lang, 'hub.community.telegram'))} →</a>
<span class="muted"> — ${esc(t(lang, 'hub.community.telegram.body'))}</span></p>
</div>${hubScript}`;

  return pageShell({ title: `${t(lang, 'nav.community')} — Springforth`,
    htmx: false, lang }, body);
}
