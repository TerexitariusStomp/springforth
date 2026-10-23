// Seed the production D1 directly — used when ADMIN_TOKEN isn't handy but
// wrangler is authed (d1:write). Builds the demo fixture: community plans +
// council CSV → detect overlaps → possibility cards → emit SQL for entities
// + hash-chained ledger rows continuing the remote chain.
// Run: node --experimental-strip-types scripts/seed-d1.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { normalizePlan, fromCsv } from '../src/adapters/oneplanet.ts';
import { fromClcJson } from '../src/adapters/formats.ts';
import { fromHolonsJson } from '../src/adapters/formats.ts';
import { fromArtizenJson } from '../src/adapters/formats.ts';
import { fromVfJson } from '../src/adapters/formats.ts';
import { fromTreegensFeed, fromTreegensArchive } from '../src/adapters/treegens.ts';
import { fromSilviProjects } from '../src/adapters/silvi.ts';
import { detectOverlaps, detectComplements } from '../src/coordination.ts';

const DB = 'springforth-coord';
const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8' }))[0].results;

const oneplanetPlan = {
  id: 'plan-cvl-thorntree', title: 'Thorntree Community Plan (CVL / Pride in Place trailblazer)',
  outcomes: [
    { id: 'o1', title: 'A greener, flood-resilient neighbourhood' },
    { id: 'o2', title: 'Local young people in work' },
  ],
  actions: [
    { id: 'a1', title: 'Thorntree wetland restoration Q3', outcomeId: 'o1', placeId: 'thorntree',
      organisationIds: ['cvl'], startDate: '2027-01-01', budget: 40000,
      description: 'Restore the wetland and reed beds around Thorntree beck to slow surface water' },
    { id: 'a2', title: 'Youth employment hub', outcomeId: 'o2', placeId: 'thorntree',
      organisationIds: ['cvl'], startDate: '2027-01-15', budget: 25000,
      description: 'Drop-in hub linking 16–24s to local employers' },
  ],
  organisations: [{ id: 'cvl', name: 'Community Ventures Ltd' }],
  places: [{ id: 'thorntree', name: 'Thorntree, Middlesbrough' }],
};
const councilCsv = [
  'kind,label,place,outcome,org,start,budget',
  'action,Marsh regeneration scheme,thorntree,,Middlesbrough Council,2027-02-01,55000',
  'action,Youth skills and jobs centre,thorntree,,Middlesbrough Council,2027-03-01,60000',
  'action,East Middlesbrough solar feasibility,middlesbrough-east,,Middlesbrough Council,2027-06-01,30000',
].join('\n');
const needsCsv = [
  'kind,label,place,outcome,org,start,budget',
  'need,We need tools and equipment for the repair café,thorntree,,CVL,2027-01-10,4000',
  'need,Tree seedlings needed for community reforestation,kwale,,Kwale Community Forest,2027-02-01,8000',
  'need,Community transport needed for market supplies,dadaab garissa,,Dadaab Womens Group,2027-01-20,6000',
].join('\n');
const sarafuFixture = JSON.parse(await readFile(new URL('./fixtures/sarafu-sample.json', import.meta.url), 'utf8'));
const holonsExport = {
  holon: { id: 'thorntree-hub', name: 'Thorntree Community Hub',
    purpose: 'Neighbourhood resourcing — tools, time, skills' },
  members: [
    { id: 'mike', name: 'Mike', appreciations: 7 },
    { id: 'sandra', name: 'Sandra', appreciations: 2 },
  ],
  items: [
    { type: 'offer', title: 'Van and driver for community moves',
      actor: 'mike', terms: 'fuel costs only', place: 'Thorntree' },
    { type: 'request', title: 'Someone to run the repair café laptop',
      actor: 'sandra', place: 'Thorntree', deadline: '2027-02-01' },
    { type: 'task', title: 'We need marsh reeds and planting days volunteers',
      actor: 'mike', place: 'Thorntree' },
    { type: 'appreciation', title: 'thanks', actor: 'sandra', target: 'mike' },
  ],
};
const artizenExport = {
  seasons: [{ id: 's7', name: 'Season 7 — Rebuild', curators: ['ana', 'maya'] }],
  projects: [{
    id: 'kwale-mangrove', title: 'Kwale Mangrove Nursery',
    owner: 'coast-collective', place: 'Kwale',
    description: 'Community mangrove restoration in Kwale county',
    fundIds: ['s7'],
    needs: [{ title: 'Tree seedlings and nursery tools', amount: 800,
      deadline: '2027-02-15',
      description: 'We need seedlings, pots and hand tools for the nursery' }],
  }],
  artifacts: [{
    projectId: 'kwale-mangrove', title: 'Mangrove Artifact (open edition)',
    tokenPrice: '0.01 ETH', supply: 1000, artistFeePercentage: 10,
    treasurySplitPercentage: 5,
  }],
};

