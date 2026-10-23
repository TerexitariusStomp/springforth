import { ExternalPlan, PlanNode, canonicalize } from '@springforth/coordination';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Regen Network — sovereign eco-credit ledger (Cosmos SDK). Keyless LCD
// REST endpoints serve the on-chain registry:
//   /regen/ecocredit/v1/classes   — credit classes (C01…, BT01…)
//   /regen/ecocredit/v1/projects  — registered projects w/ jurisdiction
//   /regen/ecocredit/v1/batches   — issued credit batches (vintages)
// Jurisdiction is an ISO-3166-2-ish string (e.g. 'CO-ANT' = Antioquia,
// Colombia); precise geometry lives in `regen:`-IRI RDF metadata (heavy
// to resolve — follow-up). We place nodes at the *country centroid* and
// tag them geo:centroid so nobody mistakes it for a boundary.
// Batches are the ledger's issuance evidence — they land as plan nodes
// describing issued volume + vintage, tagged verbatim.

export const REGEN_LCD = 'https://lcd-regen.keplr.app';
const H3_RES = 4;   // country-centroid precision — coarse cell on purpose

export const RegenClass = z.object({
  id: z.string(),
  admin: z.string().nullish(),
  issuer: z.string().nullish(),
  credit_type_abbrev: z.string().nullish(),
  metadata: z.string().nullish(),
}).passthrough();
export type RegenClass = z.infer<typeof RegenClass>;

export const RegenProject = z.object({
  id: z.string(),                       // e.g. 'BT01-001', 'C01-001'
  admin: z.string().nullish(),
  issuer: z.string().nullish(),
  class_id: z.string().nullish(),
  jurisdiction: z.string().nullish(),   // 'CO-ANT', 'AU-QLD', …
  metadata: z.string().nullish(),       // regen:….rdf IRI
  reference_id: z.string().nullish(),
}).passthrough();
export type RegenProject = z.infer<typeof RegenProject>;

export const RegenBatch = z.object({
  denom: z.string(),                    // 'C01-001-20150101-20151231-001'
  issuer: z.string().nullish(),
  project_id: z.string().nullish(),
  metadata: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  issuance_date: z.string().nullish(),
  open: z.boolean().nullish(),
}).passthrough();
export type RegenBatch = z.infer<typeof RegenBatch>;

