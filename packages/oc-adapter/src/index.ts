import { ExternalPlan, PlanNode, canonicalize } from '@springforth/coordination';
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
// tiers come via fixture (the GraphQL v2 API needs a token; fixture-first
// keeps the demo independent of it).
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
