// Replays POST /overlaps/detect against remote D1 — same code path as the
// worker route, for when admin runs happen from a script (seeded nodes).
// Pulls all plannodes, runs detectOverlaps + detectComplements, upserts
// records (prior non-proposed validation state preserved), appends
// `overlaps.detected` to the ledger continuing the hash chain.
// Run:   node scripts/detect-overlaps.mjs            (from packages/edge)
// Apply: node scripts/detect-overlaps.mjs --apply
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { detectOverlaps, detectComplements } from '../packages/coordination/src/resolve.ts';

const DB = 'springforth-coord';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))[0].results;

const nodes = q("SELECT json FROM entities WHERE kind='plannode'").map((r) => JSON.parse(r.json));
const existing = q("SELECT json FROM entities WHERE kind='overlap'").map((r) => JSON.parse(r.json));
const keep = new Map(existing.map((o) => [o.id, o]));
console.log(`nodes ${nodes.length} · existing overlaps ${existing.length}`);

const detected = [...detectOverlaps(nodes), ...detectComplements(nodes)];
const write = detected.map((rec) => {
  const prior = keep.get(rec.id);
  return prior && prior.status !== 'proposed' ? prior : rec;
});
console.log(`detected ${detected.length} records (${write.filter((r) => !keep.has(r.id)).length} new)`);

const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
const e0 = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'overlaps.detected',
  payload: { nodes: nodes.length, found: detected.length,
    complements: detected.filter((r) => r.kind === 'complement').length },
  prev_hash: head.hash };
const ledgerRow = { ...e0, hash: eventHash(e0) };

const esc = (s) => s.replace(/'/g, "''");
const sql = [
  ...write.map((r) =>
    `INSERT INTO entities(kind,id,json,updated_at) VALUES('overlap','${esc(r.id)}','${esc(JSON.stringify(r))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${ledgerRow.seq},'${ledgerRow.at}','${ledgerRow.actor}','${ledgerRow.kind}','${esc(JSON.stringify(ledgerRow.payload))}','${ledgerRow.prev_hash}','${ledgerRow.hash}');`,
];
await mkdir('out', { recursive: true });
await writeFile('out/overlaps.sql', sql.join('\n') + '\n');
console.log(`wrote out/overlaps.sql (${sql.length} stmts, ledger ${head.seq + 1})`);
if (APPLY) console.log(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--file', 'out/overlaps.sql'],
  { encoding: 'utf8' }).slice(0, 300));