// ISO-3166-1 alpha-2 → capital-area centroid (coarse placement for
// country-jurisdiction records — deliberately country-level, flagged
// geo:centroid so it never reads as a site polygon).
const COUNTRY_CENTROID: Record<string, { lat: number; lng: number }> = {
  CO: { lat: 4.6, lng: -74.3 }, KE: { lat: 0.18, lng: 37.9 },
  UG: { lat: 1.37, lng: 32.3 }, AU: { lat: -25.7, lng: 134.0 },
  US: { lat: 39.8, lng: -98.6 }, BR: { lat: -10.8, lng: -52.9 },
  PE: { lat: -9.2, lng: -75.0 }, MX: { lat: 23.6, lng: -102.5 },
  IN: { lat: 21.0, lng: 78.0 }, ID: { lat: -2.5, lng: 118.0 },
  CN: { lat: 35.0, lng: 105.0 }, DE: { lat: 51.2, lng: 10.4 },
  GB: { lat: 54.0, lng: -2.0 }, FR: { lat: 46.6, lng: 2.4 },
  ES: { lat: 40.2, lng: -3.7 }, PT: { lat: 39.6, lng: -8.0 },
  IT: { lat: 42.8, lng: 12.8 }, NZ: { lat: -41.8, lng: 172.7 },
  ZA: { lat: -29.0, lng: 24.7 }, NG: { lat: 9.1, lng: 8.7 },
  GH: { lat: 7.9, lng: -1.0 }, TZ: { lat: -6.4, lng: 34.9 },
  RW: { lat: -1.9, lng: 29.9 }, CD: { lat: -2.9, lng: 23.6 },
  AR: { lat: -35.4, lng: -65.2 }, CL: { lat: -31.8, lng: -71.0 },
  EC: { lat: -1.4, lng: -78.2 }, BO: { lat: -16.7, lng: -64.7 },
  PY: { lat: -23.2, lng: -58.4 }, CR: { lat: 9.9, lng: -84.1 },
  GT: { lat: 15.7, lng: -90.3 }, PA: { lat: 8.5, lng: -80.8 },
  PH: { lat: 12.9, lng: 121.8 }, VN: { lat: 14.1, lng: 108.4 },
  TH: { lat: 15.5, lng: 101.0 }, MM: { lat: 21.9, lng: 96.0 },
  KH: { lat: 12.6, lng: 105.0 }, LA: { lat: 19.9, lng: 102.5 },
  NP: { lat: 28.2, lng: 84.0 }, ET: { lat: 9.0, lng: 39.0 },
  MW: { lat: -13.3, lng: 34.3 }, MZ: { lat: -18.7, lng: 35.5 },
  ZM: { lat: -14.6, lng: 27.8 }, MG: { lat: -19.4, lng: 46.7 },
  JP: { lat: 36.2, lng: 138.3 }, KR: { lat: 36.4, lng: 127.9 },
  TR: { lat: 39.0, lng: 35.2 }, UA: { lat: 49.0, lng: 32.0 },
  PL: { lat: 52.1, lng: 19.4 }, NL: { lat: 52.2, lng: 5.3 },
  SE: { lat: 62.0, lng: 15.0 }, NO: { lat: 64.5, lng: 11.6 },
  FI: { lat: 64.9, lng: 26.0 }, DK: { lat: 56.0, lng: 10.0 },
  IE: { lat: 53.2, lng: -8.2 }, CA: { lat: 56.6, lng: -106.3 },
  CH: { lat: 46.8, lng: 8.2 }, AT: { lat: 47.6, lng: 14.1 },
  BE: { lat: 50.6, lng: 4.7 }, RO: { lat: 45.9, lng: 25.0 },
  BG: { lat: 42.7, lng: 25.5 }, HU: { lat: 47.2, lng: 19.5 },
  CZ: { lat: 49.8, lng: 15.5 }, SK: { lat: 48.7, lng: 19.5 },
  HR: { lat: 45.1, lng: 15.6 }, RS: { lat: 44.0, lng: 20.9 },
  GR: { lat: 39.1, lng: 22.9 }, AL: { lat: 41.1, lng: 20.0 },
  IL: { lat: 31.0, lng: 34.9 }, EG: { lat: 26.6, lng: 29.9 },
  MA: { lat: 31.9, lng: -6.3 }, DZ: { lat: 28.0, lng: 2.6 },
  SN: { lat: 14.5, lng: -14.4 }, CI: { lat: 7.5, lng: -5.5 },
  CM: { lat: 5.7, lng: 12.7 }, TD: { lat: 15.4, lng: 18.7 },
  SS: { lat: 7.3, lng: 30.1 }, SO: { lat: 5.1, lng: 46.2 },
  BW: { lat: -22.3, lng: 24.0 }, NA: { lat: -22.2, lng: 17.2 },
  LK: { lat: 7.6, lng: 80.7 }, BD: { lat: 23.7, lng: 90.4 },
  PK: { lat: 30.4, lng: 69.3 }, AF: { lat: 33.9, lng: 67.7 },
  KZ: { lat: 48.0, lng: 67.0 }, MN: { lat: 46.8, lng: 103.8 },
  PG: { lat: -6.3, lng: 145.0 }, FJ: { lat: -17.8, lng: 178.1 },
};

export const regenJurisdictionH3 = (jurisdiction?: string | null): string | undefined => {
  const cc = jurisdiction?.split('-')[0]?.toUpperCase();
  const c = cc ? COUNTRY_CENTROID[cc] : undefined;
  return c ? latLngToCell(c.lat, c.lng, H3_RES) : undefined;
};