const plans = [
  normalizePlan(oneplanetPlan),
  fromCsv(councilCsv, 'csv:upload'),
  fromCsv(needsCsv, 'csv:community-needs'),
  fromClcJson(sarafuFixture, 'clc:sarafu'),
  fromHolonsJson(holonsExport, 'holons:thorntree'),
  fromArtizenJson(artizenExport, 'artizen:s7'),
];
// ── Possibility cards + their need/offer nodes ──────────────────────────
const possId = 'poss-kwale-mangrove-planting';
const possNodes = [
  { id: `${possId}-need-0`, kind: 'need', label: 'Tree seedlings and nursery tools for planting day',
    canonical: 'tree seedlings nursery tools planting day', source: `possibility:${possId}`,
    possibilityId: possId, required: true, orgIds: ['coast-collective'], placeId: 'kwale',
    capital: 'living', tags: ['possibility'], timeframe: { to: '2027-02-10T00:00:00Z' } },
  { id: `${possId}-need-1`, kind: 'need', label: 'Lunch and water for volunteers',
    canonical: 'lunch water volunteers', source: `possibility:${possId}`,
    possibilityId: possId, required: false, orgIds: ['coast-collective'], placeId: 'kwale',
    capital: 'material', tags: ['possibility'], timeframe: { to: '2027-02-10T00:00:00Z' } },
  { id: `${possId}-offer-0`, kind: 'offer', label: 'Wheelbarrows and spades',
    canonical: 'wheelbarrows spades', source: `possibility:${possId}`,
    possibilityId: possId, orgIds: ['coast-collective'], placeId: 'kwale',
    capital: 'material', tags: ['possibility', 'bringing'], timeframe: {} },
  { id: `${possId}-offer-kalimbo`, kind: 'offer', label: '30 extra seedlings from the nursery',
    canonical: 'extra seedlings nursery', source: `possibility:${possId}`,
    possibilityId: possId, orgIds: ['kalimbo'], placeId: 'kwale',
    capital: 'living', tags: ['possibility', 'bringing'], timeframe: {} },
];
const danceId = 'poss-community-dance-night';
const danceNodes = [
  { id: `${danceId}-need-0`, kind: 'need', label: 'DJ for the evening',
    canonical: 'dj evening dance', source: `possibility:${danceId}`,
    possibilityId: danceId, required: true, category: 'person', flaggedBy: 'lena',
    orgIds: ['lena'], placeId: 'kwale', capital: 'experiential',
    tags: ['possibility'], timeframe: { to: '2027-02-28T00:00:00Z' } },
  { id: `${danceId}-need-1`, kind: 'need', label: 'Community hall booking',
    canonical: 'community hall booking venue', source: `possibility:${danceId}`,
    possibilityId: danceId, required: true, category: 'venue', flaggedBy: 'lena',
    orgIds: ['lena'], placeId: 'kwale', capital: 'social',
    tags: ['possibility'], timeframe: { to: '2027-02-28T00:00:00Z' } },
  { id: `${danceId}-need-2`, kind: 'need', label: 'Sound system and speakers',
    canonical: 'sound system speakers', source: `possibility:${danceId}`,
    possibilityId: danceId, required: true, category: 'equipment', flaggedBy: 'lena',
    orgIds: ['lena'], placeId: 'kwale', capital: 'material',
    tags: ['possibility'], timeframe: { to: '2027-02-28T00:00:00Z' } },
  { id: `${danceId}-need-flagged`, kind: 'need', label: 'Someone to manage the playlist handover',
    canonical: 'playlist handover manage', source: `possibility:${danceId}`,
    possibilityId: danceId, required: false, flaggedBy: 'marcus',
    orgIds: ['marcus'], placeId: 'kwale',
    tags: ['possibility', 'flagged'], timeframe: { to: '2027-02-28T00:00:00Z' } },
  { id: `${danceId}-offer-marcus`, kind: 'offer', label: 'Portable speakers and amp',
    canonical: 'portable speakers amp', source: `possibility:${danceId}`,
    possibilityId: danceId, orgIds: ['marcus'], placeId: 'kwale',
    capital: 'material', tags: ['possibility', 'bringing'], timeframe: {} },
  // completion-report continuation: "what support would help" → new need
  { id: `${possId}-need-next-0`, kind: 'need',
    label: 'A second wheelbarrow for the follow-up watering rota',
    canonical: 'second wheelbarrow watering rota', source: `possibility:${possId}`,
    possibilityId: possId, required: false, flaggedBy: 'coast-collective',
    orgIds: ['coast-collective'], placeId: 'kwale',
    tags: ['possibility', 'next'], timeframe: {} },
];
// ── UK card — Hebden Bridge flood response + live dataset context ────────
const floodId = 'poss-hebden-flood-response';
const NOW_FIXED = new Date().toISOString();
const safeGet = async (u) => {
  try { const r = await fetch(u, { signal: AbortSignal.timeout(8000) }); return r.ok ? r.json() : null; }
  catch { return null; }
};
const floodCtx = { datasets: [] };
const floodAreas = await safeGet('https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=53.74&long=-2.01&dist=15');
const floods = await safeGet('https://environment.data.gov.uk/flood-monitoring/id/floods?lat=53.74&long=-2.01&dist=15');
floodCtx.datasets.push(floodAreas || floods
  ? { name: 'EA Flood Monitoring', source: 'environment.data.gov.uk', fetchedAt: NOW_FIXED,
      value: `${(floodAreas?.items ?? []).length} flood-risk areas mapped within 15km; ${(floods?.items ?? []).length} warnings/alerts currently active` }
  : { name: 'EA Flood Monitoring', source: 'environment.data.gov.uk', fetchedAt: NOW_FIXED,
      value: 'Upper Calder valley — historic flood-alert area (cached)' });
