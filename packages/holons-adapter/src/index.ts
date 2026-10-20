import { ExternalPlan, PlanNode, canonicalize } from '@springforth/coordination';
import { z } from 'zod';

// Holons i/o adapter — normalises a Holons community export into the plan
// graph so needs×offers matching runs over chat-native coordination data.
// (Upstream: github.com/liminalvillage/holons + liminalvillage/harvest,
// AGPL-3.0 — their unified Quest model treats task/proposal/event/offer/
// request as one shape with one lifecycle; the bot verbs are /offer,
// /request, /task, /appreciate, /spent, /balance, /federate.)
//
// Mapping (Telegram-export review, Oct 19):
//   holon            → 'framework' node (the membrane: curation boundary,
//                      shared purpose; pools formed from it carry stewards)
//   offer            → 'offer' node  (published commitment, terms optional)
//   request          → 'need' node   ("needs have a deadline and an owner"
//                      — timeframe + orgIds carry both)
//   task / quest     → 'action' node (work item; 'we need…' phrasing is
//                      promoted to a need by the resolver's verb inference)
//   appreciation     → aggregates onto 'organisation' nodes as a signal —
//                      reputation input for later yield-steering weights
//   expense          → budget on its parent action node
//   member           → 'organisation' node (me-holon); holons nest — a
//                      member may itself be a we-holon elsewhere
//
// Fixture-first by design: this file takes plain JSON so a Telegram export
// script (bot-side or manual) can produce it without a code dependency on
// the Holons codebase. REA vocabulary (commitment/fulfilment events) maps
// onto the ledger at confirm time, not here.

export const HolonsMember = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  appreciations: z.number().int().nonnegative().optional(),
});
export type HolonsMember = z.infer<typeof HolonsMember>;

// Eight forms of capital ride the same channels ("money becomes one stream
// among eight") — `capital` tags which flow an item carries so offers/needs
// stay legible beyond money. The enum itself lives in @springforth/coordination.
export { CapitalForm } from '@springforth/coordination';
import { CapitalForm } from '@springforth/coordination';

export const HolonsItem = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  type: z.enum(['offer', 'request', 'task', 'quest', 'appreciation', 'expense', 'member', 'want', 'join', 'pass']),
  title: z.string().min(1),
  description: z.string().optional(),
  actor: z.string().optional(),            // author/member id (bot provenance)
  target: z.string().optional(),           // appreciated member / parent task
  terms: z.string().optional(),            // offer conditions, unit of account
  capacity: z.string().optional(),
  amount: z.number().optional(),           // expense amount / task budget
  currency: z.string().optional(),
  capital: CapitalForm.optional(),         // which of the 8 flows this rides on
  place: z.string().optional(),
  deadline: z.string().optional(),         // needs have a deadline
  createdAt: z.string().optional(),
  status: z.string().optional(),           // open / done / fulfilled
  tags: z.array(z.string()).default([]),
}).passthrough();
export type HolonsItem = z.infer<typeof HolonsItem>;

