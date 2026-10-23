// Format adapters — offline intake formats (Sarafu CLC, Holons, Artizen,
// Valueflows). Each normalizes an exported dataset to an ExternalPlan;
// no live fetching except fetchSarafu (public indexer).
import { CapitalForm, ExternalPlan, PlanNode, canonicalize } from "../coordination";
import { latLngToCell } from "h3-js";
import { z } from "zod";

// ── clc ────────────────────────────────────────────────────────────
// Cosmo-Local Credit / Sarafu adapter — normalises CLC commitments into the
// plan graph so needs×offers matching can run over them (see
// detectComplements in @springforth/coordination). Three intake lanes:
//   1. fetchSarafu(base)  — live public tRPC on the Sarafu app
//   2. fromJson(data)     — fixture lane: {vouchers:[], pools:[]}
//   3. fetchChain(rpc, calls) — env-gated generic eth_call reader (stretch)
// Vouchers become 'offer' nodes; commitment pools become 'framework' nodes
// (the curation boundary — who stewards it, what rules apply, which
// vouchers it lists). Needs are not Sarafu data — they arrive via plan
// adapters or are inferred from action-verbs by the resolver.
//
// Terms of use: a voucher is a *published commitment*, not proof of
// delivery. `terms` carries the issuer's stated conditions; `capacity` is
// only set when the source declares it. Field names verified against
// https://sarafu.network/api/trpc/{voucher,pool}.list (Oct 19).

const Geo = z.object({ x: z.number(), y: z.number() }).nullable().optional();

export const SarafuVoucher = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  voucher_address: z.string().optional(),
  voucher_name: z.string().min(1),
  voucher_description: z.string().nullable().optional(),
  geo: Geo,                                    // x = latitude, y = longitude
  location_name: z.string().nullable().optional(),
  voucher_type: z.string().optional(),         // 'GIFTABLE', …
  voucher_uoa: z.string().optional(),          // unit of account, e.g. 'KES'
  symbol: z.string().optional(),
  voucher_value: z.union([z.string(), z.number()]).optional(),
  sink_address: z.string().nullable().optional(),
  redemption_address: z.string().nullable().optional(),
  transaction_count: z.union([z.string(), z.number()]).transform(Number).optional(),
  created_at: z.string().optional(),
  capacity: z.string().optional(),             // non-standard; honoured if present
  capital: CapitalForm.optional(),             // explicit form override for fixtures
}).passthrough();
export type SarafuVoucher = z.infer<typeof SarafuVoucher>;

export const SarafuPool = z.object({
  contract_address: z.string().optional(),
  pool_name: z.string().min(1),
  pool_symbol: z.string().optional(),
  description: z.string().nullable().optional(),
  geo: Geo,
  tags: z.array(z.string()).default([]),
  swap_count: z.union([z.string(), z.number()]).transform(Number).optional(),
  voucher_count: z.union([z.string(), z.number()]).transform(Number).optional(),
}).passthrough();
export type SarafuPool = z.infer<typeof SarafuPool>;

const H3_RES = 5;                               // ~250 km² cells — neighbourhood scale
const h3For = (geo: { x: number; y: number } | null | undefined) =>
  geo && Math.abs(geo.x) <= 90 && Math.abs(geo.y) <= 180
    ? latLngToCell(geo.x, geo.y, H3_RES)
    : undefined;

export function normalizeVoucher(v: unknown, source = 'sarafu'): PlanNode {
  const s = SarafuVoucher.parse(v);
  const desc = s.voucher_description ?? '';
  return PlanNode.parse({
    id: `${source}-offer-${s.symbol ?? s.id}`,
    kind: 'offer',
    label: s.voucher_name,
    canonical: canonicalize(`${s.voucher_name} ${desc}`),
    source,
    placeId: s.location_name ? canonicalize(s.location_name) : undefined,
    h3: h3For(s.geo),
    orgIds: s.voucher_address ? [`${source}-issuer-${s.voucher_address}`] : [],
    tags: ['voucher', ...(s.voucher_uoa ? [s.voucher_uoa] : []),
      ...(s.transaction_count ? ['active'] : [])],
    timeframe: { from: s.created_at },
    description: desc,
    terms: [s.symbol, s.voucher_uoa, s.voucher_type,
      s.redemption_address ? 'redemption address set' : undefined,
    ].filter(Boolean).join(' · ') || undefined,
    capacity: s.capacity,
    capital: s.capital,                          // else inferCapital() at read
  });
}

