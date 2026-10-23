// Restor bulk import — the local path for hydrating restor.eco's full
// public site corpus into D1 when the worker can't hold the fetch budget
// (~200k site pages). Enumerates the sitemap index, fetches each site
// page's embedded RSC record, builds restor-site + plannode + plan
// entities, and emits chunked SQL executed via `wrangler d1 execute
// --remote`. Resumable: checkpoint file tracks sitemap index + site
// offset so a kill mid-run resumes, never restarts. Polite pacing —
// serial fetches with retry + backoff; identifiable UA.
// Run: node --experimental-strip-types scripts/restor-import.mjs [--enumerate-only] [--max-sites N] [--rate ms]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  fetchRestorSitemap, fetchRestorSite, fromRestorSites, restorCentroid,
  restorLastError,
} from '../packages/restor-adapter/src/index.ts';

const DB = 'springforth-coord';
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const MAX_SITES = ARGS['max-sites'] ? +ARGS['max-sites'] : Infinity;
const RATE_MS = ARGS.rate ? +ARGS.rate : 300;    // ~3.3 req/s default
const CKPT = 'out/restor-import.checkpoint.json';
const WIDE = { ...process.env, CLOUDFLARE_ACCOUNT_ID: '46966abcfb8f1245ec055842177edcb2' };
const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: WIDE }))[0].results;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Phase 1: enumerate sitemaps → restor-sitemap rows ────────────────
let entries = [];
let ckpt = {};
try { ckpt = JSON.parse(await readFile(CKPT, 'utf8')); } catch { /* fresh */ }
if (ckpt.sitemapDone && ckpt.entries?.length) {
  entries = ckpt.entries;
  console.log(`resumed — ${entries.length} sites in sitemap index`);
} else {
  console.log('enumerating sitemaps…');
  for (let i = ckpt.sitemapIndex ?? 0; ; i++) {
    const batch = await fetchRestorSitemap(i);
    if (batch === null) { console.error(`sitemap ${i} failed — ${restorLastError()}`); break; }
    if (!batch.length) break;                          // 404 = end
    entries.push(...batch);
    process.stdout.write(`\rsitemap ${i}: ${entries.length} sites`);
    await writeFile(CKPT, JSON.stringify({ sitemapIndex: i + 1, entries }));
    if ((i + 1) % 25 === 0) await sleep(500);
  }
  ckpt = { sitemapDone: true, entries };
  await writeFile(CKPT, JSON.stringify(ckpt));
  console.log(`\n${entries.length} sites enumerated`);
}
if (ARGS['enumerate-only']) process.exit(0);

// newest lastmod first — freshest declarations land first.
entries.sort((a, b) => (b.lastmod ?? '').localeCompare(a.lastmod ?? ''));

// ── Phase 2: hydrate → restor-site + plannode entities ───────────────
const start = ckpt.hydrateOffset ?? 0;
const target = Math.min(entries.length, start + MAX_SITES);
const sites = [];
for (let i = start; i < target; i++) {
  const id = entries[i].id;
  let r = null;
  for (let a = 0; a < 4 && !r; a++) {
    r = await fetchRestorSite(id);
    if (!r) await sleep(800 * (a + 1));
  }
  if (r) sites.push(r.site);
  if ((i + 1) % 25 === 0) {
    process.stdout.write(`\rhydrated ${i + 1 - start}/${target - start} (${sites.length} ok)`);
    await writeFile(CKPT, JSON.stringify({ ...ckpt, hydrateOffset: i + 1 }));
  }
  await sleep(RATE_MS);
}
console.log(`\nhydrated ${sites.length}/${target - start} sites`);
if (!sites.length) { console.log('nothing hydrated'); process.exit(1); }

// ── Phase 3: entities + ledger + chunked SQL ─────────────────────────
const plan = fromRestorSites(sites, 'restor:web');
const NOW = new Date().toISOString();
const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]
  ?? { seq: -1, hash: '0'.repeat(64) };
const ev = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'restor.synced',
  payload: { sites: sites.length, nodes: plan.nodes.length, via: 'local-import',
    offset: start },
  prev_hash: head.hash };
ev.hash = eventHash(ev);

const esc = (s) => s.replace(/'/g, "''");
const put = (kind, id, obj) =>
  `INSERT INTO entities(kind,id,json,updated_at) VALUES('${kind}','${esc(id)}','${esc(JSON.stringify(obj))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`;
const sql = [
  ...sites.map((s) => put('restor-site', `rst-${s.id}`, { ...s, centroid: restorCentroid(s) })),
  put('plan', plan.id, { ...plan, nodes: undefined, nodeCount: plan.nodes.length }),
  ...plan.nodes.map((n) => put('plannode', n.id, n)),
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
const tag = `restor-${String(start).padStart(7, '0')}`;
for (const [i, c] of chunks.entries()) {
  const f = `out/${tag}-${String(i).padStart(3, '0')}.sql`;
  await writeFile(f, c.join('\n') + '\n');
}
console.log(`wrote ${chunks.length} chunks (${sql.length} statements, ledger seq ${ev.seq})`);
for (const f of chunks.map((_, i) => `out/${tag}-${String(i).padStart(3, '0')}.sql`)) {
  try {
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: WIDE })
      .split('\n').filter((l) => /queries executed|ERROR/.test(l)).join('\n'));
  } catch {
    console.log(`  ${f} failed — retrying once after 5s`);
    await sleep(5000);
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: WIDE })
      .split('\n').filter((l) => /queries executed|ERROR/.test(l)).join('\n'));
  }
}
// Advance the hydration cursor only after chunks land.
await writeFile(CKPT, JSON.stringify({ ...ckpt, hydrateOffset: target }));
console.log(`done — hydrated through offset ${target}/${entries.length}`);