const pc = await safeGet('https://api.postcodes.io/postcodes?lon=-2.013&lat=53.741');
const pcr = pc?.result?.[0];
if (pcr) floodCtx.datasets.push({
  name: 'ONS geography via postcodes.io', source: 'api.postcodes.io', fetchedAt: NOW_FIXED,
  value: `${pcr.postcode} → parish ${pcr.parish}, LSOA ${pcr.lsoa}, district ${pcr.admin_district}` });
const floodNodes = [
  { id: `${floodId}-need-0`, kind: 'need', label: 'Sandbags and sand supply',
    canonical: 'sandbags sand supply', source: `possibility:${floodId}`,
    possibilityId: floodId, required: true, category: 'material', flaggedBy: 'hebden-mutual-aid',
    orgIds: ['hebden-mutual-aid'], placeId: 'hebden bridge', capital: 'material',
    tags: ['possibility'], timeframe: { to: '2027-01-17T00:00:00Z' } },
  { id: `${floodId}-need-1`, kind: 'need', label: 'Working pumps (borrow or buy)',
    canonical: 'working pumps borrow buy', source: `possibility:${floodId}`,
    possibilityId: floodId, required: true, category: 'equipment', flaggedBy: 'hebden-mutual-aid',
    orgIds: ['hebden-mutual-aid'], placeId: 'hebden bridge', capital: 'material',
    tags: ['possibility'], timeframe: { to: '2027-01-17T00:00:00Z' } },
  { id: `${floodId}-need-2`, kind: 'need', label: 'Hall booked as rest centre',
    canonical: 'hall booked rest centre', source: `possibility:${floodId}`,
    possibilityId: floodId, required: true, category: 'venue', flaggedBy: 'hebden-mutual-aid',
    orgIds: ['hebden-mutual-aid'], placeId: 'hebden bridge', capital: 'social',
    tags: ['possibility'], timeframe: { to: '2027-01-17T00:00:00Z' } },
  { id: `${floodId}-need-3`, kind: 'need', label: 'Street wardens for vulnerable-neighbour check-ins',
    canonical: 'street wardens vulnerable neighbour checkins', source: `possibility:${floodId}`,
    possibilityId: floodId, required: false, category: 'person', flaggedBy: 'hebden-mutual-aid',
    orgIds: ['hebden-mutual-aid'], placeId: 'hebden bridge', capital: 'experiential',
    tags: ['possibility'], timeframe: { to: '2027-01-17T00:00:00Z' } },
  { id: `${floodId}-offer-bins`, kind: 'offer', label: 'Four wheelie bins for sandbag filling',
    canonical: 'four wheelie bins sandbag filling', source: `possibility:${floodId}`,
    possibilityId: floodId, orgIds: ['hebden-mutual-aid'], placeId: 'hebden bridge',
    capital: 'material', tags: ['possibility', 'bringing'], timeframe: {} },
  { id: `${floodId}-offer-priya`, kind: 'offer', label: 'Two submersible pumps, tested',
    canonical: 'two submersible pumps tested', source: `possibility:${floodId}`,
    possibilityId: floodId, orgIds: ['priya'], placeId: 'hebden bridge',
    capital: 'material', tags: ['possibility', 'bringing'], timeframe: {} },
  { id: `${floodId}-offer-sand`, kind: 'offer', label: 'Sand supply — depot confirmed',
    canonical: 'sand supply depot confirmed', source: `possibility:${floodId}`,
    possibilityId: floodId, orgIds: ['calder-council-liaison'], placeId: 'hebden bridge',
    capital: 'material', tags: ['possibility', 'bringing'], timeframe: {} },
];
// ── Mida Creek hero card — the demo's primary story ──────────────────────
// Declare → commit → coordinate → verify. The oracle watches the delivery
// action: its h3 res-6 cell covers the Mida Creek shore, so Sentinel-2
// NDVI + GBIF + Treegens readings land on it automatically.
const midaId = 'poss-mida-creek-mangrove';
const midaPlan = normalizePlan({
  id: 'plan-mida-creek', title: 'Mida Creek Community Conservation Plan',
  outcomes: [{ id: 'mo1', title: 'Restored mangrove cover and fish-nursery habitat at Mida Creek' }],
  actions: [
    { id: 'ma1', title: 'Mangrove propagule nursery establishment', outcomeId: 'mo1',
      placeId: 'mida creek', organisationIds: ['mida-creek-conservation'],
      startDate: '2026-11-01', budget: 12000,
      description: 'Community nursery raising Rhizophora and Ceriops propagules' },
    { id: 'ma2', title: 'Shoreline planting days — 1,200 propagules', outcomeId: 'mo1',
      placeId: 'mida creek', organisationIds: ['mida-creek-conservation'],
      startDate: '2027-01-15', budget: 9000,
      description: 'Two planting days on the degraded creek edge, GPS-logged plots' },
  ],
  organisations: [{ id: 'mida-creek-conservation', name: 'Mida Creek Conservation Group' }],
  places: [{ id: 'mida creek', name: 'Mida Creek' }],
});
// The shoreline-planting action carries the h3 cell the oracle reads.
for (const n of midaPlan.nodes)
  if (n.kind === 'action' && /shoreline/i.test(n.label)) n.h3 = '867b59737ffffff';
