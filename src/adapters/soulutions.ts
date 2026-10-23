import { ExternalPlan, PlanNode, canonicalize } from '../coordination';
import { z } from 'zod';

// Soulutions (soulutions.earth) — global regenerative-impact marketplace:
// projects carry an org, category slugs, impact-location region slugs, and
// a live funding milestone ({goal, raised}) — the milestone's unmet
// remainder is exactly the shape of our `need` nodes.
// Public surface is the Remix loader JSON at
//   GET /projects/:page?_data=routes/__base/projects   (1-based pages)
// — an observed public contract, not a documented API: schemas stay
// nullish-tolerant, fetches degrade to null, and `soulutionsLastError`
// keeps the last failure reason for sync-route errors.
// Amounts are unmarked on the listing payload — carried as bare numbers,
// never guessed into a currency.

export const SOULUTIONS_URL = 'https://soulutions.earth';

const SoulutionsFile = z.object({
  id: z.string().nullish(), type: z.number().nullish(),
  url: z.string().nullish(),
}).passthrough();

const SoulutionsMilestone = z.object({
  id: z.string().nullish(), name: z.string().nullish(),
  goal: z.number().nullish(), raised: z.number().nullish(),
  percentageRaised: z.number().nullish(),
  files: z.array(SoulutionsFile).default([]),
}).passthrough();

const SoulutionsOrg = z.object({
  id: z.string().nullish(), slug: z.string().nullish(),
  name: z.string().nullish(),
}).passthrough();

const SoulutionsProject = z.object({
  id: z.string(), slug: z.string(), name: z.string(),
  headline: z.string().nullish(),
  status: z.number().nullish(),
  type: z.number().nullish(),
  totalRaised: z.number().nullish(),
  totalDonors: z.number().nullish(),
  totalGoal: z.number().nullish(),
  totalGoalPercentage: z.number().nullish(),
  files: z.array(SoulutionsFile).default([]),
  organization: SoulutionsOrg.nullish(),
  milestoneCurrent: SoulutionsMilestone.nullish(),
  categories: z.array(z.string()).default([]),
  impactLocations: z.array(z.string()).default([]),
}).passthrough();
export type SoulutionsProject = z.infer<typeof SoulutionsProject>;

const SoulutionsCommunity = z.object({
  id: z.string().nullish(), name: z.string().nullish(),
  introText: z.string().nullish(),
}).passthrough();
export type SoulutionsCommunity = z.infer<typeof SoulutionsCommunity>;

const SoulutionsPage = z.object({
  success: z.boolean().optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  projects: z.array(SoulutionsProject).default([]),
  communities: z.array(SoulutionsCommunity).default([]),
}).passthrough();
export type SoulutionsPage = z.infer<typeof SoulutionsPage>;

