import { ExternalPlan, PlanNode, canonicalize, type NodeKind } from '@springforth/coordination';
import { z } from 'zod';

// OnePlanet adapter — normalises OnePlanet-style plans (outcomes, actions,
// organisations, places, indicators, frameworks) into PlanNode[] so the
// resolver can run over them. Three intake lanes:
//   1. fetchPlan(base,key,id) — the real API when hackathon credentials land
//   2. normalizePlan(raw)     — any JSON matching the OnePlanet-ish schema
//   3. fromCsv / fromMarkdown — community plans that live outside OnePlanet
// All three produce the same ExternalPlan shape.

const OpNode = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  outcomeId: z.union([z.string(), z.number()]).transform(String).optional(),
  organisationIds: z.array(z.union([z.string(), z.number()])).transform((a) => a.map(String)).optional(),
  placeId: z.union([z.string(), z.number()]).transform(String).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
});
const OpPlan = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().optional(),
  name: z.string().optional(),
  owner: z.string().optional(),
  outcomes: z.array(OpNode).default([]),
  actions: z.array(OpNode).default([]),
  organisations: z.array(OpNode).default([]),
  places: z.array(OpNode).default([]),
  indicators: z.array(OpNode).default([]),
  frameworks: z.array(OpNode).default([]),
});

type CollectionKey = 'outcomes' | 'actions' | 'organisations' | 'places' | 'indicators' | 'frameworks';
const KIND: [CollectionKey, NodeKind][] = [
  ['outcomes', 'outcome'], ['actions', 'action'], ['organisations', 'organisation'],
  ['places', 'place'], ['indicators', 'indicator'], ['frameworks', 'framework'],
];

export function normalizePlan(raw: unknown, source = 'oneplanet'): ExternalPlan {
  const p = OpPlan.parse(raw);
  const planId = `oneplanet:${p.id}`;
  // placeId stores the canonical place *name* — cross-source place matching
  // happens on names, not ids, which are meaningless across systems.
  const placeIds = new Map(p.places.map((pl) => [
    pl.id, canonicalize(pl.title ?? pl.name ?? `place-${pl.id}`)]));
  const nodes: PlanNode[] = [];
  for (const [key, kind] of KIND) {
    for (const n of p[key]) {
      const label = n.title ?? n.name ?? `${kind} ${n.id}`;
      nodes.push(PlanNode.parse({
        id: `${planId}-${kind}-${n.id}`, kind, label,
        canonical: canonicalize(label), source: planId,
        placeId: n.placeId ? placeIds.get(n.placeId) : undefined,
        parentOutcomeId: n.outcomeId ? `${planId}-outcome-${n.outcomeId}` : undefined,
        orgIds: (n.organisationIds ?? []).map((o) => `${planId}-organisation-${o}`),
        timeframe: { from: n.startDate, to: n.endDate },
        budget: n.budget, description: n.description ?? '',
      }));
    }
  }
  return ExternalPlan.parse({
    id: `${planId}`, source: planId,
    title: p.title ?? p.name ?? `Plan ${p.id}`, owner: p.owner,
    importedAt: new Date().toISOString(), nodes,
  });
}

// Real API client — auto-dispatch: `opk_` keys / mcp.* endpoints go through
// the MCP lane (OnePlanet's actual transport); plain REST remains fallback.
export async function fetchPlan(base: string, key: string, planId: string): Promise<ExternalPlan> {
  if (key.startsWith('opk_') || base.includes('mcp')) {
    const { fetchPlanMcp } = await import('./mcp.js');
    return fetchPlanMcp(base, key, planId);
  }
  const res = await fetch(`${base.replace(/\/$/, '')}/plans/${planId}`, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`oneplanet ${res.status}`);
  return normalizePlan(await res.json());
}

// Write lane (create_* MCP tools on write-capable keys).
export { pushPlanNodes, pushNodesWith, pushProgress } from './mcp.js';
export type { PushResult } from './mcp.js';

// CSV lane: rows of kind,label,place,outcome,org,start,budget → one plan.
export function fromCsv(csv: string, source = 'csv:upload'): ExternalPlan {
  const [head, ...rows] = csv.trim().split(/\r?\n/);
  const cols = head!.split(',').map((c) => c.trim().toLowerCase());
  const nodes = rows.filter(Boolean).map((row, i) => {
    const cells = row.split(',');
    const f = (k: string) => cells[cols.indexOf(k)]?.trim();
    const label = f('label') ?? `row-${i}`;
    const kind = (f('kind') ?? 'action') as NodeKind;
    return PlanNode.parse({
      id: `${source}-${i}`, kind, label, canonical: canonicalize(label), source,
      placeId: f('place') ? canonicalize(f('place')!) : undefined,
      parentOutcomeId: f('outcome') ? `${source}-outcome-${f('outcome')}` : undefined,
      orgIds: f('org') ? [f('org')!] : [],
      timeframe: { from: f('start') || undefined },
      budget: f('budget') ? Number(f('budget')) : undefined,
    });
  });
  return ExternalPlan.parse({
    id: source, source, title: source,
    importedAt: new Date().toISOString(), nodes,
  });
}

// Markdown lane: '# Outcome' then '- action' bullets — the lowest-tech intake
// for community groups that plan in docs.
export function fromMarkdown(md: string, source = 'md:upload'): ExternalPlan {
  const nodes: PlanNode[] = [];
  let outcome: string | undefined, n = 0;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#+\s+(.+)/);
    const li = line.match(/^[-*]\s+(.+)/);
    if (h) {
      outcome = `${source}-outcome-${n}`;
      nodes.push(PlanNode.parse({
        id: outcome, kind: 'outcome', label: h[1]!,
        canonical: canonicalize(h[1]!), source,
      }));
      n++;
    } else if (li) {
      nodes.push(PlanNode.parse({
        id: `${source}-action-${n++}`, kind: 'action', label: li[1]!,
        canonical: canonicalize(li[1]!), source,
        parentOutcomeId: outcome,
      }));
    }
  }
  return ExternalPlan.parse({
    id: source, source, title: source,
    importedAt: new Date().toISOString(), nodes,
  });
}
