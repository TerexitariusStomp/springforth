import {
  ExternalPlan, PlanNode, canonicalize, gazetteerLookup,
} from '../coordination';
import type { Donation, FundingRound } from '../core';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Giveth (giveth.io) — the largest open public-goods donation registry:
// ~7.8k projects with on-chain donation histories and QF rounds.
// Public GraphQL at mainnet.serve.giveth.io/graphql, no auth.
//   project       → action node (+ need node when it belongs to a QF
//                   round or is verified — i.e. actively fundraising)
//   qfRound       → FundingRound entity (imported record of an external
//                   allocation event — state allocated unless live)
//   donation      → Donation entity (settlement 'settled',
//                   settlementRef = txid:network, donor = wallet address)
// Geo is sparse upstream (~0% coOrdinates): h3 is resolved from
// coOrdinates "lat,lng" when present, else impactLocation free text via
// the gazetteer, else the node stays unlocated (mapless but matchable).
// `verified` stays a tag — Giveth's review, never ours.

export const GIVETH_API = 'https://mainnet.serve.giveth.io/graphql';
const H3_RES = 5;

const GivethOrg = z.object({
  name: z.string().nullish(), label: z.string().nullish(),
}).passthrough();

const GivethCategory = z.object({ name: z.string().nullish() }).passthrough();

const GivethQfRelation = z.object({
  projectId: z.union([z.string(), z.number()]).nullish(),
  qfRoundId: z.union([z.string(), z.number()]).nullish(),
  sumDonationValueUsd: z.number().nullish(),
  countUniqueDonors: z.number().nullish(),
}).passthrough();

export const GivethProject = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().nullish(),
  slug: z.string().nullish(),
  descriptionSummary: z.string().nullish(),
  verified: z.boolean().nullish(),
  verificationStatus: z.string().nullish(),
  coOrdinates: z.string().nullish(),
  impactLocation: z.string().nullish(),
  website: z.string().nullish(),
  creationDate: z.string().nullish(),
  updatedAt: z.string().nullish(),
  totalRaised: z.number().nullish(),
  totalDonations: z.number().nullish(),
  totalDonated: z.number().nullish(),
  totalDistributed: z.number().nullish(),
  qualityScore: z.number().nullish(),
  walletAddress: z.string().nullish(),
  chainId: z.number().nullish(),
  organization: GivethOrg.nullish(),
  categories: z.array(GivethCategory).default([]),
  projectQfRoundRelations: z.array(GivethQfRelation).nullish(),
}).passthrough();
export type GivethProject = z.infer<typeof GivethProject>;

export const GivethQfRound = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  slug: z.string().nullish(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  isActive: z.boolean().nullish(),
  allocatedFund: z.number().nullish(),
  allocatedFundUSD: z.number().nullish(),
  allocatedTokenSymbol: z.string().nullish(),
  allocatedTokenChainId: z.number().nullish(),
  minimumValidUsdValue: z.number().nullish(),
  eligibleNetworks: z.array(z.number()).default([]),
  beginDate: z.string().nullish(),
  endDate: z.string().nullish(),
}).passthrough();
export type GivethQfRound = z.infer<typeof GivethQfRound>;

export const GivethDonation = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  valueUsd: z.number().nullish(),
  amount: z.number().nullish(),
  currency: z.string().nullish(),
  createdAt: z.string().nullish(),
  status: z.string().nullish(),              // verified | pending | failed…
  transactionId: z.string().nullish(),
  transactionNetworkId: z.number().nullish(),
  anonymous: z.boolean().nullish(),
  qfRoundId: z.union([z.string(), z.number()]).nullish(),
  user: z.object({ walletAddress: z.string().nullish() }).passthrough().nullish(),
}).passthrough();
export type GivethDonation = z.infer<typeof GivethDonation>;

const givethCell = (p: GivethProject): string | undefined => {
  // coOrdinates upstream is a "lat,lng" string when present.
  const m = p.coOrdinates?.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = +m[1]!, lng = +m[2]!;
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      return latLngToCell(lat, lng, H3_RES);
  }
  const g = p.impactLocation ? gazetteerLookup(p.impactLocation) : null;
  return g ? latLngToCell(g.lat, g.lon, H3_RES) : undefined;
};

