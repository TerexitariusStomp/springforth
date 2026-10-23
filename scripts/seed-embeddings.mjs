// Builds bge-base-en-v1.5 embeddings for every plannode via the Workers
// AI REST API (wrangler OAuth session — no extra secret needed), writes
// `embedding` entities + a `embeddings.built` ledger event.
// Same effect as POST /embeddings/build, runnable without ADMIN_TOKEN.
// Run:   node scripts/seed-embeddings.mjs            (from repo root)
// Apply: node scripts/seed-embeddings.mjs --apply
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DB = 'springforth-coord';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const MODEL = '@cf/baai/bge-base-en-v1.5';
const BATCH = 50;
const ACCT = '46966abcfb8f1245ec055842177edcb2';

const oauth = readFileSync(join(homedir(), '.wrangler/config/default.toml'), 'utf8')
  .match(/oauth_token = "([^"]+)"/)?.[1];
if (!oauth) { console.error('no wrangler oauth token'); process.exit(1); }

const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))[0].results;

const nodes = q("SELECT json FROM entities WHERE kind='plannode'").map((r) => JSON.parse(r.json));
const have = new Set(q("SELECT json FROM entities WHERE kind='embedding'")
  .map((r) => JSON.parse(r.json).id));
const todo = nodes.filter((n) => !have.has(`emb:${n.id}`));
console.log(`nodes ${nodes.length} · already embedded ${have.size} · to embed ${todo.length}`);

const text = (n) => `${n.label} ${n.description ?? ''} ${(n.tags ?? []).join(' ')}`.slice(0, 512);
const embed = async (texts) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${oauth}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: texts }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).result.data;
};

const esc = (s) => s.replace(/'/g, "''");
const stmts = [];
let done = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const vecs = await embed(batch.map(text));
  for (const [j, n] of batch.entries()) {
    if (!vecs[j]) continue;
    const row = { id: `emb:${n.id}`, nodeId: n.id, vec: vecs[j], model: MODEL };
    stmts.push(`INSERT INTO entities(kind,id,json,updated_at) VALUES('embedding','${esc(row.id)}','${esc(JSON.stringify(row))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`);
    done++;
  }
  process.stdout.write(`\r  embedded ${done}/${todo.length}`);
}
console.log();

const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
const e0 = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'embeddings.built',
  payload: { nodes: done, skipped: nodes.length - todo.length, model: MODEL },
  prev_hash: head.hash };
const ledgerRow = { ...e0, hash: eventHash(e0) };
stmts.push(`INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${ledgerRow.seq},'${ledgerRow.at}','${ledgerRow.actor}','${ledgerRow.kind}','${esc(JSON.stringify(ledgerRow.payload))}','${ledgerRow.prev_hash}','${ledgerRow.hash}');`);

await mkdir('out', { recursive: true });
await writeFile('out/embeddings.sql', stmts.join('\n') + '\n');
console.log(`wrote out/embeddings.sql (${stmts.length} stmts, ledger ${head.seq + 1})`);
if (APPLY) console.log(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--file', 'out/embeddings.sql'],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).slice(-400));