// A commitment pool is the curation/stewardship boundary — modelled as a
// framework node so offers can be grouped and matched within it.
export function normalizeClcPool(p: unknown, source = 'sarafu'): PlanNode {
  const s = SarafuPool.parse(p);
  return PlanNode.parse({
    id: `${source}-pool-${s.pool_symbol ?? canonicalize(s.pool_name).replace(/\s+/g, '-')}`,
    kind: 'framework',
    label: s.pool_name,
    canonical: canonicalize(`${s.pool_name} ${s.description ?? ''}`),
    source,
    h3: h3For(s.geo),                                // pools carry geo only — no place name field
    tags: ['commitment-pool', ...s.tags],
    description: s.description ?? '',
    terms: s.swap_count !== undefined
      ? `${s.voucher_count ?? '?'} vouchers · ${s.swap_count} swaps` : undefined,
  });
}

export const ClcDataset = z.object({
  vouchers: z.array(z.unknown()).default([]),
  pools: z.array(z.unknown()).default([]),
});

// Fixture / upload lane — `{vouchers:[…], pools:[…]}` → one ExternalPlan.
export function fromClcJson(data: unknown, source = 'sarafu'): ExternalPlan {
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  const { vouchers, pools } = ClcDataset.parse(d);
  const nodes = [
    ...vouchers.map((v) => normalizeVoucher(v, source)),
    ...pools.map((p) => normalizeClcPool(p, source)),
  ];
  if (!nodes.length) throw new Error('clc dataset produced no nodes');
  return ExternalPlan.parse({
    id: source, source, title: `CLC commitments (${source})`,
    importedAt: new Date().toISOString(), nodes,
  });
}

// Live lane — the Sarafu app's public tRPC surface. `limit` bounds the
// offer set before it enters the graph (2.5k+ vouchers otherwise flood
// complement detection; the resolver also caps records per run).
export async function fetchSarafu(
  base = 'https://sarafu.network', opts: { limit?: number; source?: string } = {},
): Promise<ExternalPlan> {
  const b = base.replace(/\/$/, '');
  const source = opts.source ?? 'sarafu';
  const trpc = async (proc: string) => {
    const res = await fetch(`${b}/api/trpc/${proc}?input=${encodeURIComponent('{"json":{}}')}`);
    if (!res.ok) throw new Error(`sarafu ${proc} ${res.status}`);
    const d = await res.json() as { result?: { data?: { json?: unknown } } };
    return d?.result?.data?.json;
  };
  const [vouchers, pools] = await Promise.all([trpc('voucher.list'), trpc('pool.list')]);
  return fromClcJson({
    vouchers: (vouchers as unknown[] ?? []).slice(0, opts.limit ?? 250),
    pools: pools as unknown[] ?? [],
  }, source);
}

// Stretch lane — generic Celo JSON-RPC eth_call executor. ABI encoding is
// the caller's job (we don't vendor contract ABIs for raw reads); callers
// pass {to, data} pairs and get raw hex results back. Unused unless the
// stretch contracts lane activates.
export async function fetchChain(
  rpc: string, calls: { to: string; data: string }[],
): Promise<string[]> {
  return Promise.all(calls.map(async (c, i) => {
    const res = await fetch(rpc, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: i + 1, method: 'eth_call',
        params: [{ to: c.to, data: c.data }, 'latest'],
      }),
    });
    const d = await res.json() as { result?: string; error?: { message: string } };
    if (d.error) throw new Error(`eth_call: ${d.error.message}`);
    return d.result ?? '0x';
  }));
}

// ── holons ────────────────────────────────────────────────────────────
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
export { CapitalForm } from '../coordination';

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
export function fromHolonsJson(data: unknown, source = 'holons'): ExternalPlan {
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

// ── artizen ────────────────────────────────────────────────────────────
// Artizen adapter — normalises Artizen ecosystem data into the plan graph
// so artifact-backed projects can coordinate with community needs/offers
// and council plans (Telegram-export review, Oct 19).
//
// Upstream surfaces (license-checked):
//   - artizen-fund/artizen-frontend (MIT)  — Hasura data model, GraphQL types
//   - artizen-fund/seasons-contractsV2 (MIT) — season/submission/artifact
//     fields: tokenPrice, artistFeePercentage, treasurySplitPercentage
//   - artizen.fyi/projects + community-scraped fund→project matrix — data
//     lanes only; fixture-first so the demo never depends on uptime
//   - creator payout records (Venus "payout-only mode") — owed amounts are
//     internal accounting; the UI never surfaces shortfalls.
//
// Mapping:
//   season / fund   → 'framework' node (curator boundary — the fund's
//                     organising membrane in the plan graph)
//   project         → 'action' node  (tagged fund:<id> to keep provenance)
//   project need    → 'need' node    (requirements stated as goods/services —
//                     "what the $$$ would pay for", the resourcing framing)
//   artifact        → 'offer' node   (open-edition mint: terms carry edition
//                     price/supply/royalty split — proceeds fund the project)
//   owed record     → tag on the project node (internal accounting only)

export const ArtizenSeason = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  curators: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type ArtizenSeason = z.infer<typeof ArtizenSeason>;

export const ArtizenProject = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  seasonId: z.union([z.string(), z.number()]).transform(String).optional(),
  fundIds: z.array(z.string()).default([]),   // links-matrix provenance
  needs: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    amount: z.number().optional(),
    deadline: z.string().optional(),
  })).default([]),
  budget: z.number().optional(),
  owed: z.number().optional(),               // unpaid artifact proceeds —
                                             // internal accounting, never UI
  place: z.string().optional(),
  status: z.string().optional(),
}).passthrough();
export type ArtizenProject = z.infer<typeof ArtizenProject>;