const countyCsv2 = [
  'kind,label,place,outcome,org,start,budget',
  'action,Shoreline mangrove planting on the creek edge,mida creek,,Kilifi County Government,2027-02-01,15000',
  'outcome,Restored mangrove cover and fish-nursery habitat at Mida Creek,mida creek,,Kilifi County Government,2027-12-01,',
].join('\n');
const midaNodes = [
  { id: `${midaId}-need-0`, kind: 'need',
    label: '400 more propagules to reach 1,200',
    canonical: 'more propagules reach 1200', source: `possibility:${midaId}`,
    possibilityId: midaId, required: true, category: 'material',
    flaggedBy: 'mida-creek-conservation', orgIds: ['mida-creek-conservation'],
    placeId: 'mida creek', capital: 'living',
    tags: ['possibility'], timeframe: { to: '2027-01-10T00:00:00Z' } },
  { id: `${midaId}-need-1`, kind: 'need', label: 'Boat transport to the planting site',
    canonical: 'boat transport planting site', source: `possibility:${midaId}`,
    possibilityId: midaId, required: true, category: 'equipment',
    flaggedBy: 'mida-creek-conservation', orgIds: ['mida-creek-conservation'],
    placeId: 'mida creek', capital: 'material',
    tags: ['possibility'], timeframe: { to: '2027-01-10T00:00:00Z' } },
  { id: `${midaId}-need-2`, kind: 'need', label: 'Lunch and water for 15 volunteers',
    canonical: 'lunch water 15 volunteers', source: `possibility:${midaId}`,
    possibilityId: midaId, required: false, category: 'consumable',
    orgIds: ['mida-creek-conservation'], placeId: 'mida creek',
    capital: 'material', tags: ['possibility'], timeframe: { to: '2027-01-15T00:00:00Z' } },
  { id: `${midaId}-offer-0`, kind: 'offer', label: 'Two fishing boats and skippers',
    canonical: 'two fishing boats skippers', source: `possibility:${midaId}`,
    possibilityId: midaId, orgIds: ['dabaso-fishers'], placeId: 'mida creek',
    capital: 'material', tags: ['possibility', 'bringing'], timeframe: {} },
  { id: `${midaId}-offer-1`, kind: 'offer', label: '800 nursery-raised propagules',
    canonical: '800 nursery raised propagules', source: `possibility:${midaId}`,
    possibilityId: midaId, orgIds: ['mida-creek-conservation'], placeId: 'mida creek',
    capital: 'living', tags: ['possibility', 'bringing'], timeframe: {} },
];
plans.push(midaPlan, fromCsv(countyCsv2, 'csv:kilifi-county'));
// ── ValueFlows lane — playnet interop provenance ──────────────────────────
const vfExport = {
  agents: [{ id: 'ag-north', name: 'Mutual Aid North', note: 'peer VF network agent' }],
  intents: [{ id: 'i-blankets', action: 'use', receiver: 'ag-north',
    name: 'Warm blankets for the rest centre', atLocation: 'Hebden Bridge',
    inScopeOf: ['ag-north'], due: '2027-01-17T00:00:00Z' }],
  commitments: [{ id: 'c-sand', action: 'give', provider: 'ag-north',
    name: 'Sand delivery confirmed — depot lorry', atLocation: 'Hebden Bridge',
    resourceQuantity: { hasNumericalValue: 2, hasUnit: 'tonne' } }],
};
const vfSource = 'vf:playnet-demo';
const vfPlan = fromVfJson(vfExport, vfSource);
plans.push(vfPlan);
// ── Treegens evidence lane — real filmed planting records ─────────────────
const tgLive = await safeGet('https://world.treegens.app/.netlify/functions/plantings');
const tgArch = await safeGet('https://world.treegens.app/data/pre-app-plantings.json');
if (tgLive) plans.push(fromTreegensFeed(tgLive));
if (tgArch) plans.push(fromTreegensArchive(tgArch));
// ── Silvi lane — Kakamega agroforestry fixture (Silvi's flagship Kenyan
// project). Western Kenya geography — deliberately non-colliding with
// the Mida Creek coastal demo; exercises the silvi:app import path and
// leaves an unfunded zone-target need a future round could cover.
const silviFixture = [{ id: 'kakamega-29',
  name: 'Kakamega Forest Agroforestry', status: 'active',
  location: 'Kakamega, Kenya', country: 'Kenya',
  campaign: 'Kenya Bioregional', steward: 'Kakamega farmer stewards',
  trees_target: 50000, trees_planted: 12000, trees_verified: 9400,
  species: ['Croton megalocarpus', 'Prunus africana'],
  lat: 0.283, lng: 34.752,
  zones: [{ id: 'south', name: 'South block',
    trees_target: 8000, trees_planted: 2100, lat: 0.27, lng: 34.74 }],
  trees: [
    { id: 't1', lat: 0.283, lng: 34.752, species: 'Prunus africana', status: 'verified' },
    { id: 't2', lat: 0.284, lng: 34.751, species: 'Croton megalocarpus', status: 'planted' },
  ],
  stac_url: 'https://stac.silvi.earth/collections/kakamega',
}];
plans.push(fromSilviProjects(silviFixture, 'silvi:fixture'));
const nodes = [...plans.flatMap((p) => p.nodes), ...possNodes, ...danceNodes, ...floodNodes, ...midaNodes];
const overlaps = [...detectOverlaps(nodes), ...detectComplements(nodes)];
// The possibility's required seedlings need pairs against a real Sarafu
// voucher — mark its best complement coordinated so quorum can tip.
const possComp = overlaps
  .filter((o) => o.kind === 'complement' && o.nodeIds[0] === `${possId}-need-0`)
  .sort((a, b) => b.confidence - a.confidence)[0];
