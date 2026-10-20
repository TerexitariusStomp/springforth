import { ExternalPlan, PlanNode, canonicalize } from '@springforth/coordination';
import { z } from 'zod';

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

export function fromJson(data: unknown, source = 'artizen'): ExternalPlan {
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
