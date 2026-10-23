import {
  ExternalPlan, PlanNode, canonicalize, gazetteerLookup,
} from '../coordination';
import type { OracleCheck } from '../core';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';
import { getJson, makeErr } from './fetch';

// Karma GAP (gap.karmahq.xyz) — Grantee Accountability Protocol: project,
// grant, milestone, impact and endorsement records as on-chain EAS
// attestations. Public REST at gapapi.karmahq.xyz, keyless.
//   project      → action node (attestation uid + chainID kept verbatim
//                  in the description — the record IS an attestation)
//   grant        → need node (the funded ask; amount where declared)
//   milestone    → OracleCheck (completed/approved/verified flags map to
//                  score — GAP's own status, never relabelled)
//   endorsement  → raw `gap-endorsement` row only — an EAS endorsement
//                  is NOT our appreciation signal; never a trust edge.
// Pagination: GET /projects?page=N — 10/page, ~40 pages; stop on repeat
// ids. Communities: GET /communities (one shot).

export const GAP_API = 'https://gapapi.karmahq.xyz';
const H3_RES = 5;

const AttestationBase = z.object({
  uid: z.string().nullish(),
  txid: z.string().nullish(),
  chainID: z.number().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  attester: z.string().nullish(),
  revoked: z.boolean().nullish(),
}).passthrough();

const GapMilestone = AttestationBase.extend({
  type: z.string().nullish(),
  data: z.object({
    title: z.string().nullish(), text: z.string().nullish(),
    description: z.string().nullish(),
  }).passthrough().nullish(),
  completed: z.boolean().nullish(),
  approved: z.boolean().nullish(),
  verified: z.boolean().nullish(),
  rejected: z.boolean().nullish(),
});

const GapGrant = AttestationBase.extend({
  data: z.object({
    title: z.string().nullish(), proposalURL: z.string().nullish(),
    description: z.string().nullish(), communityUID: z.string().nullish(),
  }).passthrough().nullish(),
  details: z.object({
    data: z.object({
      title: z.string().nullish(), proposalURL: z.string().nullish(),
      description: z.string().nullish(), amount: z.union([z.string(), z.number()]).nullish(),
      payoutAddress: z.string().nullish(),
    }).passthrough().nullish(),
  }).passthrough().nullish(),
  amount: z.union([z.string(), z.number()]).nullish(),
  payoutAddress: z.string().nullish(),
  categories: z.array(z.string()).default([]),
  milestones: z.array(GapMilestone).default([]),
  community: z.object({
    uid: z.string().nullish(),
    details: z.object({ data: z.object({
      name: z.string().nullish(), slug: z.string().nullish() }).passthrough().nullish() })
      .passthrough().nullish(),
  }).passthrough().nullish(),
}).passthrough();
export type GapGrant = z.infer<typeof GapGrant>;

export const GapProject = AttestationBase.extend({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  type: z.string().nullish(),
  details: z.object({
    data: z.object({
      title: z.string().nullish(),
      description: z.string().nullish(),
      missionSummary: z.string().nullish(),
      problem: z.string().nullish(),
      solution: z.string().nullish(),
      slug: z.string().nullish(),
      locationOfImpact: z.string().nullish(),
      imageURL: z.string().nullish(),
      links: z.array(z.object({ url: z.string().nullish(), type: z.string().nullish() })
        .passthrough()).nullish(),
      tags: z.array(z.object({ name: z.string().nullish() }).passthrough()).nullish(),
    }).passthrough().nullish(),
  }).passthrough().nullish(),
  grants: z.array(GapGrant).default([]),
  members: z.array(AttestationBase).default([]),
  impacts: z.array(z.object({
    uid: z.string().nullish(),
    data: z.object({ work: z.string().nullish(), impact: z.string().nullish(),
      proof: z.string().nullish() }).passthrough().nullish(),
    verified: z.array(z.object({}).passthrough()).nullish(),
  }).passthrough()).default([]),
  endorsements: z.array(AttestationBase).default([]),
}).passthrough();
export type GapProject = z.infer<typeof GapProject>;

const cell = (loc?: string | null) => {
  const g = loc ? gazetteerLookup(loc) : null;
  return g ? latLngToCell(g.lat, g.lon, H3_RES) : undefined;
};

const pTitle = (p: GapProject) =>
  (p.details?.data?.title ?? p.details?.data?.slug ?? `GAP project ${p.id ?? p.uid?.slice(0, 10)}`).trim();
const pSlug = (p: GapProject) => p.details?.data?.slug ?? p.id ?? p.uid?.slice(0, 16);
const gapUrl = (p: GapProject) => `https://gap.karmahq.xyz/project/${pSlug(p)}`;

