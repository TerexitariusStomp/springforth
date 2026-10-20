import type { OverlapRecord, PlanNode } from '@springforth/coordination';
import { mergeProposal, tokenSet, jaccard, isNeed, inferCapital } from '@springforth/coordination';

// Agent — the natural-language front door to the plan graph (PS1 idea
// starter: "agentic AI querying structured data and identifying next
// actions"). Deliberately tool-bounded: deterministic intent parsing over
// stored nodes/records, every answer cites the node/record ids it used, and
// nothing here mutates state — proposals are text a human still approves.
// A Workers AI summariser can be layered on later; the cited substrate
// stays the same so provenance never depends on the model.

export interface AgentCtx {
  nodes: PlanNode[];
  overlaps: OverlapRecord[];
  signals?: { actor: string; targetId: string; intent: string }[];
  possibilities?: { id: string; title: string; status: string; deadline?: string;
    participants?: number; minParticipants?: number; requiredMet?: number; required?: number;
    report?: { summary: string } }[];
  trust?: { from: string; to: string; mutual: number }[];
  standing?: { id: string; earned: number; trustScore: number; assuranceCredits?: number }[];
}

export interface AgentAnswer {
  answer: string;
  citedNodeIds: string[];
  citedOverlapIds: string[];
  intent: 'overlap' | 'explain' | 'next' | 'merge' | 'offer' | 'need'
    | 'signal' | 'capital' | 'possibility' | 'trust' | 'standing' | 'report' | 'unknown';
}

const PLACE_WORDS = /\b(?:in|at|for|around|near)\s+([a-z][a-z\s-]+?)(?:\?|$|\s(?:and|that|which|do|does|with)\b)/i;
const MONEY = new Intl.NumberFormat('en-US');

const pct = (c: number) => `${Math.round(c * 100)}%`;

function findOverlaps(ctx: AgentCtx, place?: string) {
  let recs = ctx.overlaps.filter((o) => o.status === 'proposed' || o.status === 'confirmed');
  if (place) {
    const p = place.toLowerCase().trim();
    recs = recs.filter((o) => o.nodeIds.some((id) => {
      const n = ctx.nodes.find((x) => x.id === id);
      return n && (n.placeId?.toLowerCase().includes(p)
        || n.label.toLowerCase().includes(p) || n.h3?.includes(p));
    }));
  }
  return recs;
}

function describe(rec: OverlapRecord, ctx: AgentCtx): string {
  const [a, b] = rec.nodeIds.map((id) => ctx.nodes.find((n) => n.id === id));
  const place = a?.placeId ?? b?.placeId ?? 'shared area';
  // Complements are directional: nodeIds = [need, offer].
  if (rec.kind === 'complement')
    return `need "${a?.label ?? rec.nodeIds[0]}" may be met by offer "${b?.label ?? rec.nodeIds[1]}" `
      + `(${place}; confidence ${pct(rec.confidence)}; signals: ${rec.evidence.map((e) => e.field).join(', ')})`;
  return `"${a?.label ?? rec.nodeIds[0]}" and "${b?.label ?? rec.nodeIds[1]}" look ${rec.kind === 'duplicate' ? 'like the same work' : rec.kind} `
    + `in ${place} (confidence ${pct(rec.confidence)}; signals: ${rec.evidence.map((e) => e.field).join(', ')})`;
}

// Offer/need search over CLC commitment nodes — token match on
// label+description+terms, optionally scoped by the place phrase.
function findCommitments(ctx: AgentCtx, role: 'offer' | 'need', query: string, place?: string) {
  const qt = tokenSet(query);
  return ctx.nodes.filter((n) =>
    (role === 'offer' ? n.kind === 'offer' : isNeed(n))
    && (!place || n.placeId?.toLowerCase().includes(place.toLowerCase().trim())
      || n.h3?.includes(place))
    && jaccard(qt, tokenSet(`${n.label} ${n.description} ${n.terms ?? ''}`)) > 0);
}

