import { ExternalPlan, PlanNode, canonicalize } from '../coordination';
import { z } from 'zod';

// Open Collective adapter — the fund-flow transparency lane (Roberto's
// OC-integration idea: "see where funds are coming and going"). A fiscal
// host's collective normalises into the same graph as CLC vouchers and
// Holons offers:
//   collective → 'framework' node (the fiscal boundary — the host membrane)
//   tier       → 'offer' node  (a published way to give — financial capital,
//                  terms carry amount/interval: "what's on offer, for whom,
//                  when, how to access it")
//   expense    → 'need' node   (a payout request = a stated requirement;
//                  deadline none, owner = payee)
// Fixture-first like every adapter; the live lane reads the public
// `/<slug>.json` surface (no key needed for collective+members).

export const OcCollective = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  currency: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type OcCollective = z.infer<typeof OcCollective>;

export const OcTier = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  amount: z.number().optional(),
  interval: z.string().optional(),           // 'month' | 'year' | null
  description: z.string().optional(),
});
export type OcTier = z.infer<typeof OcTier>;

export const OcExpense = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  amount: z.number().optional(),             // minor units or units — kept verbatim in terms
  currency: z.string().optional(),
  payee: z.string().optional(),              // who needs it — the owner
  status: z.string().optional(),
  createdAt: z.string().optional(),
});
export type OcExpense = z.infer<typeof OcExpense>;

export const OcDataset = z.object({
  collective: OcCollective,
  tiers: z.array(OcTier).default([]),
  expenses: z.array(OcExpense).default([]),
  members: z.array(z.object({
    name: z.string().min(1), role: z.string().optional(),
  })).default([]),
});
export type OcDataset = z.infer<typeof OcDataset>;

export function fromJson(data: unknown, source = 'opencollective'): ExternalPlan {
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  const { collective, tiers, expenses, members } = OcDataset.parse(d);
  const sid = collective.slug;
  const nodes: PlanNode[] = [
    PlanNode.parse({
      id: `oc-fund-${sid}`, kind: 'framework', label: collective.name,
      canonical: canonicalize(`${collective.name} ${collective.description ?? ''}`),
      source,
      tags: ['fiscal-host', ...collective.tags],
      orgIds: members.filter((m) => m.role === 'ADMIN').map((m) => `oc-${sid}-admin-${m.name}`),
      terms: collective.currency ? `currency ${collective.currency}` : undefined,
      description: collective.description
        ?? `Open Collective fiscal boundary for ${collective.name}.`,
    }),
    ...tiers.map((t, i) => PlanNode.parse({
      id: `oc-offer-${sid}-${t.slug ?? i}`, kind: 'offer', label: t.name,
      canonical: canonicalize(`${t.name} ${t.description ?? ''}`),
      source, capital: 'financial',
      tags: ['tier'],
      terms: [t.amount !== undefined ? `amount ${t.amount}` : undefined,
        t.interval ? `every ${t.interval}` : 'one-off',
        `via opencollective.com/${sid}`].filter(Boolean).join(' · '),
      description: t.description ?? '',
    })),
    ...expenses.map((e) => PlanNode.parse({
      id: `oc-need-${sid}-${e.id}`, kind: 'need', label: e.title,
      canonical: canonicalize(e.title), source, capital: 'financial',
      orgIds: e.payee ? [`oc-${sid}-payee-${e.payee}`] : [],
      timeframe: { from: e.createdAt },
      tags: ['expense', ...(e.status ? [e.status.toLowerCase()] : [])],
      terms: [e.amount !== undefined ? `amount ${e.amount}` : undefined,
        e.currency].filter(Boolean).join(' · ') || undefined,
      description: `expense filed with ${collective.name}`,
    })),
  ];
  return ExternalPlan.parse({
    id: `${source}-${sid}`, source, title: `Open Collective: ${collective.name}`,
    importedAt: new Date().toISOString(), nodes,
  });
}

// Live lane — the public collective profile; no API key needed. Expenses/
// tiers come via fixture for the per-collective shape above.