// Projects → ExternalPlan: action node per project (EAS attestation ref
// kept verbatim in the description), need node per grant (the funded
// ask), placeId from locationOfImpact where declared.
export function fromGapProjects(
  projects: GapProject[], source = 'gap:api',
): ExternalPlan {
  const nodes: PlanNode[] = [];
  for (const p of projects) {
    const pid = `gap-${pSlug(p)}`;
    const title = pTitle(p);
    const place = p.details?.data?.locationOfImpact
      ? canonicalize(p.details.data.locationOfImpact) : undefined;
    const h3 = cell(p.details?.data?.locationOfImpact);
    const tags = ['gap',
      ...(p.details?.data?.tags ?? []).map((t) => t.name).filter((t): t is string => !!t),
      ...(p.chainID ? [`chain:${p.chainID}`] : [])];
    nodes.push({
      id: `${pid}-project`, kind: 'action', label: title,
      canonical: canonicalize(`${title} ${p.details?.data?.missionSummary ?? ''}`),
      source, placeId: place, h3,
      orgIds: ['gap'],
      tags,
      timeframe: { from: p.createdAt ?? undefined, to: p.updatedAt ?? undefined },
      description: [
        (p.details?.data?.missionSummary ?? p.details?.data?.description ?? '')
          .slice(0, 300) || null,
        p.uid ? `EAS attestation ${p.uid}` +
          (p.chainID ? ` on chain ${p.chainID}` : '') +
          (p.txid ? ` (tx ${p.txid})` : '') : null,
        `${p.grants.length} grants, ${p.impacts.length} impact reports`,
        gapUrl(p),
      ].filter(Boolean).join(' — '),
    });
    for (const g of p.grants) {
      const gTitle = g.details?.data?.title ?? g.data?.title ?? `grant ${g.uid?.slice(0, 10)}`;
      const amount = g.details?.data?.amount ?? g.amount;
      const community = g.community?.details?.data?.name ?? undefined;
      const milestones = g.milestones;
      const done = milestones.filter((m) => m.completed || m.approved).length;
      nodes.push({
        id: `${pid}-grant-${g.uid?.slice(0, 16) ?? nodes.length}`, kind: 'need',
        label: `${gTitle}${amount ? ` — ${amount}` : ''}`,
        canonical: canonicalize(`grant funding ${gTitle} ${community ?? ''}`),
        source, placeId: place, h3,
        orgIds: ['gap'],
        capital: 'financial',
        tags: [...tags, 'grant', ...(community ? [`community:${community}`] : []),
          ...g.categories],
        timeframe: { from: g.createdAt ?? undefined, to: g.updatedAt ?? undefined },
        budget: typeof amount === 'number' ? amount
          : amount ? parseFloat(amount) || undefined : undefined,
        description: [
          `Karma GAP grant — ${community ?? 'unaffiliated program'}`,
          milestones.length ? `${done}/${milestones.length} milestones completed` : null,
          g.details?.data?.proposalURL ?? null,
          g.uid ? `attestation ${g.uid}` : null,
        ].filter(Boolean).join(' — '),
      });
    }
  }
  return {
    id: 'plan-gap', source,
    title: 'Karma GAP — grant accountability attestations',
    owner: 'gap', importedAt: new Date().toISOString(), nodes,
  };
}

// Milestones → OracleCheck records, keyed to the project's action node.
// score = fraction of milestones completed/approved — GAP's own status
// vocabulary is preserved in `detail`; `verified` GAP milestones bump
// score verbatim (source 'connector' — attested upstream, not ours).
export function toGapChecks(projects: GapProject[]): OracleCheck[] {
  const now = new Date().toISOString();
  const checks: OracleCheck[] = [];
  for (const p of projects) {
    const nodeId = `gap-${pSlug(p)}-project`;
    const ms = p.grants.flatMap((g) => g.milestones);
    if (!ms.length) continue;
    const done = ms.filter((m) => m.completed || m.approved || m.verified).length;
    const verified = ms.filter((m) => m.verified).length;
    checks.push({
      id: `gap-ms-${pSlug(p)}`,
      nodeId,
      source: 'connector',
      domain: 'governance',
      methodologyRef: `gap:${p.uid ?? pSlug(p)}`,
      result: done === ms.length ? 'match' : done > 0 ? 'match' : 'pending',
      score: ms.length ? done / ms.length : 0,
      detail: `${done}/${ms.length} milestones complete (${verified} GAP-verified)`,
      at: now,
    });
  }
  return checks;
}

// Raw endorsements — stored, never mapped into trust.
export function toGapEndorsements(projects: GapProject[]) {
  return projects.flatMap((p) => p.endorsements.map((e) => ({
    id: `gape-${e.uid ?? `${pSlug(p)}-${e.createdAt}`}`,
    projectNodeId: `gap-${pSlug(p)}-project`,
    uid: e.uid ?? null, attester: e.attester ?? null,
    chainID: e.chainID ?? null, at: e.createdAt ?? null,
  })));
}

const ERR = makeErr();
export const gapLastError = ERR.get;

const gapGet = (path: string, f: typeof fetch) => getJson(f, `${GAP_API}${path}`, ERR);

// One page of projects (10/page upstream, 1-based `page` param).
export async function fetchGapProjectsPage(
  page = 1, f: typeof fetch = fetch,
): Promise<GapProject[] | null> {
  const body = await gapGet(`/projects?page=${Math.max(page, 1)}`, f);
  if (body == null) return null;
  const parsed = z.array(GapProject).safeParse(body);
  if (!parsed.success) { ERR.set('projects schema mismatch'); return null; }
  return parsed.data;
}

export async function fetchGapProjects(
  opts: { maxPages?: number } = {}, f: typeof fetch = fetch,
): Promise<GapProject[] | null> {
  const maxPages = Math.min(Math.max(opts.maxPages ?? 45, 1), 200);
  const seen = new Set<string>();
  const out: GapProject[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const rows = await fetchGapProjectsPage(page, f);
    if (!rows) return out.length ? out : null;
    const fresh = rows.filter((r) => {
      const k = r.uid ?? String(r.id ?? '');
      if (seen.has(k)) return false; seen.add(k); return true;
    });
    out.push(...fresh);
    if (!rows.length || !fresh.length) break;
  }
  return out;
}
