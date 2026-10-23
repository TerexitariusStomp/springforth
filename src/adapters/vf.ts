import { ExternalPlan, PlanNode, canonicalize } from '../coordination';
import { z } from 'zod';

// ValueFlows adapter — the interop bridge to playnet (rad:z27dFkN28L…,
// "a self-evolving commons computer", AGPL-3.0) and any VF-speaking
// network (Holo-REA, hREA, Sensorica-era exports). VF is the canonical
// vocabulary for exactly what our needs/offers model: intents →
// commitments → economic events.
//
// Input: standard VF JSON — either a grouped export
//   { agents[], resourceSpecifications[], intents[], commitments[],
//     proposals[], processes[], economicEvents[] }
// or a JSON-LD @graph where each member carries "@type": "Intent" etc.
//
// Mapping (VF → plan graph):
//   agent / person+organisation  → 'organisation' node
//   resourceSpecification        → 'framework' node (catalog type)
//   proposal                     → 'framework' node tagged 'vf:proposal'
//   process                      → 'action' node
//   economicEvent                → 'action' node tagged 'vf:event' (delivery evidence)
//   intent/commitment            → 'offer' when provider is set, else 'need'
//                                  (commitments tagged 'committed', satisfied
//                                  intents tagged 'satisfied')
//
// Playnet's wire format is goblins s-expressions (@vf TypeName alist) —
// their serdes.scm registers a JSON output the same way, so a playnet
// node can export this shape without any change on our side.

const Qty = z.object({
  hasNumericalValue: z.union([z.number(), z.string()]).transform(String).optional(),
  hasUnit: z.union([z.string(), z.object({ label: z.string().optional() }).transform((u) => u.label ?? '')]).optional(),
}).partial().optional();

const Loc = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    lat: z.union([z.number(), z.string()]).optional(),
    long: z.union([z.number(), z.string()]).optional(),
  }),
]).optional();

// VF flows share one shape across intent/commitment/economicEvent —
// provider/receiver direction is what separates needs from offers.
const VfFlow = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  name: z.string().optional(),
  action: z.string().optional(),
  provider: z.union([z.string(), z.object({ id: z.union([z.string(), z.number()]).transform(String) })]).optional(),
  receiver: z.union([z.string(), z.object({ id: z.union([z.string(), z.number()]).transform(String) })]).optional(),
  resourceConformsTo: z.union([z.string(), z.object({ name: z.string().optional() }).transform((r) => r.name ?? '')]).optional(),
  resourceClassifiedAs: z.array(z.string()).default([]),
  resourceQuantity: Qty,
  effortQuantity: Qty,
  note: z.string().optional(),
  atLocation: Loc,
  inScopeOf: z.array(z.union([z.string(), z.object({ id: z.union([z.string(), z.number()]).transform(String) })])).default([]),
  hasBeginning: z.string().optional(),
  hasEnd: z.string().optional(),
  due: z.string().optional(),
  satisfiedBy: z.array(z.unknown()).default([]),
  finished: z.boolean().optional(),
}).passthrough();
type VfFlow = z.infer<typeof VfFlow>;

const VfAgent = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  note: z.string().optional(),
}).passthrough();

const VfSpec = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  note: z.string().optional(),
  resourceClassifiedAs: z.array(z.string()).default([]),
}).passthrough();

const VfProposal = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional(),
  note: z.string().optional(),
  hasBeginning: z.string().optional(),
  hasEnd: z.string().optional(),
}).passthrough();

const VfProcess = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  note: z.string().optional(),
  hasBeginning: z.string().optional(),
  hasEnd: z.string().optional(),
  inScopeOf: z.array(z.union([z.string(), z.object({ id: z.union([z.string(), z.number()]).transform(String) })])).default([]),
}).passthrough();

export const VfDataset = z.object({
  agents: z.array(z.unknown()).default([]),
  resourceSpecifications: z.array(z.unknown()).default([]),
  intents: z.array(z.unknown()).default([]),
  commitments: z.array(z.unknown()).default([]),
  proposals: z.array(z.unknown()).default([]),
  processes: z.array(z.unknown()).default([]),
  economicEvents: z.array(z.unknown()).default([]),
});

const idOf = (v: unknown): string | undefined => {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'id' in v) return String((v as { id: unknown }).id);
  return undefined;
};

const locName = (l: z.infer<typeof Loc>): { name?: string; h3?: string } => {
  if (!l) return {};
  if (typeof l === 'string') return { name: l };
  return { name: l.name };
};

const qtyStr = (q: z.infer<typeof Qty>, label: string) =>
  q?.hasNumericalValue ? `${label} ${q.hasNumericalValue}${q.hasUnit ? ` ${q.hasUnit}` : ''}` : undefined;

// Direction rule: a flow naming a provider is that provider's published
// offer; a flow naming only a receiver/scope is the community's need.
// (In VF a "request" is an intent with no provider; a "listing" has one.)
const flowKind = (f: VfFlow): 'offer' | 'need' => (f.provider ? 'offer' : 'need');