if (possComp) {
  possComp.status = 'coordinated';
  possComp.validations = [{ actor: 'kalimbo', verdict: 'confirm',
    note: 'nursery voucher covers the seedlings', at: new Date().toISOString() }];
  possComp.resolution = { decidedBy: 'kalimbo', at: new Date().toISOString() };
}
console.log(`built: ${plans.length} plans, ${nodes.length} nodes, ${overlaps.length} records`);

// continue the remote hash chain — same eventHash as store.ts
const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
let seq = head.seq, prev = head.hash;
const NOW = new Date().toISOString();
const ledgerRows = [];
const append = (actor, kind, payload) => {
  const e = { seq: ++seq, at: NOW, actor, kind, payload, prev_hash: prev };
  prev = eventHash(e);
  ledgerRows.push({ ...e, hash: prev });
};
for (const p of plans) append('seed', 'plan.imported', { id: p.id, nodes: p.nodes.length });
append('seed', 'overlaps.detected', {
  nodes: nodes.length, found: overlaps.length,
  complements: overlaps.filter((r) => r.kind === 'complement').length,
});

const needId = possComp?.nodeIds?.[0] ?? `${possId}-need-0`;
const extraEntities = [
  ['signal', `sig-aurelia-${needId}`, { id: `sig-aurelia-${needId}`,
    actor: 'aurelia (judge walkthrough)', targetId: needId, targetKind: 'node',
    intent: 'support', note: 'community verified in person', at: NOW }],
  // possibility cards — seeded 'active' where the live sweep still has to
  // tip quorum itself; the Kwale card is seeded 'completed' with its report.
  ['possibility', possId, { id: possId,
    title: 'Plant 500 mangrove seedlings at Kwale shore',
    description: 'Community planting day — bring tools and labour, we need seedlings and lunch',
    declarerId: 'coast-collective', place: 'kwale',
    timeStart: '2027-02-20T08:00:00Z', timeEnd: '2027-02-20T14:00:00Z',
    deadline: '2027-02-10T00:00:00Z', minParticipants: 3,
    status: 'completed', quorumAt: NOW,
    report: {
      summary: '480 seedlings planted by 12 people; nursery voucher covered stock',
      evidence: 'photos + ledger events',
      learnings: 'start tool-count earlier — spades ran short', at: NOW },
    createdAt: NOW }],
  ['possibility', danceId, { id: danceId,
    title: 'Community dance night at the hall',
    description: 'An open dance evening — bring energy, we need a DJ, a sound system and the venue booked',
    declarerId: 'lena', place: 'kwale',
    timeStart: '2027-03-07T17:00:00Z', timeEnd: '2027-03-07T22:00:00Z',
    deadline: '2027-02-28T00:00:00Z', minParticipants: 8, maxParticipants: 40,
    status: 'active', createdAt: NOW }],
  ...[['marcus', `${danceId}-offer-marcus`], ['anika', undefined]]
    .map(([actor, bringingNodeId]) => ['participation', `part-${danceId}-${actor}`,
      { id: `part-${danceId}-${actor}`, possibilityId: danceId, actor, bringingNodeId, at: NOW }]),
  ['pass', `pass-${danceId}-sandra`, { id: `pass-${danceId}-sandra`,
    possibilityId: danceId, actor: 'sandra', at: NOW }],
  ...[['kalimbo', `${possId}-offer-kalimbo`], ['mike', `${possId}-offer-0`], ['sandra', undefined]]
    .map(([actor, bringingNodeId]) => ['participation', `part-${possId}-${actor}`,
      { id: `part-${possId}-${actor}`, possibilityId: possId, actor, bringingNodeId, at: NOW }]),
  // post-event appreciation round — pairwise; kalimbo↔coast-collective is mutual
  ...[
    ['coast-collective', 'kalimbo', 'brought seedlings and it was clutch'],
    ['kalimbo', 'coast-collective', 'organised the whole shore team'],
    ['coast-collective', 'mike', 'van run made the tools possible'],
  ].map(([from, to, note]) => ['appreciation', `app-${from}-${to}`,
    { id: `app-${from}-${to}`, fromActor: from, toActor: to, possibilityId: possId, note, at: NOW }]),
  ['possibility', floodId, { id: floodId,
    title: 'Community flood-response prep day',
    description: 'Flood season is coming — fill sandbags, check pumps, set up the hall as a rest centre, map vulnerable neighbours',
    declarerId: 'hebden-mutual-aid', place: 'hebden bridge',
    timeStart: '2027-01-24T10:00:00Z', timeEnd: '2027-01-24T16:00:00Z',
    deadline: '2027-01-17T00:00:00Z', minParticipants: 10,
    context: floodCtx, status: 'active', createdAt: NOW }],
  ...[['priya', `${floodId}-offer-priya`], ['rowan', undefined],
      ['calder-council-liaison', `${floodId}-offer-sand`]]
    .map(([actor, bringingNodeId]) => ['participation', `part-${floodId}-${actor}`,
      { id: `part-${floodId}-${actor}`, possibilityId: floodId, actor, bringingNodeId, at: NOW }]),
  // ── Mida Creek hero card — 4/6 committed, boats pledged, 2 to go ──────
  ['possibility', midaId, { id: midaId,
    title: 'Plant 1,200 mangrove propagules along the Mida Creek shoreline',
    description: 'Two planting days on the degraded creek edge — nursery raised 800 propagules, we need 400 more, boat transport, and lunch for the crew',
    declarerId: 'mida-creek-conservation', place: 'mida creek',
    timeStart: '2027-01-15T08:00:00Z', timeEnd: '2027-01-16T14:00:00Z',
    deadline: '2027-01-10T00:00:00Z', minParticipants: 6,
    status: 'active', createdAt: NOW }],
  ...[['dabaso-fishers', `${midaId}-offer-0`], ['mida-creek-conservation', `${midaId}-offer-1`],
      ['wanjiku', undefined], ['otieno', undefined]]
    .map(([actor, bringingNodeId]) => ['participation', `part-${midaId}-${actor}`,
      { id: `part-${midaId}-${actor}`, possibilityId: midaId, actor, bringingNodeId, at: NOW }]),
  // ── Funding layer — quadratic round over Mida Creek's unmet needs ────
  // Breadth demo: the boats need draws nine small donors; lunch draws
  // one sponsor-size gift — the match column rewards the crowd.
  ['round', 'round-mida-creek', { id: 'round-mida-creek',
    title: 'Mida Creek planting round',
    description: 'Matching fund over the unmet financial needs the card surfaced — propagules, boat transport, crew lunch',
    sponsorIds: ['kilifi-regen-network'],
    matchingFund: { amount: 500, currency: 'USD' },
    eligibleNeedIds: [`${midaId}-need-0`, `${midaId}-need-1`, `${midaId}-need-2`],
    opensAt: '2026-10-15T00:00:00Z', closesAt: '2026-11-15T00:00:00Z',
    state: 'open' }],
  ...[
    [`${midaId}-need-1`, 'wanjiku', 5], [`${midaId}-need-1`, 'otieno', 5],
    [`${midaId}-need-1`, 'kamau', 10], [`${midaId}-need-1`, 'nyambura', 5],
    [`${midaId}-need-1`, 'juma', 10], [`${midaId}-need-1`, 'auma', 5],
    [`${midaId}-need-1`, 'kilonzo', 15], [`${midaId}-need-1`, 'mwende', 10],
    [`${midaId}-need-1`, 'baraka', 10],
    [`${midaId}-need-2`, 'coast-supporter', 75],
    [`${midaId}-need-0`, 'kalimbo', 20], [`${midaId}-need-0`, 'mike', 10],
  ].map(([needNodeId, donor, amount], i) => ['donation',
    `don-round-mida-creek-${i}`,
    { id: `don-round-mida-creek-${i}`, roundId: 'round-mida-creek',
      needNodeId, donor, amount, currency: 'USD',
      settlement: 'pledged', at: NOW }]),
  ['pledge', `pl-${midaId}-wanjiku`, { id: `pl-${midaId}-wanjiku`,
    possibilityId: midaId, needNodeId: `${midaId}-need-0`,
    pledger: 'wanjiku', amount: 40, currency: 'USD',
    state: 'pending', stateAt: NOW }],
];
append('seed', 'signal.declared', { id: `sig-aurelia-${needId}`, targetId: needId, intent: 'support' });
append('coast-collective', 'possibility.declared', { id: possId, needs: 2, bringing: 1 });
for (const a of ['kalimbo', 'mike', 'sandra'])
  append(a, 'possibility.joined', { id: possId });