export function answer(query: string, ctx: AgentCtx): AgentAnswer {
  const q = query.toLowerCase();
  const none: AgentAnswer = {
    answer: 'I can flag overlapping plans, explain a flagged pair, draft a merge proposal, or suggest the next action. Try "what overlaps in Thorntree?"',
    citedNodeIds: [], citedOverlapIds: [], intent: 'unknown',
  };

  // draft merge proposal
  if (/merge|joint|combine/.test(q)) {
    const rec = ctx.overlaps.find((o) =>
      o.status === 'confirmed' && o.nodeIds.some((id) => q.includes(id.toLowerCase())))
      ?? ctx.overlaps.find((o) => o.status === 'confirmed')
      ?? ctx.overlaps.find((o) => jaccard(tokenSet(q), tokenSet(o.nodeIds.join(' '))) > 0);
    if (!rec) return { ...none, answer: 'No overlap record to merge. Confirm an overlap first, then ask me to draft the proposal.' };
    const prop = mergeProposal(rec, ctx.nodes);
    return {
      answer: `Draft — "${prop.title}". ${prop.rationale} Combined indicative budget: ${prop.combinedBudget ? `~${MONEY.format(prop.combinedBudget)}` : 'unknown'}. Next step: post this to the affected organisations for sign-off, then coordinate as one proposal.`,
      citedNodeIds: [...rec.nodeIds], citedOverlapIds: [rec.id], intent: 'merge',
    };
  }

  // explain a flagged pair
  if (/why|explain|evidence/.test(q)) {
    const rec = ctx.overlaps.find((o) => q.includes(o.id.toLowerCase())) ?? ctx.overlaps[0];
    if (!rec) return { ...none, answer: 'No overlap records yet — run detection over imported plans first.' };
    const ev = rec.evidence.map((e) => `${e.field}: "${e.a}" ~ "${e.b}" = ${e.score}`).join('; ');
    return {
      answer: `${rec.id} was flagged ${rec.kind} at ${pct(rec.confidence)} confidence. Field scores — ${ev}. Status: ${rec.status}${rec.validations.length ? ` (${rec.validations.map((v) => `${v.actor}:${v.verdict}`).join(', ')})` : ' — awaiting human validation'}.`,
      citedNodeIds: [...rec.nodeIds], citedOverlapIds: [rec.id], intent: 'explain',
    };
  }

  // next action
  if (/next|what should|recommend|action/.test(q)) {
    const proposed = ctx.overlaps.filter((o) => o.status === 'proposed');
    const confirmed = ctx.overlaps.filter((o) => o.status === 'confirmed');
    if (confirmed.length) {
      const top = confirmed[0]!;
      return {
        answer: `${confirmed.length} overlap(s) are confirmed and ready to act on. Highest-confidence: ${top.id} — ask me to draft its merge proposal, or confirm it into a shared pool lane.`,
        citedNodeIds: [...top.nodeIds], citedOverlapIds: [top.id], intent: 'next',
      };
    }
    if (proposed.length) {
      const top = proposed[0]!;
      return {
        answer: `${proposed.length} overlap(s) awaiting human validation. Highest-confidence: ${top.id} (${pct(top.confidence)}) — route it to the affected organisations to confirm or reject before money moves.`,
        citedNodeIds: [...top.nodeIds], citedOverlapIds: [top.id], intent: 'next',
      };
    }
    return { ...none, answer: 'Nothing flagged. Import plans from two or more sources and run detection.', intent: 'next' };
  }

  // public support signals — "who wants this?"
  if (/\b(support|signal|backing|endorse)/.test(q) && ctx.signals) {
    const byTarget = new Map<string, string[]>();
    for (const s of ctx.signals.filter((s) => s.intent === 'support'))
      byTarget.set(s.targetId, [...(byTarget.get(s.targetId) ?? []), s.actor]);
    const lines = [...byTarget.entries()].slice(0, 6).map(([t, actors]) => {
      const n = ctx.nodes.find((x) => x.id === t);
      return `• ${n?.label ?? t}: ${actors.join(', ')}`;
    });
    if (!lines.length) return { ...none, intent: 'signal',
      answer: 'No public support signals yet — /signals takes a named actor + target.' };
    return {
      answer: `Public support signals:\n${lines.join('\n')}`,
      citedNodeIds: [...byTarget.keys()], citedOverlapIds: [], intent: 'signal',
    };
  }

  // possibility deck — "what's happening", "what can we make happen", quorum
  if (/\b(possibilit|happening|make happen|quorum|want to|coming together|going on)\b/.test(q) && ctx.possibilities) {
    const live = ctx.possibilities.filter((p) => p.status === 'active' || p.status === 'quorum' || p.status === 'draft');
    if (!live.length)
      return { ...none, intent: 'possibility',
        answer: 'No open possibilities — declare one with POST /possibilities: a title, what you bring, what you need, and a deadline.' };
    const lines = live.slice(0, 6).map((p) =>
      `• "${p.title}" — ${p.status}${p.status === 'quorum' ? ' ✓ quorum reached' : ''}, `
      + `${p.participants ?? 0}/${p.minParticipants ?? 0} in, needs ${p.requiredMet ?? 0}/${p.required ?? 0}${p.deadline ? `, by ${p.deadline.slice(0, 10)}` : ''}`);
    return {
      answer: `${live.length} open possibilit${live.length === 1 ? 'y' : 'ies'}:\n${lines.join('\n')}`,
      citedNodeIds: [], citedOverlapIds: [], intent: 'possibility',
    };
  }

  // trust graph — "who trusts whom" / mutual recognition
  if (/\b(trust|mutual|recognition|trusts whom|appreciat)/.test(q) && ctx.trust) {
    const mutual = ctx.trust.filter((e) => e.mutual > 0).slice(0, 6);
    if (!mutual.length)
      return { ...none, intent: 'trust',
        answer: 'No mutual recognition yet — appreciation is pairwise; mutual recognition needs appreciation in both directions.' };
    return {
      answer: `Mutual recognition (min of reciprocal appreciation):\n${mutual.map((e) => `• ${e.from} ↔ ${e.to} — ${e.mutual}`).join('\n')}\nMutual recognition steers which cards surface to whom.`,
      citedNodeIds: [], citedOverlapIds: [], intent: 'trust',
    };
  }

  // standing / reputation — "what's X's standing", "who is trusted most"
  if (/\b(standing|reputation|trusted|score|earned|assurance)\b/.test(q) && ctx.standing) {
    const rows = [...ctx.standing].sort((a, b) => b.trustScore - a.trustScore).slice(0, 6);
    if (!rows.length)
      return { ...none, intent: 'standing', answer: 'No recognition recorded yet — appreciations and assurance credits build the earned ledger.' };
    return {
      answer: `Standing (√-normalised EigenTrust on mutual recognition):\n`
        + rows.map((r) => `• ${r.id} — earned ${r.earned}, trust ${r.trustScore}${r.assuranceCredits ? `, +${r.assuranceCredits} assurance (pledged on expired cards)` : ''}`).join('\n')
        + '\nEarned is append-only — the record of work, never the spendable balance.',
      citedNodeIds: [], citedOverlapIds: [], intent: 'standing',
    };
  }

  // "what happened at X" — completed cards carry reports
  if (/\b(happened|report|outcome|how did|went)\b/.test(q) && ctx.possibilities) {
    const done = ctx.possibilities.filter((p) => p.status === 'completed' || p.report);
    if (!done.length)
      return { ...none, intent: 'report', answer: 'Nothing completed yet — reports land on possibility cards post-event.' };
    const lines = done.slice(0, 5).map((p) =>
      `• "${p.title}"${p.report ? ` — ${p.report.summary}` : ' — completed, no report filed'}`);
    return {
      answer: `Completed:\n${lines.join('\n')}`,
      citedNodeIds: [], citedOverlapIds: [], intent: 'report',
    };
  }

  // eight forms of capital — how much of the flow is non-monetary
  if (/\b(capital|resources rallied|eight forms|non-monetary|in-kind)/.test(q)) {
    const rows = ctx.nodes.filter((n) => n.kind === 'offer' || isNeed(n));
    const by: Record<string, number> = {};
    for (const n of rows) { const c = inferCapital(n); if (c) by[c] = (by[c] ?? 0) + 1; }
    const lines = Object.entries(by).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `• ${k}: ${v}`).join('\n');
    return {
      answer: `${rows.length} commitments across ${Object.keys(by).length} capital forms:\n${lines}\nMoney is one stream among eight — the same channels carry tools, hours and seeds.`,
      citedNodeIds: rows.map((n) => n.id).slice(0, 20), citedOverlapIds: [],
      intent: 'capital',
    };
  }

  // offers / needs — the CLC commitment surface
  const offerHit = /\b(offer|offers|offered|provides?|supplies|available|selling)\b/.test(q);
  const needHit = /\b(need|needs|needed|seeking|seek|requires?|unmet|missing|looking for)\b/.test(q);
  if (offerHit || needHit) {
    const place = PLACE_WORDS.exec(query)?.[1];
    const role = offerHit && !needHit ? 'offer' : needHit && !offerHit ? 'need' : undefined;
    const offers = findCommitments(ctx, 'offer', query, place);
    const needs = findCommitments(ctx, 'need', query, place);
    const rows = (role === 'offer' ? offers : role === 'need' ? needs : [...offers, ...needs])
      .slice(0, 6);
    if (!rows.length)
      return { ...none, intent: role ?? 'offer',
        answer: `No ${role ?? 'commitment'} nodes match${place ? ` near "${place}"` : ''} — import CLC voucher data or plans stating needs.` };
    const lines = rows.map((n) =>
      `• ${n.id} — ${n.kind === 'offer' ? 'OFFER' : 'NEED'}: "${n.label}"${n.placeId ? ` (${n.placeId})` : ''}${n.terms ? ` · ${n.terms}` : ''}`);
    return {
      answer: `${rows.length} commitment${rows.length > 1 ? 's' : ''}${place ? ` near "${place}"` : ''}:\n${lines.join('\n')}`,
      citedNodeIds: rows.map((n) => n.id), citedOverlapIds: [],
      intent: role ?? 'offer',
    };
  }

  // default: overlap query, optionally place-scoped — only if the query is
  // actually about overlaps/plans; otherwise stay 'unknown' honestly.
  const place = PLACE_WORDS.exec(query)?.[1];
  const topical = /overlap|dup|same|conflict|align|shared|coordinat|plan|where|who/.test(q) || !!place;
  if (!topical) return none;
  const recs = findOverlaps(ctx, place);
  if (!recs.length) {
    return {
      answer: place
        ? `No flagged overlaps matching "${place}". Try a broader area or import more plans.`
        : 'No overlaps flagged yet.',
      citedNodeIds: [], citedOverlapIds: [], intent: 'overlap',
    };
  }
  const lines = recs.slice(0, 5).map((r) => `• ${r.id} — ${describe(r, ctx)} [${r.status}]`);
  return {
    answer: `${recs.length} overlap${recs.length > 1 ? 's' : ''}${place ? ` matching "${place}"` : ''}:\n${lines.join('\n')}`,
    citedNodeIds: recs.flatMap((r) => [...r.nodeIds]),
    citedOverlapIds: recs.map((r) => r.id),
    intent: 'overlap',
  };
}