const usd = (n?: number | null) =>
  n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`;

export const givethNeedId = (projectId: string | number) =>
  `giveth-${projectId}-need`;

// Projects → ExternalPlan. A project yields an action node; when it is
// in a QF round or platform-verified (actively fundraising surfaces)
// it also yields a need node carrying the live funding ask — that's the
// node a matching round or pledge could coordinate on.
export function fromGivethProjects(
  projects: GivethProject[], activeQfIds: Set<string> = new Set(),
  source = 'giveth:graphql',
): ExternalPlan {
  const nodes: PlanNode[] = [];
  for (const p of projects) {
    const pid = `giveth-${p.id}`;
    const title = (p.title ?? p.slug ?? `project ${p.id}`).trim();
    const cats = p.categories.map((c) => c.name).filter((c): c is string => !!c);
    const orgLabel = p.organization?.label ?? p.organization?.name;
    const orgId = orgLabel ? `giveth-org-${canonicalize(orgLabel).replace(/ /g, '-')}` : undefined;
    const place = p.impactLocation ? canonicalize(p.impactLocation) : undefined;
    const h3 = givethCell(p);
    const url = p.slug ? `https://giveth.io/project/${p.slug}` : `https://giveth.io/project/${p.id}`;
    const rels = p.projectQfRoundRelations ?? [];
    const inActiveRound = rels.some((r) => r.qfRoundId != null && activeQfIds.has(String(r.qfRoundId)));
    nodes.push({
      id: `${pid}-project`, kind: 'action',
      label: title,
      canonical: canonicalize(`${title} ${cats.join(' ')}`),
      source, placeId: place, h3,
      orgIds: orgId ? [orgId] : [],
      tags: ['giveth', ...(p.verified ? ['verified:giveth'] : []),
        ...(p.verificationStatus ? [`vstatus:${p.verificationStatus}`] : []),
        ...(p.chainId ? [`chain:${p.chainId}`] : []),
        ...cats, ...cats.map((c) => `cat:${c}`)],
      timeframe: { from: p.creationDate ?? undefined, to: p.updatedAt ?? undefined },
      budget: p.totalDonated ?? p.totalRaised ?? undefined,
      budgetCurrency: 'USD',
      description: [
        p.descriptionSummary?.slice(0, 400) || null,
        orgLabel ? `org: ${orgLabel}` : null,
        p.totalDonated != null || p.totalRaised != null
          ? `raised ${usd(p.totalDonated ?? p.totalRaised)}` +
            (p.totalDonations != null ? ` across ${Math.round(p.totalDonations)} donations` : '')
          : null,
        p.walletAddress ? `wallet: ${p.walletAddress}` : null,
        url,
      ].filter(Boolean).join(' — '),
    });
    if (inActiveRound || p.verified) {
      nodes.push({
        id: givethNeedId(p.id), kind: 'need',
        label: `Fund ${title}`,
        canonical: canonicalize(`funding donations ${title} ${cats.join(' ')}`),
        source, placeId: place, h3,
        orgIds: orgId ? [orgId] : [],
        capital: 'financial',
        tags: ['giveth', 'funding-ask',
          ...(inActiveRound ? ['qf-round'] : []), ...cats],
        timeframe: {},
        description: [
          inActiveRound
            ? `In an active Giveth QF round — donations are matched`
            : `Accepts donations on Giveth`,
          p.walletAddress ? `wallet: ${p.walletAddress}` : null,
          url,
        ].filter(Boolean).join(' — '),
      });
    }
  }
  return {
    id: 'plan-giveth', source,
    title: 'Giveth — public goods funding projects',
    owner: 'giveth', importedAt: new Date().toISOString(), nodes,
  };
}

// QF rounds → FundingRound entities — imported records of external
// allocation events. Imported rounds never run matching themselves:
// isActive → 'open' (still accepting), otherwise 'allocated'.
export function toFundingRounds(
  rounds: GivethQfRound[],
  relationsByRound: Map<string, string[]> = new Map(),   // qfRoundId → needIds
): FundingRound[] {
  const now = new Date().toISOString();
  return rounds.map((r) => ({
    id: `round-giveth-qf-${r.id}`,
    title: r.name ?? r.title ?? `Giveth QF round ${r.id}`,
    description: [
      `Imported Giveth QF round${r.slug ? ` (${r.slug})` : ''}`,
      r.allocatedFundUSD != null
        ? `matching pool ${usd(r.allocatedFundUSD)}` +
          (r.allocatedTokenSymbol ? ` (${r.allocatedTokenSymbol})` : '')
        : null,
      r.eligibleNetworks.length ? `chains: ${r.eligibleNetworks.join('/')}` : null,
      `https://qf.giveth.io`,
    ].filter(Boolean).join(' — '),
    sponsorIds: ['giveth'],
    matchingFund: { amount: r.allocatedFundUSD ?? r.allocatedFund ?? 0,
      currency: r.allocatedFundUSD != null ? 'USD' : (r.allocatedTokenSymbol ?? 'USD') },
    eligibleNeedIds: relationsByRound.get(String(r.id)) ?? [],
    opensAt: r.beginDate ?? now, closesAt: r.endDate ?? now,
    state: r.isActive ? 'open' : 'allocated',
    matchingMode: 'lr', conviction: false,
    acceptedTokens: {}, endowment: false,
    chainRef: `giveth-qf:${r.id}`,
  }));
}