export const ArtizenArtifact = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  projectId: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  tokenPrice: z.union([z.string(), z.number()]).optional(),
  supply: z.union([z.string(), z.number()]).optional(),   // open-edition size
  artistFeePercentage: z.number().optional(),
  treasurySplitPercentage: z.number().optional(),
  contract: z.string().optional(),
  tokenId: z.union([z.string(), z.number()]).optional(),
  image: z.string().optional(),              // URL only — we never store media
}).passthrough();
export type ArtizenArtifact = z.infer<typeof ArtizenArtifact>;

export const ArtizenExport = z.object({
  seasons: z.array(ArtizenSeason).default([]),
  projects: z.array(ArtizenProject).default([]),
  artifacts: z.array(ArtizenArtifact).default([]),
});
export type ArtizenExport = z.infer<typeof ArtizenExport>;

export function fromArtizenJson(data: unknown, source = 'artizen'): ExternalPlan {
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  const { seasons, projects, artifacts } = ArtizenExport.parse(d);
  const projById = new Map(projects.map((p) => [p.id, p]));

  const nodes: PlanNode[] = [
    ...seasons.map((s) => PlanNode.parse({
      id: `artizen-fund-${s.id}`, kind: 'framework', label: s.name,
      canonical: canonicalize(s.name), source,
      orgIds: s.curators,
      timeframe: { from: s.startDate, to: s.endDate },
      tags: ['curated-fund'],
      terms: s.curators.length ? `curators: ${s.curators.join(', ')}` : undefined,
      description: `Artizen season/fund — curator boundary.`,
    })),
    ...projects.flatMap((p) => [
      PlanNode.parse({
        id: `artizen-proj-${p.id}`, kind: 'action', label: p.title,
        canonical: canonicalize(`${p.title} ${p.description ?? ''}`),
        source,
        orgIds: p.owner ? [p.owner] : [],
        placeId: p.place ? canonicalize(p.place) : undefined,
        budget: p.budget,
        tags: [...p.fundIds.map((f) => `fund:${f}`),
          ...(p.owed ? ['owed-outstanding'] : []),   // internal flag only
          ...(p.status ? [p.status] : [])],
        description: p.description ?? '',
      }),
      ...p.needs.map((n, i) => PlanNode.parse({
        id: `artizen-need-${p.id}-${i}`, kind: 'need', label: n.title,
        canonical: canonicalize(`${n.title} ${n.description ?? ''}`),
        source,
        orgIds: p.owner ? [p.owner] : [],
        placeId: p.place ? canonicalize(p.place) : undefined,
        timeframe: { to: n.deadline },
        budget: n.amount,
        parentOutcomeId: `artizen-proj-${p.id}`,
        tags: [...p.fundIds.map((f) => `fund:${f}`)],
        description: n.description ?? `resource requirement of ${p.title}`,
      })),
    ]),
    ...artifacts.map((a) => {
      const proj = projById.get(a.projectId);
      return PlanNode.parse({
        id: `artizen-offer-${a.id ?? `${a.projectId}-${a.tokenId ?? 'ed'}`}`,
        kind: 'offer', label: a.title, source,
        capital: 'cultural',                     // artifacts are cultural capital
        canonical: canonicalize(`${a.title} ${proj?.title ?? ''}`),
        orgIds: proj?.owner ? [proj.owner] : [],
        parentOutcomeId: `artizen-proj-${a.projectId}`,
        tags: ['artifact', ...((proj?.fundIds ?? []).map((f) => `fund:${f}`))],
        description: proj?.description ?? '',
        terms: [
          a.tokenPrice !== undefined ? `edition price ${a.tokenPrice}` : undefined,
          a.supply !== undefined ? `supply ${a.supply}` : undefined,
          a.artistFeePercentage !== undefined
            ? `creator royalty ${a.artistFeePercentage}%` : undefined,
          a.treasurySplitPercentage !== undefined
            ? `treasury split ${a.treasurySplitPercentage}%` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      });
    }),
  ];
  if (!nodes.length) throw new Error('artizen export produced no nodes');
  return ExternalPlan.parse({
    id: source, source, title: `Artizen ecosystem (${source})`,
    importedAt: new Date().toISOString(), nodes,
  });
}

// ── vf ────────────────────────────────────────────────────────────
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
export function fromVfJson(data: unknown, source = 'vf'): ExternalPlan {
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