for (const [f, t] of [['coast-collective', 'kalimbo'], ['kalimbo', 'coast-collective'], ['coast-collective', 'mike']])
  append(f, 'possibility.appreciated', { id: possId, to: t });
if (possComp) append('kalimbo', 'commitment.presented', { id: possComp.id });
append('lena', 'possibility.declared', { id: danceId, needs: 3, bringing: 1 });
for (const a of ['marcus', 'anika']) append(a, 'possibility.joined', { id: danceId });
append('marcus', 'possibility.need_flagged', { id: danceId, nodeId: `${danceId}-need-flagged` });
append('sandra', 'possibility.passed', { id: danceId });
append('coast-collective', 'possibility.completed',
  { id: possId, nextNeeds: [`${possId}-need-next-0`] });
append('hebden-mutual-aid', 'possibility.declared', { id: floodId, needs: 4, bringing: 1 });
for (const a of ['priya', 'rowan', 'calder-council-liaison'])
  append(a, 'possibility.joined', { id: floodId });
append('seed', 'vf.imported', { id: vfSource, nodes: vfPlan.nodes.length });
append('mida-creek-conservation', 'possibility.declared', { id: midaId, needs: 3, bringing: 1 });
for (const a of ['dabaso-fishers', 'mida-creek-conservation', 'wanjiku', 'otieno'])
  append(a, 'possibility.joined', { id: midaId });