// Classes + projects + batches → ExternalPlan. A project is an action
// node; each credit batch is an outcome-flavoured evidence node (issued
// volume + vintage is ledger-verified issuance, verbatim).
export function fromRegen(
  projects: RegenProject[], classes: RegenClass[] = [],
  batches: RegenBatch[] = [], source = 'regen:lcd',
): ExternalPlan {
  const classById = new Map(classes.map((c) => [c.id, c]));
  const batchesByProject = new Map<string, RegenBatch[]>();
  for (const b of batches) {
    if (!b.project_id) continue;
    const arr = batchesByProject.get(b.project_id) ?? [];
    arr.push(b); batchesByProject.set(b.project_id, arr);
  }
  const nodes: PlanNode[] = [];
  for (const p of projects) {
    const pid = `regen-${p.id}`;
    const cls = p.class_id ? classById.get(p.class_id) : undefined;
    const h3 = regenJurisdictionH3(p.jurisdiction);
    nodes.push({
      id: `${pid}-project`, kind: 'action',
      label: `Regen project ${p.id}`,
      canonical: canonicalize(
        `regen ecocredit project ${p.id} ${cls?.credit_type_abbrev ?? ''} ${p.jurisdiction ?? ''}`),
      source,
      placeId: p.jurisdiction ? `jurisdiction:${p.jurisdiction}` : undefined,
      h3,
      orgIds: ['regen-network'],
      tags: ['regen',
        ...(p.class_id ? [`class:${p.class_id}`] : []),
        ...(cls?.credit_type_abbrev ? [`credit:${cls.credit_type_abbrev}`] : []),
        ...(p.jurisdiction ? [`jurisdiction:${p.jurisdiction}`] : []),
        ...(h3 ? ['geo:centroid'] : [])],
      timeframe: {},
      description: [
        `Ecocredit project on Regen ledger — class ${p.class_id ?? '?'}`,
        p.jurisdiction ? `jurisdiction ${p.jurisdiction}` : null,
        p.metadata ? `metadata ${p.metadata}` : null,
      ].filter(Boolean).join(' — '),
    });
    for (const b of batchesByProject.get(p.id) ?? []) {
      nodes.push({
        id: `${pid}-batch-${b.denom.split('-').pop()}`, kind: 'outcome',
        label: `Credit batch ${b.denom}`,
        canonical: canonicalize(`issued credit batch ${b.denom} ${p.id}`),
        source,
        placeId: p.jurisdiction ? `jurisdiction:${p.jurisdiction}` : undefined,
        h3, orgIds: ['regen-network'],
        tags: ['regen', 'credit-batch', ...(b.open ? ['open'] : ['closed'])],
        timeframe: { from: b.start_date ?? undefined, to: b.end_date ?? undefined },
        description: [
          `Vintage ${b.start_date?.slice(0, 10) ?? '?'} → ${b.end_date?.slice(0, 10) ?? '?'}`,
          b.issuance_date ? `issued ${b.issuance_date.slice(0, 10)}` : null,
          `issuer ${b.issuer ?? '?'}`,
        ].filter(Boolean).join(' — '),
        parentOutcomeId: `${pid}-project`,
      });
    }
  }
  return {
    id: 'plan-regen', source,
    title: 'Regen Network — ecocredit registry',
    owner: 'regen-network', importedAt: new Date().toISOString(), nodes,
  };
}

let lastError = '';
export const regenLastError = () => lastError;

const lcdGet = async (path: string, f: typeof fetch, baseUrl: string) => {
  const res = await f(`${baseUrl}${path}`, {
    headers: { 'user-agent': 'springforth-adapter/1.0 (+https://springforth.earth)' },
  }).catch((e) => { lastError = `fetch: ${e}`; return null; });
  if (!res) return null;
  if (!res.ok) { lastError = `http ${res.status}`; return null; }
  const body = await res.json().catch((e) => { lastError = `json: ${e}`; return null; });
  if (body == null) return null;
  lastError = '';
  return body;
};

// Cosmos LCD pagination — base64 `pagination.next_key`, empty when done.
async function* lcdPages<T>(
  path: string, field: string, schema: z.ZodType<T>,
  f: typeof fetch, baseUrl: string, maxPages: number,
): AsyncGenerator<T[]> {
  let key: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const sep = path.includes('?') ? '&' : '?';
    const body = await lcdGet(
      `${path}${sep}pagination.limit=100${key ? `&pagination.key=${encodeURIComponent(key)}` : ''}`,
      f, baseUrl);
    if (body == null) return;
    const rows = z.array(schema).safeParse((body as Record<string, unknown>)[field]);
    if (!rows.success) { lastError = `${field} schema mismatch`; return; }
    yield rows.data;
    const pag = (body as { pagination?: { next_key?: string | null } }).pagination;
    key = pag?.next_key ?? undefined;
    if (!key) return;
  }
}

export async function fetchRegenClasses(
  f: typeof fetch = fetch, baseUrl = REGEN_LCD,
): Promise<RegenClass[] | null> {
  const out: RegenClass[] = [];
  for await (const page of lcdPages('/regen/ecocredit/v1/classes', 'classes', RegenClass, f, baseUrl, 5))
    out.push(...page);
  return lastError ? null : out;
}

export async function fetchRegenProjects(
  f: typeof fetch = fetch, baseUrl = REGEN_LCD,
): Promise<RegenProject[] | null> {
  const out: RegenProject[] = [];
  for await (const page of lcdPages('/regen/ecocredit/v1/projects', 'projects', RegenProject, f, baseUrl, 10))
    out.push(...page);
  return lastError ? null : out;
}

export async function fetchRegenBatches(
  f: typeof fetch = fetch, baseUrl = REGEN_LCD,
): Promise<RegenBatch[] | null> {
  const out: RegenBatch[] = [];
  for await (const page of lcdPages('/regen/ecocredit/v1/batches', 'batches', RegenBatch, f, baseUrl, 15))
    out.push(...page);
  return lastError ? null : out;
}