// ── Discovery lane — public GraphQL v2 (keyless) ─────────────────────
// api.opencollective.com/graphql/v2 answers `accounts` + per-collective
// `orders` without auth (verified live 2026-10). Used for bulk import:
// accounts → action+need nodes, paid orders → Donation entities.
export const OC_API = 'https://api.opencollective.com/graphql/v2';

export const OcAccount = z.object({
  slug: z.string(), name: z.string().nullish(),
  description: z.string().nullish(),
  currency: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  location: z.object({ country: z.string().nullish() }).passthrough().nullish(),
  stats: z.object({
    balance: z.object({ value: z.number().nullish(), currency: z.string().nullish() })
      .passthrough().nullish(),
    totalAmountReceived: z.object({ value: z.number().nullish(), currency: z.string().nullish() })
      .passthrough().nullish(),
    contributorsCount: z.number().nullish(),
  }).passthrough().nullish(),
}).passthrough();
export type OcAccount = z.infer<typeof OcAccount>;

export const OcOrder = z.object({
  id: z.string(),
  amount: z.object({ value: z.number().nullish(), currency: z.string().nullish() })
    .passthrough().nullish(),
  createdAt: z.string().nullish(),
  status: z.string().nullish(),              // PAID | PENDING | …
  fromAccount: z.object({ slug: z.string().nullish() }).passthrough().nullish(),
}).passthrough();
export type OcOrder = z.infer<typeof OcOrder>;

// Accounts → nodes: one action node (the collective) + one need node
// (its open funding ask — every collective is a standing ask).
export function fromOcAccounts(
  accounts: OcAccount[], source = 'oc:graphql',
): ExternalPlan {
  const nodes: PlanNode[] = [];
  for (const a of accounts) {
    if (!a.slug) continue;
    const sid = `oc-${a.slug}`;
    const url = `https://opencollective.com/${a.slug}`;
    const tags = ['opencollective', ...(a.tags ?? [])];
    const name = a.name?.trim() || a.slug;
    nodes.push(
      PlanNode.parse({
        id: `${sid}-collective`, kind: 'action',
        label: name,
        canonical: canonicalize(`${name} ${(a.tags ?? []).join(' ')}`),
        source, placeId: a.location?.country ? `country:${a.location.country}` : undefined,
        tags, orgIds: [sid],
        budget: a.stats?.totalAmountReceived?.value ?? undefined,
        budgetCurrency: a.stats?.totalAmountReceived?.currency
          ?? a.currency ?? undefined,
        description: [
          a.description?.slice(0, 300) || null,
          a.stats?.balance?.value != null
            ? `balance ${a.stats.balance.currency ?? ''} ${a.stats.balance.value.toLocaleString('en-US')}`
            : null,
          a.stats?.contributorsCount != null
            ? `${a.stats.contributorsCount} contributors` : null,
          url,
        ].filter(Boolean).join(' — '),
      }),
      PlanNode.parse({
        id: `${sid}-need`, kind: 'need',
        label: `Support ${name} on Open Collective`,
        canonical: canonicalize(`funding support ${name}`),
        source, capital: 'financial', orgIds: [sid],
        placeId: a.location?.country ? `country:${a.location.country}` : undefined,
        tags: [...tags, 'funding-ask'],
        terms: `via opencollective.com/${a.slug}`,
        description: `Open Collective funding ask — ${url}`,
      }));
  }
  return ExternalPlan.parse({
    id: 'plan-opencollective', source,
    title: 'Open Collective — public-goods collectives',
    importedAt: new Date().toISOString(), nodes,
  });
}

// Paid orders → Donation entities (settlement 'settled', settlementRef
// the OC order id; non-PAID statuses stay 'pledged' — OC's vocabulary).
export function toOcDonations(orders: OcOrder[], slug: string) {
  return orders.map((o) => ({
    id: `donation-oc-${o.id}`,
    roundId: `round-oc-${slug}`,
    needNodeId: `oc-${slug}-need`,
    donor: o.fromAccount?.slug ? `oc:${o.fromAccount.slug}` : `oc:anon-${o.id}`,
    amount: o.amount?.value ?? 0,
    currency: o.amount?.currency ?? 'USD',
    settlement: o.status === 'PAID' ? ('settled' as const) : ('pledged' as const),
    settlementRef: `oc:${o.id}`,
    at: o.createdAt ?? new Date().toISOString(),
  }));
}

