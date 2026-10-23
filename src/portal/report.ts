import type {
  Appreciation, ImpactClaim, OracleCheck, Participation, Possibility,
} from '../core';
import type { PlanNode } from '../coordination';
import type { Trajectory } from '../oracle/index';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader, displayName } from './ui.ts';

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
  seats?: { actor: string; role: string }[];
  posts?: { id: string; parentId?: string; actor: string; kind: string; text: string; at: string }[];
  lang?: Lang;
}): string {
  const { possibility: p, participants, nodes, checks, appreciations, claim, trajectories } = opts;
  const seats = opts.seats ?? [];
  const posts = opts.posts ?? [];
  const lang = opts.lang ?? 'en';
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const checksByNode = new Map<string, OracleCheck[]>();
  for (const c of checks) {
    if (!c.nodeId) continue;
    if (!checksByNode.has(c.nodeId)) checksByNode.set(c.nodeId, []);
    checksByNode.get(c.nodeId)!.push(c);
  }
  const evidenceRows = [...checksByNode.entries()].map(([nid, cs]) => {
    const tj = trajectories.find((t) => t.nodeId === nid);
    const refs = [...new Set(cs.map((c) => c.methodologyRef).filter((x): x is string => !!x))];
    return `<tr><td>${esc(label.get(nid) ?? nid)}${refs.length ? `<br><small class="muted">${refs.map(esc).join(' · ')}</small>` : ''}</td><td>${cs.length}</td>
<td>${cs.filter((c) => c.result === 'match').length} ${esc(t(lang, 'misc.match'))} /
${cs.filter((c) => c.result === 'mismatch').length} ${esc(t(lang, 'misc.mismatch'))}</td>
<td>${tj ? `${tj.slopePerDay > 0 ? '+' : ''}${tj.slopePerDay}/day${tj.daysToThreshold != null ? ` · ~${tj.daysToThreshold}d ${esc(t(lang, 'detail.report.toThreshold'))}` : ''}` : '—'}</td></tr>`;
  }).join('\n');
  const appList = appreciations.map((a) =>
    `<li><strong>${displayName(a.fromActor)}</strong> → <strong>${displayName(a.toActor)}</strong>${a.note ? ` — <em>“${esc(a.note)}”</em>` : ''}</li>`).join('\n');
  const byRole = new Map<string, string[]>();
  for (const s of seats) {
    if (!byRole.has(s.role)) byRole.set(s.role, []);
    byRole.get(s.role)!.push(s.actor);
  }
  const seatList = byRole.size
    ? `<ul>${[...byRole.entries()].map(([role, actors]) =>
        `<li><strong>${esc(t(lang, `council.role.${role}`))}</strong>${role === 'verifier' ? ` <span class="muted">(${esc(t(lang, 'council.selfDeclared'))})</span>` : ''} — ${actors.map((a) => displayName(a)).join(', ')}</li>`).join('')}</ul>`
    : '';
  const postList = posts.length
    ? `<ul>${posts.map((fp) => `<li><span class="badge">${esc(t(lang, `forum.k.${fp.kind}`))}</span> <strong>${displayName(fp.actor)}</strong> — ${esc(fp.text)} <span class="muted">${esc(fp.at.slice(0, 10))}</span></li>`).join('')}</ul>`
    : '';
  return pageShell({ title: `${t(lang, 'detail.report.kicker')} — ${p.title}`,
    htmx: false, lang,
    extraCss: `.box{background:var(--sf-card);border:1px solid var(--sf-line-2);border-radius:12px;padding:1.2rem;margin:1rem 0}` },
    `<div class="page">
${pageHeader({
      kicker: t(lang, 'detail.report.kicker'),
      title: p.title,
      back: { href: '/possibilities', label: t(lang, 'nav.possibilities') },
    })}
<p class="muted">${esc(p.place ?? '')} · ${esc(t(lang, 'detail.report.declaredBy'))} ${displayName(p.declarerId)} · ${esc(t(lang, 'detail.report.status'))} ${esc(p.status)}</p>
${p.report ? `<div class="box"><h2 style="margin-top:0">${esc(t(lang, 'detail.report.happened'))}</h2>
<p>${esc(p.report.summary)}</p>
<p><strong>${esc(t(lang, 'detail.report.evidence'))}:</strong> ${esc(p.report.evidence)}</p>
<p><strong>${esc(t(lang, 'detail.report.learnings'))}:</strong> ${esc(p.report.learnings)}</p></div>` : `<p><em>${esc(t(lang, 'detail.report.none'))}</em></p>`}
<h2>${esc(t(lang, 'detail.report.who'))}</h2>
<p>${participants.length} ${esc(t(lang, 'detail.report.people'))}: ${participants.map((x) => displayName(x.actor)).join(', ') || '—'}</p>
<h2>${esc(t(lang, 'detail.report.readings'))}</h2>
<table><tr><th scope="col">${esc(t(lang, 'col.target'))}</th><th scope="col">${esc(t(lang, 'col.readings'))}</th><th scope="col">${esc(t(lang, 'col.result'))}</th><th scope="col">${esc(t(lang, 'col.trend'))}</th></tr>
${evidenceRows || `<tr><td colspan="4"><em>${esc(t(lang, 'detail.report.noReadings'))}</em></td></tr>`}</table>
<h2>${esc(t(lang, 'detail.report.appreciations'))}</h2>
<ul>${appList || `<li><em>${esc(t(lang, 'detail.report.noneRecorded'))}</em></li>`}</ul>
${(seats.length || posts.length) ? `<h2>${esc(t(lang, 'detail.report.council'))}</h2>
${seatList}${postList}` : ''}
${claim ? `<h2>${esc(t(lang, 'detail.report.claim'))}</h2>
<p>${esc(t(lang, 'detail.report.claimWord'))} <code>${esc(claim.id)}</code> — ${esc(t(lang, 'detail.report.state'))} <strong>${esc(claim.state)}</strong> —
${claim.oracleCheckIds.length} ${esc(t(lang, 'detail.report.checksCited'))}; ${claim.contributors.length} ${esc(t(lang, 'detail.report.contributors'))}.
<details class="how-note"><summary>${esc(t(lang, 'detail.data'))}</summary>
<div class="hn-body"><a href="/claims/${esc(claim.id)}?format=lexicon">${esc(t(lang, 'detail.report.lexicon'))}</a></div></details></p>` : ''}
<p class="muted"><a href="/possibilities#${esc(p.id)}">${esc(t(lang, 'detail.report.card'))}</a> · ${esc(t(lang, 'detail.report.generated'))} ${new Date().toISOString()}</p>
</div>`);
}
