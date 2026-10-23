// Silvi campaign import — the bulk path for POST /silvi/sync when the
// worker can't stay under CPU for a five-figure claim feed. Fetches all
// campaign claims from admin.silvi.earth/public-api locally, builds
// silvi-claim + silvi-cluster + plannode + plan entities, re-runs overlap
// detection against the merged graph, and emits chunked SQL executed via
// `wrangler d1 execute --remote`. Ledger row continues the remote chain
// (same eventHash as store.ts).
// Run: SILVI_API_KEY=… node --experimental-strip-types scripts/silvi-import.mjs [campaignId]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  fetchSilviCampaign, fetchSilviClaims, clusterSilviClaims, fromSilviClusters,
  silviLastError,
} from '../packages/silvi-adapter/src/index.ts';
import { detectOverlaps, detectComplements } from '../packages/coordination/src/index.ts';

const DB = 'springforth-coord';
const CAMPAIGN = process.argv[2] ?? '5';
const KEY = process.env.SILVI_API_KEY;
if (!KEY) { console.error('SILVI_API_KEY env required'); process.exit(1); }
const BASE = process.env.SILVI_API_URL;               // default in adapter

const WIDE = { ...process.env, CLOUDFLARE_ACCOUNT_ID: '46966abcfb8f1245ec055842177edcb2' };
const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: WIDE }))[0].results;

const campaign = await fetchSilviCampaign(CAMPAIGN, BASE, KEY);
if (!campaign) { console.error(`campaign fetch failed — ${silviLastError()}`); process.exit(1); }
console.log(`campaign ${campaign.id}: ${campaign.title}`);

// Page all claims — upstream WAF flakes 520s; retry each page.
const claims = [];
let after;
for (let page = 0; page < 200; page++) {
  let r = null;
  for (let a = 0; a < 4 && !r; a++) {
    r = await fetchSilviClaims(CAMPAIGN, { after, limit: 500 }, BASE, KEY);
    if (!r) await new Promise((s) => setTimeout(s, 800 * (a + 1)));
  }
  if (!r) { console.error(`page after=${after} failed — ${silviLastError()}`); break; }
  claims.push(...r.claims);
  process.stdout.write(`\rclaims: ${claims.length} (after=${after})`);
  if (r.nextAfter == null) break;
  after = r.nextAfter;
}
console.log(`\nfetched ${claims.length} claims`);

const clusters = clusterSilviClaims(claims);
const plan = fromSilviClusters(campaign, clusters, claims.length, 'silvi:app');
console.log(`${clusters.length} claim clusters → ${plan.nodes.length} nodes`);

// Merge with the live graph and re-run detection (persistDetectedOverlaps
// rules: keep non-proposed priors, floor non-complements at 0.5, retire
// stale auto-proposals).
const existing = q(`SELECT id, json FROM entities WHERE kind='plannode'`)
  .map((r) => JSON.parse(r.json));
const silviIds = new Set(plan.nodes.map((n) => n.id));
const nodes = [...existing.filter((n) => !silviIds.has(n.id) && !n.id.startsWith(`silvi-c${CAMPAIGN}-`)),
  ...plan.nodes];
const detected = [...detectOverlaps(nodes), ...detectComplements(nodes)];
const prior = new Map(q(`SELECT id, json FROM entities WHERE kind='overlap'`)
  .map((r) => [r.id, JSON.parse(r.json)]));
const keep = [];
const seen = new Set();
for (const rec of detected) {
  const p = prior.get(rec.id);
  if (p && p.status !== 'proposed') { seen.add(rec.id); continue; }
  if (rec.kind !== 'complement' && rec.confidence < 0.5) continue;
  keep.push(rec); seen.add(rec.id);
}
const retired = [...prior.values()]
  .filter((p) => p.status === 'proposed' && !seen.has(p.id));
console.log(`overlaps: ${keep.length} keep/write, ${retired.length} retire`);

// Ledger — continue the remote hash chain.
const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]
  ?? { seq: -1, hash: '0'.repeat(64) };
const NOW = new Date().toISOString();
const ev = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'silvi.synced',
  payload: { campaign: campaign.id, claims: claims.length, clusters: clusters.length,
    nodes: plan.nodes.length, overlaps: keep.length, retired: retired.length,
    via: 'local-import' }, prev_hash: head.hash };
ev.hash = eventHash(ev);

const esc = (s) => s.replace(/'/g, "''");
const put = (kind, id, obj) =>
  `INSERT INTO entities(kind,id,json,updated_at) VALUES('${kind}','${esc(id)}','${esc(JSON.stringify(obj))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`;
// Packed provenance pages — the worker's /silvi/sync finalize flattens
// `silvi-claim-pg` entities the same way; ~30 rows instead of ~14.6k.
const claimPages = [];
for (let i = 0; i < claims.length; i += 500)
  claimPages.push(put('silvi-claim-pg',
    `scpg${CAMPAIGN}-${String(i / 500).padStart(4, '0')}`,
    { records: claims.slice(i, i + 500) }));
const sql = [
  put('silvi-sync', `c${CAMPAIGN}`, { after: null, done: true, pages: claimPages.length }),
  ...claimPages,
  ...clusters.map((c) => put('silvi-cluster', `scl${CAMPAIGN}-${c.key}`, { campaignId: campaign.id, ...c })),
  put('plan', plan.id, { ...plan, nodes: undefined, nodeCount: plan.nodes.length }),
  ...plan.nodes.map((n) => put('plannode', n.id, n)),
  // stale silvi plannodes from prior syncs (cells that disappeared)
  ...existing.filter((n) => n.id.startsWith(`silvi-c${CAMPAIGN}-`) && !silviIds.has(n.id))
    .map((n) => `DELETE FROM entities WHERE kind='plannode' AND id='${esc(n.id)}';`),
  ...keep.map((o) => put('overlap', o.id, o)),
  ...retired.map((o) => `DELETE FROM entities WHERE kind='overlap' AND id='${esc(o.id)}';`),
  `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${ev.seq},'${ev.at}','${esc(ev.actor)}','${ev.kind}','${esc(JSON.stringify(ev.payload))}','${ev.prev_hash}','${ev.hash}');`,
];

await mkdir('out', { recursive: true });
const MAX = 48 * 1024;
const chunks = [];
let cur = [];
for (const stmt of sql) {
  if (cur.join('\n').length + stmt.length > MAX && cur.length) { chunks.push(cur); cur = []; }
  cur.push(stmt);
}
if (cur.length) chunks.push(cur);
for (const [i, c] of chunks.entries()) {
  const f = `out/silvi-${String(i).padStart(2, '0')}.sql`;
  await writeFile(f, c.join('\n') + '\n');
}
console.log(`wrote ${chunks.length} chunks (${sql.length} statements, ledger seq ${ev.seq})`);
for (const f of chunks.map((_, i) => `out/silvi-${String(i).padStart(2, '0')}.sql`)) {
  console.log(`── ${f}`);
  try {
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: WIDE })
      .split('\n').filter((l) => /queries executed|ERROR/.test(l)).join('\n'));
  } catch {
    console.log('  chunk failed — retrying once after 5s');
    await new Promise((r) => setTimeout(r, 5000));
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: WIDE })
      .split('\n').filter((l) => /queries executed|ERROR/.test(l)).join('\n'));
  }
}
console.log('done');