// Bot-command lane — parse the Holons bot verbs directly so a Telegram
// surface (grammy, MIT — roadmap) is a thin shell over this parser.
//   /offer Yoga on Tuesdays :: donation-based :: experiential
//   /request Someone to drive the truck Friday by 2026-10-24
//   /task Fix the kitchen door
//   /appreciate laura for organising the market
//   /join <possibility-slug>  → opt-in participation on a card
//   /pass <possibility-slug>  → logged pass (private, never public)
const CMD = /^\/(offer|request|task|quest|appreciate|expense|want|join|pass)\s+(.+)$/is;
export function parseCommand(text: string, actor: string): HolonsItem | null {
  const m = CMD.exec(text.trim());
  if (!m) return null;
  const [, verbRaw = '', rest = ''] = m;
  // bot verb → item type ('/appreciate' → 'appreciation')
  const type = verbRaw === 'appreciate' ? 'appreciation' : verbRaw;
  // '::' sections: title :: terms :: capital ; '@name' = target; 'by <date>' = deadline
  const [titlePart, termsPart, capitalPart] = rest.split('::').map((s) => s.trim());
  const deadline = /\bby\s+(\d{4}-\d{2}-\d{2})/i.exec(rest)?.[1];
  // '/join|/pass <possibility-slug> [bringing …]' — first token is the card;
  // '@name' remains the target syntax for /appreciate.
  const firstToken = (type === 'join' || type === 'pass')
    ? titlePart!.split(/\s+/)[0] : undefined;
  const target = firstToken ?? /@(\w+)/.exec(rest)?.[1];
  const amount = /(\d+(?:\.\d+)?)\s*(eur|usd|kes|gbp)/i.exec(rest);
  return HolonsItem.parse({
    type, title: titlePart!.replace(/@(\w+)/g, '').replace(/\bby\s+\S+/g, '').trim(),
    actor, target,
    terms: termsPart, capacity: undefined,
    capital: capitalPart?.toLowerCase(),
    amount: amount ? Number(amount[1]) : undefined,
    currency: amount?.[2]?.toUpperCase(),
    deadline, place: /(?:\bat|in)\s+([A-Z][\w\s-]{2,30})(?:\s+by\b|\s*$)/.exec(rest)?.[1]?.trim(),
  });
}

// A `/want` declaration (GDD possibility card): the composite declaration —
// "I want to…" + bringing + needs + thresholds + deadline. `needs`/`bringing`
// titles become need/offer nodes linked by possibilityId.
export const HolonsPossibility = z.object({
  title: z.string().min(1),
  declarer: z.string().min(1),
  place: z.string().optional(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  deadline: z.string().optional(),
  minParticipants: z.number().int().min(0).default(0),
  needs: z.array(z.object({
    title: z.string().min(1),
    required: z.boolean().default(true),
    capital: CapitalForm.optional(),
    terms: z.string().optional(),
  })).default([]),
  bringing: z.array(z.object({
    title: z.string().min(1),
    capital: CapitalForm.optional(),
    terms: z.string().optional(),
  })).default([]),
});
export type HolonsPossibility = z.infer<typeof HolonsPossibility>;

export const HolonsExport = z.object({
  holon: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().optional(),
  }),
  members: z.array(HolonsMember).default([]),
  items: z.array(HolonsItem).default([]),
  // Optional composite possibility — the edge layer creates the
  // Possibility entity and possibilityId-links its needs/offers.
  possibility: HolonsPossibility.optional(),
});
export type HolonsExport = z.infer<typeof HolonsExport>;

const slug = (s: string) => canonicalize(s).replace(/\s+/g, '-').slice(0, 40);

export function normalizeItem(
  item: HolonsItem, holonId: string, source: string,
): PlanNode | undefined {
  const id = item.id ?? slug(item.title);
  const base = {
    canonical: canonicalize(`${item.title} ${item.description ?? ''}`),
    source,
    placeId: item.place ? canonicalize(item.place) : undefined,
    orgIds: item.actor ? [`${holonId}-member-${item.actor}`] : [`${holonId}`],
    tags: item.tags,
    description: item.description ?? '',
    terms: item.terms,
    capacity: item.capacity,
    capital: item.capital,            // first-class field, not just a tag
  };
  switch (item.type) {
    case 'offer':
      return PlanNode.parse({
        id: `${holonId}-offer-${id}`, kind: 'offer', label: item.title,
        timeframe: { from: item.createdAt },
        ...base,
      });
    case 'request':
      return PlanNode.parse({
        id: `${holonId}-need-${id}`, kind: 'need', label: item.title,
        // owner + deadline — both are first-class fields already
        timeframe: { from: item.createdAt, to: item.deadline },
        ...base,
      });
    case 'task':
    case 'quest':
      return PlanNode.parse({
        id: `${holonId}-action-${id}`, kind: 'action', label: item.title,
        timeframe: { from: item.createdAt, to: item.deadline },
        budget: item.amount,
        ...base,
      });
    case 'expense':
      // an expense is spend on work — attach as an action carrying a budget
      return PlanNode.parse({
        id: `${holonId}-action-expense-${id}`, kind: 'action',
        label: item.title, budget: item.amount,
        timeframe: { from: item.createdAt },
        ...base,
      });
    case 'want':
      // a possibility declaration — a want is an intention needing
      // resourcing; lands as a need node so it enters the matching surface.
      return PlanNode.parse({
        id: `${holonId}-need-${id}`, kind: 'need', label: item.title,
        timeframe: { from: item.createdAt, to: item.deadline },
        ...base, tags: [...base.tags, 'possibility-decl'],
      });
    case 'join':
    case 'pass':
      return undefined;                      // action verbs — the transport
                                             // routes them to possibility
                                             // endpoints, not plannodes
    case 'appreciation':
    case 'member':
      return undefined;                      // folded into member nodes below
  }
}