let ocLastError = '';
export const ocError = () => ocLastError;

const ocGql = async (query: string, f: typeof fetch) => {
  const res = await f(OC_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json',
      'user-agent': 'springforth-adapter/1.0 (+https://springforth.earth)' },
    body: JSON.stringify({ query }),
  }).catch((e) => { ocLastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (!res.ok) { ocLastError = `http ${res.status}`; return null; }
  const body = await res.json().catch((e) => { ocLastError = `json: ${e}`; return null; }) as {
    data?: Record<string, unknown>;
    errors?: { message?: string }[];
  } | null;
  if (!body) return null;
  if (body.errors?.length) { ocLastError = `gql: ${body.errors[0]!.message}`; }
  else ocLastError = '';
  return body.data ?? null;
};

// Search collectives (default public-goods terms; caller may override).
export async function fetchOcAccounts(
  opts: { searchTerm?: string; limit?: number; offset?: number } = {},
  f: typeof fetch = fetch,
): Promise<{ accounts: OcAccount[]; totalCount: number } | null> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const term = opts.searchTerm ?? 'public goods';
  const data = await ocGql(`{
    accounts(searchTerm:${JSON.stringify(term)}, type:COLLECTIVE,
      limit:${limit}, offset:${offset}) {
      totalCount nodes { slug name description currency tags
        location { country }
        stats { balance { value currency }
                totalAmountReceived { value currency }
                contributorsCount } } } }`, f);
  if (!data) return null;
  const inner = data.accounts as { nodes?: unknown; totalCount?: unknown } | undefined;
  const parsed = z.array(OcAccount).safeParse(inner?.nodes);
  if (!parsed.success) { ocLastError = 'accounts schema mismatch'; return null; }
  return { accounts: parsed.data,
    totalCount: typeof inner?.totalCount === 'number' ? inner.totalCount : parsed.data.length };
}

// One page of a collective's orders (PAID first upstream).
export async function fetchOcOrders(
  slug: string, opts: { limit?: number; offset?: number } = {},
  f: typeof fetch = fetch,
): Promise<{ orders: OcOrder[]; totalCount: number } | null> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const data = await ocGql(`{
    collective(slug:${JSON.stringify(slug)}) {
      orders(limit:${limit}, offset:${offset}, status:PAID) {
        totalCount nodes { id amount { value currency } createdAt status
          fromAccount { slug } } } } }`, f);
  if (!data) return null;
  const inner = (data.collective as { orders?: { nodes?: unknown; totalCount?: unknown } } | null)
    ?.orders;
  const parsed = z.array(OcOrder).safeParse(inner?.nodes ?? []);
  if (!parsed.success) { ocLastError = 'orders schema mismatch'; return null; }
  return { orders: parsed.data,
    totalCount: typeof inner?.totalCount === 'number' ? inner.totalCount : parsed.data.length };
}

// Legacy lane — public /<slug>.json profile.
export async function fetchCollective(
  slug: string, base = 'https://opencollective.com',
): Promise<ExternalPlan> {
  const res = await fetch(`${base.replace(/\/$/, '')}/${slug}.json`);
  if (!res.ok) throw new Error(`opencollective ${slug} ${res.status}`);
  const c = await res.json() as {
    slug?: string; name?: string; description?: string; currency?: string;
    members?: { MemberId?: number; role?: string; name?: string }[];
  };
  return fromJson({
    collective: {
      slug: c.slug ?? slug, name: c.name ?? slug,
      description: c.description, currency: c.currency,
    },
    members: (c.members ?? [])
      .filter((m) => m.name)
      .map((m) => ({ name: m.name!, role: m.role })),
  });
}
