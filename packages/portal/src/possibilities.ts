import type { PlanNode, TrustEdge } from '@springforth/coordination';
import type { PossibilityStatus } from '@springforth/core';
import { footer } from './nav.ts';

// /possibilities — the card deck. Each card is a declared possibility
// ("I want to…") with its needs progress, participant count, deadline
// countdown, and the current escalation step. Same portal constraints:
// one self-contained HTML file, no JS framework, plain HTML forms.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface PossibilityCard {
  id: string; title: string; description: string; declarerId: string;
  place?: string; timeStart?: string; timeEnd?: string; deadline?: string;
  minParticipants: number; maxParticipants?: number;
  status: PossibilityStatus;
  score: number; tipping?: boolean;
  scoring: { score: number; trust: number; urgency: number; cover: number };
  participantCount: number;
  // Identity gradation — undefined until critical mass (cover ≥ 0.5 or
  // quorum reached). Counts are always public; names reveal late.
  participants?: { actor: string; bringingNodeId?: string }[];
  needs: (PlanNode & { met: boolean })[];
  bringing: PlanNode[];
  quorum: { met: boolean; required: number; requiredMet: number };
  report?: { summary: string; evidence: string; learnings: string; at: string };
  context?: { datasets?: { name: string; value: string; source: string; fetchedAt: string }[] };
}

const STATUS_STYLE: Record<string, string> = {
  draft: '#ccc', active: '#7fb3e8', quorum: '#8fd18f',
  completed: '#4a7a4a', expired: '#e88f8f',
};

function countdown(deadline: string | undefined): string {
  if (!deadline) return 'open-ended';
  const d = Math.ceil((Date.parse(deadline) - Date.now()) / 86_400_000);
  return d < 0 ? 'deadline passed' : d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} left`;
}

function card(c: PossibilityCard): string {
  const live = c.status === 'active' || c.status === 'draft';
  const cover = c.scoring.cover;
  const needRows = c.needs.map((n) => `<li>
    ${n.met ? '&#10003;' : '&#8226;'} ${esc(n.label)}
    ${n.category ? `<span class="nice">[${esc(n.category)}]</span>` : ''}
    ${n.required ? '<span class="req">required</span>' : '<span class="nice">nice-to-have</span>'}
    ${n.flaggedBy ? `<span class="nice">flagged by ${esc(n.flaggedBy)}</span>` : ''}
    ${n.met ? '<span class="met">met</span>' : ''}</li>`).join('');
  const bringing = c.bringing.map((n) => `<li>${esc(n.label)} — ${esc(n.orgIds[0] ?? '')}</li>`).join('');
  const joined = (c.participants ?? []).map((x) => `<li>${esc(x.actor)}${x.bringingNodeId ? ' + bringing' : ''}</li>`).join('');
  const partCap = c.maxParticipants ? `/${c.maxParticipants} cap` : '';
  return `<div class="card" style="border-left:6px solid ${STATUS_STYLE[c.status] ?? '#ccc'}">