// Possibility id for a composite declaration — the edge recreates the
// Possibility entity under this id so card/node linkage stays stable.
export const possibilityIdFor = (title: string) => `poss-${slug(title)}`;

// Fixture / export lane — `{holon, members, items, possibility?}` → one
// ExternalPlan. A composite `possibility` (the /want declaration) expands
// into its needs/bringing nodes, linked by possibilityId.
export function fromJson(data: unknown, source = 'holons'): ExternalPlan {
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  const { holon, members, items, possibility } = HolonsExport.parse(d);
  const holonId = `holons-${slug(holon.id)}`;

  // appreciations aggregate onto member nodes — the reputation signal that
  // later weights yield-steering votes (reputation-weighted, not deposit-)
  const applause = new Map<string, number>();
  for (const m of members) if (m.appreciations)
    applause.set(m.id, (applause.get(m.id) ?? 0) + m.appreciations);
  for (const i of items) if (i.type === 'appreciation' && i.target)
    applause.set(i.target, (applause.get(i.target) ?? 0) + 1);

  const nodes: PlanNode[] = [
    PlanNode.parse({
      id: holonId, kind: 'framework', label: holon.name,
      canonical: canonicalize(`${holon.name} ${holon.purpose ?? ''}`),
      source, description: holon.purpose ?? '',
      tags: ['holon'],
      terms: 'holon membrane — members may publish offers/requests across it',
    }),
    ...members.map((m) => PlanNode.parse({
      id: `${holonId}-member-${m.id}`, kind: 'organisation', label: m.name,
      canonical: canonicalize(m.name), source,
      orgIds: [`${holonId}-member-${m.id}`],
      tags: ['member', ...(applause.get(m.id) ? [`appreciations:${applause.get(m.id)}`] : [])],
      description: `member of ${holon.name}`
        + (applause.get(m.id) ? ` — ${applause.get(m.id)} appreciations` : ''),
    })),
    ...items.map((i) => normalizeItem(i, holonId, source))
      .filter((n): n is PlanNode => n !== undefined),
  ];
  // Composite possibility — its declared needs become required need-nodes
  // (quorum-blocking) and its bringing list becomes the declarer's offers.
  if (possibility) {
    const pid = possibilityIdFor(possibility.title);
    const owner = [`${holonId}-member-${possibility.declarer}`];
    nodes.push(
      ...possibility.needs.map((n, i) => PlanNode.parse({
        id: `${pid}-need-${i}`, kind: 'need', label: n.title,
        canonical: canonicalize(n.title), source, possibilityId: pid,
        required: n.required, orgIds: owner,
        placeId: possibility.place ? canonicalize(possibility.place) : undefined,
        terms: n.terms, capital: n.capital,
        timeframe: { to: possibility.deadline }, tags: ['possibility'],
      })),
      ...possibility.bringing.map((o, i) => PlanNode.parse({
        id: `${pid}-offer-${i}`, kind: 'offer', label: o.title,
        canonical: canonicalize(o.title), source, possibilityId: pid,
        orgIds: owner, terms: o.terms, capital: o.capital,
        tags: ['possibility', 'bringing'],
      })),
    );
  }
  if (!nodes.length) throw new Error('holons export produced no nodes');
  return ExternalPlan.parse({
    id: source, source, title: `Holons community (${holon.name})`,
    importedAt: new Date().toISOString(), nodes,
  });
}