const flowLabel = (f: VfFlow): string =>
  f.name ?? ([f.action, typeof f.resourceConformsTo === 'string' ? f.resourceConformsTo : undefined]
    .filter(Boolean).join(' ') || 'vf flow');

export function normalizeFlow(f: unknown, kind: 'intent' | 'commitment' | 'event', source: string): PlanNode {
  const s = VfFlow.parse(f);
  const loc = locName(s.atLocation);
  const tags = [
    `vf:${kind}`,
    ...(kind === 'commitment' ? ['committed'] : []),
    ...(kind === 'intent' && (s.finished || s.satisfiedBy.length) ? ['satisfied'] : []),
    ...(s.action ? [s.action] : []),
  ];
  const desc = [s.note, s.action ? `action: ${s.action}` : undefined].filter(Boolean).join(' · ');
  return PlanNode.parse({
    id: `${source}-${kind}-${s.id ?? canonicalize(flowLabel(s)).replace(/\s+/g, '-').slice(0, 40)}`,
    kind: kind === 'event' ? 'action' : flowKind(s),
    label: flowLabel(s),
    canonical: canonicalize(`${flowLabel(s)} ${desc}`),
    source,
    placeId: loc.name ? canonicalize(loc.name) : undefined,
    orgIds: [idOf(s.provider), ...s.inScopeOf.map(idOf)].filter((x): x is string => Boolean(x)),
    tags,
    timeframe: { from: s.hasBeginning, to: s.hasEnd ?? s.due },
    description: desc,
    terms: [qtyStr(s.resourceQuantity, 'qty'), qtyStr(s.effortQuantity, 'effort')]
      .filter(Boolean).join(' · ') || undefined,
  });
}

// Grouped-export lane AND JSON-LD @graph lane — one entry point.
export function fromJson(data: unknown, source = 'vf'): ExternalPlan {
  let d = typeof data === 'string' ? JSON.parse(data) : data;
  // @graph: split members by @type into the grouped shape.
  if (d && typeof d === 'object' && '@graph' in (d as Record<string, unknown>)) {
    const g = (d as { '@graph': { '@type'?: string }[] })['@graph'];
    const pick = (t: string) => g.filter((m) => (m['@type'] ?? '').toLowerCase().includes(t.toLowerCase()));
    d = {
      agents: pick('agent'), resourceSpecifications: pick('ResourceSpecification'),
      intents: pick('intent'), commitments: pick('commitment'),
      proposals: pick('proposal'), processes: pick('process'),
      economicEvents: pick('economicEvent'),
    };
  }
  const { agents, resourceSpecifications, intents, commitments, proposals, processes, economicEvents } =
    VfDataset.parse(d);
  const nodes: PlanNode[] = [
    ...agents.map((a) => {
      const s = VfAgent.parse(a);
      return PlanNode.parse({
        id: `${source}-agent-${s.id}`, kind: 'organisation', label: s.name,
        canonical: canonicalize(s.name), source, tags: ['vf:agent'],
        description: s.note ?? '', timeframe: {},
      });
    }),
    ...resourceSpecifications.map((r) => {
      const s = VfSpec.parse(r);
      return PlanNode.parse({
        id: `${source}-spec-${s.id}`, kind: 'framework', label: s.name,
        canonical: canonicalize(`${s.name} ${s.note ?? ''}`), source,
        tags: ['vf:spec', ...s.resourceClassifiedAs],
        description: s.note ?? '', timeframe: {},
      });
    }),
    ...proposals.map((p) => {
      const s = VfProposal.parse(p);
      return PlanNode.parse({
        id: `${source}-proposal-${s.id}`, kind: 'framework',
        label: s.name ?? `proposal ${s.id}`,
        canonical: canonicalize(`${s.name ?? ''} ${s.note ?? ''}`), source,
        tags: ['vf:proposal'], description: s.note ?? '',
        timeframe: { from: s.hasBeginning, to: s.hasEnd },
      });
    }),
    ...processes.map((p) => {
      const s = VfProcess.parse(p);
      return PlanNode.parse({
        id: `${source}-process-${s.id}`, kind: 'action', label: s.name,
        canonical: canonicalize(`${s.name} ${s.note ?? ''}`), source,
        orgIds: s.inScopeOf.map(idOf).filter((x): x is string => Boolean(x)),
        tags: ['vf:process'], description: s.note ?? '',
        timeframe: { from: s.hasBeginning, to: s.hasEnd },
      });
    }),
    ...intents.map((i) => normalizeFlow(i, 'intent', source)),
    ...commitments.map((c) => normalizeFlow(c, 'commitment', source)),
    ...economicEvents.map((e) => normalizeFlow(e, 'event', source)),
  ];
  if (!nodes.length) throw new Error('vf dataset produced no nodes');
  return ExternalPlan.parse({
    id: source, source, title: `ValueFlows exchange (${source})`,
    importedAt: new Date().toISOString(), nodes,
  });
}