const usd = (n?: number | null) =>
  n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`;

// Projects → ExternalPlan. Each project yields an action node plus a
// need node per unfunded milestone (budget = goal − raised, i.e. the
// live ask); status/type integers stay verbatim as tags — Soulutions'
// vocabulary is theirs, we never re-label it ours.
export function fromSoulutionsProjects(
  projects: SoulutionsProject[], source = 'soulutions:web',
): ExternalPlan {
  const nodes: PlanNode[] = [];
  for (const p of projects) {
    const pid = `sol-${p.id}`;
    const org = p.organization?.name?.trim();
    const orgId = p.organization?.slug
      ? `soulutions-org-${p.organization.slug}` : undefined;
    const place = p.impactLocations.length
      ? canonicalize(p.impactLocations.join(' ')) : undefined;
    const url = `${SOULUTIONS_URL}/project/${p.slug}`;
    const ms = p.milestoneCurrent;
    nodes.push({
      id: `${pid}-project`, kind: 'action',
      label: p.name.trim(),
      canonical: canonicalize(`${p.name} ${p.categories.join(' ')}`),
      source, placeId: place,
      orgIds: orgId ? [orgId] : [],
      tags: ['soulutions', `status:${p.status ?? 'unknown'}`,
        `type:${p.type ?? 'unknown'}`, ...p.categories,
        ...p.impactLocations.map((l) => `loc:${l}`)],
      timeframe: {},
      budget: p.totalRaised ?? undefined,
      description: [
        (p.headline ?? '').trim() || null,
        org ? `org: ${org}` : null,
        p.totalRaised != null
          ? `raised ${usd(p.totalRaised)} of ${usd(p.totalGoal)}` +
            (p.totalDonors != null ? ` from ${p.totalDonors} donors` : '')
          : null,
        url,
      ].filter(Boolean).join(' — '),
    });
    if (ms?.goal && (ms.raised ?? 0) < ms.goal) {
      const remaining = ms.goal - (ms.raised ?? 0);
      nodes.push({
        id: `${pid}-ms-${ms.id ?? 'current'}-need`, kind: 'need',
        label: `${usd(remaining)} to complete "${(ms.name ?? 'milestone').trim()}" — ${p.name.trim()}`,
        canonical: canonicalize(
          `funding milestone ${p.name} ${p.categories.join(' ')}`),
        source, placeId: place,
        orgIds: orgId ? [orgId] : [],
        capital: 'financial',
        tags: ['soulutions', 'milestone', ...p.categories],
        timeframe: {},
        budget: remaining,
        description: [
          `Soulutions milestone "${(ms.name ?? '').trim()}" — ` +
            `${usd(ms.raised)} raised of ${usd(ms.goal)}` +
            (ms.percentageRaised != null
              ? ` (${ms.percentageRaised.toFixed(1)}%)` : ''),
          url,
        ].filter(Boolean).join(' — '),
      });
    }
    nodes.push({
      id: `${pid}-outcome`, kind: 'outcome',
      label: `Funded impact — ${p.name.trim()}`,
      canonical: canonicalize(`funded impact ${p.name}`),
      source, placeId: place,
      orgIds: orgId ? [orgId] : [],
      tags: ['soulutions', 'derived-outcome'],
      timeframe: {},
      description: `Soulutions project outcome aggregate — see ${pid}-project`,
    });
  }
  return {
    id: 'plan-soulutions', source,
    title: 'Soulutions — impact marketplace projects',
    owner: 'soulutions', importedAt: new Date().toISOString(), nodes,
  };
}

let lastError = '';
export const soulutionsLastError = () => lastError;

// One listing page. `page` is the Remix route param (1-based; the loader
// turns it into skip = (page-1)·take). Returns null on any failure.
export async function fetchSoulutionsPage(
  page = 1, f: typeof fetch = fetch, baseUrl = SOULUTIONS_URL,
): Promise<SoulutionsPage | null> {
  const res = await f(
    `${baseUrl.replace(/\/$/, '')}/projects/${page}?_data=routes/__base/projects`,
    { headers: { 'user-agent': 'springforth-adapter/1.0 (+https://springforth.earth)' } })
    .catch((e) => { lastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (!res.ok) { lastError = `http ${res.status}`; return null; }
  const body = await res.json().catch((e) => { lastError = `json: ${e}`; return null; });
  if (body == null) return null;
  const parsed = SoulutionsPage.safeParse(body);
  if (!parsed.success) { lastError = 'schema mismatch'; return null; }
  lastError = '';
  return parsed.data;
}

// All pages, newest-first. Stops on an empty page, a page whose ids were
// all already seen (defensive — pagination contract is observed), or
// maxPages. Small corpus (≤ a few pages) so no cursor needed.
export async function fetchSoulutionsProjects(
  opts: { maxPages?: number } = {},
  f: typeof fetch = fetch, baseUrl = SOULUTIONS_URL,
): Promise<SoulutionsProject[] | null> {
  const maxPages = Math.min(Math.max(opts.maxPages ?? 20, 1), 100);
  const seen = new Set<string>();
  const out: SoulutionsProject[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const p = await fetchSoulutionsPage(page, f, baseUrl);
    if (!p) return out.length ? out : null;
    const fresh = p.projects.filter((r) => !seen.has(r.id));
    for (const r of fresh) { seen.add(r.id); out.push(r); }
    if (!p.projects.length || !fresh.length) break;
  }
  return out;
}