// Donations → Donation entities. Giveth donation status is honoured
// verbatim — only status 'verified' becomes settlement 'settled';
// pending/failed stay 'pledged' so intent is recorded without claiming
// settlement. Donor is the wallet address (or `anon-<id>`).
export function toDonations(
  donations: GivethDonation[], projectId: string | number,
): Donation[] {
  return donations.map((d) => ({
    id: `donation-giveth-${d.id}`,
    roundId: d.qfRoundId != null
      ? `round-giveth-qf-${d.qfRoundId}` : 'round-giveth-direct',
    needNodeId: givethNeedId(projectId),
    donor: d.anonymous || !d.user?.walletAddress
      ? `giveth:anon-${d.id}` : `giveth:${d.user.walletAddress}`,
    amount: d.valueUsd ?? d.amount ?? 0,
    currency: d.valueUsd != null ? 'USD' : (d.currency ?? 'USD'),
    settlement: d.status === 'verified' ? 'settled' : 'pledged',
    settlementRef: d.transactionId
      ? `${d.transactionId}:net-${d.transactionNetworkId ?? 'unknown'}` : undefined,
    at: d.createdAt ?? new Date().toISOString(),
  }));
}

// ── Live client — public GraphQL, no auth ─────────────────────────────
let lastError = '';
export const givethLastError = () => lastError;

const gql = async (
  query: string, f: typeof fetch, baseUrl: string,
): Promise<Record<string, unknown> | null> => {
  const res = await f(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json',
      'user-agent': 'springforth-adapter/1.0 (+https://springforth.earth)' },
    body: JSON.stringify({ query }),
  }).catch((e) => { lastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (!res.ok) { lastError = `http ${res.status}`; return null; }
  const body = await res.json().catch((e) => { lastError = `json: ${e}`; return null; }) as {
    data?: Record<string, unknown>;
    errors?: { message?: string }[];
  } | null;
  if (!body) return null;
  if (body.errors?.length) { lastError = `gql: ${body.errors[0]!.message}`; return null; }
  lastError = '';
  return body.data ?? null;
};

const PROJECT_FIELDS = `id title slug descriptionSummary verified verificationStatus
  coOrdinates impactLocation website creationDate updatedAt
  totalRaised totalDonations totalDonated totalDistributed qualityScore
  walletAddress chainId
  organization { name label }
  categories { name }
  projectQfRoundRelations { projectId qfRoundId sumDonationValueUsd countUniqueDonors }`;

// One page of projects — offset-paginated (skip/take/limit). Stable
// ordering by CreationDate ASC makes resumable backfill safe: a re-run
// upserts the same ids, and pages seen mid-way aren't re-requested.
export async function fetchGivethProjects(
  opts: { skip?: number; take?: number } = {},
  f: typeof fetch = fetch, baseUrl = GIVETH_API,
): Promise<{ projects: GivethProject[]; totalCount: number } | null> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 50);
  const skip = Math.max(opts.skip ?? 0, 0);
  const data = await gql(`{
    allProjects(skip:${skip}, take:${take}, limit:${take},
      orderBy:{field:CreationDate, direction:ASC}) {
      totalCount projects { ${PROJECT_FIELDS} } } }`, f, baseUrl);
  if (!data) return null;
  const inner = data.allProjects as { projects?: unknown; totalCount?: unknown } | undefined;
  const parsed = z.array(GivethProject).safeParse(inner?.projects);
  if (!parsed.success) { lastError = 'projects schema mismatch'; return null; }
  return { projects: parsed.data,
    totalCount: typeof inner?.totalCount === 'number' ? inner.totalCount : parsed.data.length };
}

// All QF rounds (active + archived).
export async function fetchGivethQfRounds(
  f: typeof fetch = fetch, baseUrl = GIVETH_API,
): Promise<GivethQfRound[] | null> {
  const data = await gql(`{
    qfRounds(activeOnly:false) {
      id slug name title isActive allocatedFund allocatedFundUSD
      allocatedTokenSymbol allocatedTokenChainId minimumValidUsdValue
      eligibleNetworks beginDate endDate } }`, f, baseUrl);
  if (!data) return null;
  const parsed = z.array(GivethQfRound).safeParse(data.qfRounds);
  if (!parsed.success) { lastError = 'qfRounds schema mismatch'; return null; }
  return parsed.data;
}

// One page of a project's donations (newest first upstream).
export async function fetchGivethDonations(
  projectId: string | number, opts: { skip?: number; take?: number } = {},
  f: typeof fetch = fetch, baseUrl = GIVETH_API,
): Promise<{ donations: GivethDonation[]; totalCount: number } | null> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 50);
  const skip = Math.max(opts.skip ?? 0, 0);
  const data = await gql(`{
    donationsByProjectId(projectId:${Number(projectId)}, take:${take}, skip:${skip}) {
      totalCount donations { id valueUsd amount currency createdAt status
        transactionId transactionNetworkId anonymous qfRoundId
        user { walletAddress } } } }`, f, baseUrl);
  if (!data) return null;
  const inner = data.donationsByProjectId as
    { donations?: unknown; totalCount?: unknown } | undefined;
  const parsed = z.array(GivethDonation).safeParse(inner?.donations);
  if (!parsed.success) { lastError = 'donations schema mismatch'; return null; }
  return { donations: parsed.data,
    totalCount: typeof inner?.totalCount === 'number' ? inner.totalCount : parsed.data.length };
}