append('seed', 'round.opened', { id: 'round-mida-creek' });
append('wanjiku', 'pledge.pending', { id: `pl-${midaId}-wanjiku`, possibilityId: midaId, amount: 40, currency: 'USD' });

const esc = (s) => s.replace(/'/g, "''");
const sql = [
  ...plans.map((p) => `INSERT INTO entities(kind,id,json,updated_at) VALUES('plan','${esc(p.id)}','${esc(JSON.stringify({ ...p, nodes: undefined, nodeCount: p.nodes.length }))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  ...nodes.map((n) => `INSERT INTO entities(kind,id,json,updated_at) VALUES('plannode','${esc(n.id)}','${esc(JSON.stringify(n))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  ...overlaps.map((o) => `INSERT INTO entities(kind,id,json,updated_at) VALUES('overlap','${esc(o.id)}','${esc(JSON.stringify(o))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  ...extraEntities.map(([kind, id, obj]) => `INSERT INTO entities(kind,id,json,updated_at) VALUES('${kind}','${esc(id)}','${esc(JSON.stringify(obj))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  ...ledgerRows.map((e) => `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${e.seq},'${e.at}','${esc(e.actor)}','${e.kind}','${esc(JSON.stringify(e.payload))}','${e.prev_hash}','${e.hash}');`),
];
await mkdir('out', { recursive: true });
// Chunk by bytes — large plan blobs hit SQLITE_TOOBIG / D1_RESET_DO when
// batched; ~48KB per file stays well under both limits.
const MAX = 48 * 1024;
const chunks = [];
let cur = [];
for (const stmt of sql) {
  if (cur.join('\n').length + stmt.length > MAX && cur.length) { chunks.push(cur); cur = []; }
  cur.push(stmt);
}
if (cur.length) chunks.push(cur);
const files = [];
for (const [i, c] of chunks.entries()) {
  const f = `out/seed-${String(i).padStart(2, '0')}.sql`;
  await writeFile(f, c.join('\n') + '\n');
  files.push(f);
}
console.log(`wrote ${files.length} chunks (${sql.length} statements, ledger seq ${head.seq + 1}→${seq})`);
for (const f of files) {
  console.log(`── ${f}`);
  try {
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8' }).split('\n').filter((l) => /queries executed|ERROR/.test(l)).join('\n'));
  } catch (e) {
    console.log('  chunk failed — retrying once after 5s');
    await new Promise((r) => setTimeout(r, 5000));
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8' }).split('\n').filter((l) => /queries executed|ERROR/.test(l)).join('\n'));
  }
}
for (const o of overlaps) console.log(`  ${o.id} [${o.kind} ${o.confidence}] ${o.reasoning.slice(0, 80)}`);