<h3>&#8220;${esc(c.title)}&#8221;</h3>
<p><span class="badge">${esc(c.status)}</span>
${c.tipping ? '<span class="badge tip">tipping — 30% reached, momentum building</span>' : ''}
<span class="badge">${esc(countdown(c.deadline))}</span>
<span class="badge">${c.participantCount}/${c.minParticipants} in${partCap}</span>
<span class="badge">needs ${c.quorum.requiredMet}/${c.quorum.required}</span>
<span class="badge">score ${c.score.toFixed(2)}</span></p>
<div class="bar"><div class="fill" style="width:${Math.round(cover * 100)}%"></div></div>
<p class="meta">needs:resources cover ${(cover * 100).toFixed(0)}% ·
trust ${c.scoring.trust.toFixed(2)} · urgency ${c.scoring.urgency.toFixed(2)}</p>
<p>Declared by <strong>${esc(c.declarerId)}</strong>${c.place ? ` · ${esc(c.place)}` : ''}
${c.timeStart ? ` · ${esc(c.timeStart.slice(0, 10))}${c.timeEnd ? ` → ${esc(c.timeEnd.slice(0, 10))}` : ''}` : ''}
· <a href="/possibilities/${esc(c.id)}/ics">add to calendar (.ics)</a></p>
${c.description ? `<p>${esc(c.description)}</p>` : ''}
${c.context?.datasets?.length ? `<p class="ctx"><strong>Verified context</strong></p><ul class="needs">${c.context.datasets.map((d) => `<li>&#9670; ${esc(d.name)}: ${esc(d.value)}${d.source ? ` <span class="nice">(${esc(d.source)})</span>` : ''}</li>`).join('')}</ul>` : ''}
${needRows ? `<p><strong>Needs</strong></p><ul class="needs">${needRows}</ul>` : ''}
${bringing ? `<p><strong>Being brought</strong></p><ul class="needs">${bringing}</ul>` : ''}
${c.participants === undefined
  ? `<p><strong>In:</strong> ${c.participantCount} — <em>names reveal as quorum nears</em></p>`
  : joined ? `<p><strong>In (${c.participantCount})</strong></p><ul class="needs">${joined}</ul>` : ''}
${live ? `<form method="post" action="/possibilities/${esc(c.id)}/join" class="val">
  <input name="actor" placeholder="your name" required>
  <input name="bringing" placeholder="what you'll bring (optional)">
  <button>I'm coming</button>
</form>
<form method="post" action="/possibilities/${esc(c.id)}/need" class="val">
  <input name="actor" placeholder="your name" required>
  <input name="title" placeholder="a need this card is missing" required>
  <input name="category" placeholder="equipment|venue|skill|person|consumable">
  <button>Flag a need</button>
</form>
<form method="post" action="/possibilities/${esc(c.id)}/pass" class="val">
  <input name="actor" placeholder="your name" required>
  <button>Not for me (logged, private)</button>
</form>` : ''}
${c.status === 'completed' || c.status === 'quorum' ? `<form method="post" action="/possibilities/${esc(c.id)}/appreciate" class="val">
  <input name="from" placeholder="your name" required>
  <input name="to" placeholder="who showed up" required>
  <input name="note" placeholder="brought X and it was clutch">
  <button>Appreciate</button>
</form>` : ''}
${c.report ? `<p class="res"><strong>Report:</strong> ${esc(c.report.summary)}${c.report.learnings ? ` — <em>${esc(c.report.learnings)}</em>` : ''}</p>` : ''}
</div>`;
}

export function renderPossibilitiesPage(
  cards: PossibilityCard[], edges: TrustEdge[] = [], viewer?: string,
): string {
  const body = cards.map(card).join('\n');
  const mutual = edges.filter((e) => e.mutual > 0).slice(0, 10)
    .map((e) => `<li>${esc(e.from)} &harr; ${esc(e.to)} — mutual ${e.mutual}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Possibilities — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
.badge{background:#e6f4ea;padding:.2rem .5rem;border-radius:.25rem;font-size:.85rem}
.card{border:1px solid #ddd;border-radius:.5rem;padding:1rem;margin:1rem 0}
.val{display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap}
.val input{padding:.3rem;flex:1;min-width:8rem}.val button{padding:.35rem .8rem;cursor:pointer}
.res{background:#e6f4ea;padding:.4rem;border-radius:.25rem}
.needs{list-style:none;padding-left:.25rem;margin:.2rem 0}
.req{color:#a33;font-size:.8rem}.nice{color:#888;font-size:.8rem}.met{color:#4a7a4a;font-size:.8rem}
.tip{background:#fde8c8;color:#7a5a00}.meta{font-size:.8rem;color:#777}
.bar{background:#eee;border-radius:.25rem;height:.5rem;margin:.4rem 0;overflow:hidden}
.fill{background:#8fd18f;height:100%}
blockquote{border-left:3px solid #ccc;margin:0;padding:.2rem 1rem;color:#555}</style></head><body>
<h1>Possibility deck</h1>
<p>Declare what you want to make happen — bring what you have, name what you
need. When <strong>every required need is met</strong> and the participant
threshold is reached, quorum binds the commitment and the group goes.
Deadlines expire what never reaches quorum instead of
lingering. Post-event appreciation feeds the trust graph — mutual
recognition surfaces cards to the people who know you.</p>
<blockquote>Cards sort by <code>score = 0.5·trust + 0.3·urgency + 0.2·cover</code> —
trust proximity${viewer ? ` (viewing as ${esc(viewer)})` : ''}, time urgency,
and how much of the required need-set is already met.</blockquote>
<p><a href="/possibilities?format=json">JSON</a> · <a href="/coordination">coordination</a> ·
<a href="/commitments">commitments</a> · <a href="/outcomes">outcomes</a></p>
${body || '<p><em>No possibilities declared yet — POST /possibilities with a title, declarer, needs and deadline.</em></p>'}
${mutual ? `<h2>Mutual recognition</h2><p>Pairwise appreciation made visible —
mutual recognition steers which cards surface to whom.</p><ul>${mutual}</ul>` : ''}
${footer()}
</body></html>`;
}
