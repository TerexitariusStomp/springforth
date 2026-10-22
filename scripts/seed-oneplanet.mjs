// OnePlanet live import — pulls a plan's OAIs from mcp.oneplanet.com via the
// real key (env ONEPLANET_API_KEY) and writes what POST /plans/import writes:
// a node-stripped `plan` row + `plannode` rows + a `plan.imported` ledger
// event continuing the remote hash chain.
// Run:   ONEPLANET_API_KEY=opk_… node scripts/seed-oneplanet.mjs
// Apply: ONEPLANET_API_KEY=opk_… node scripts/seed-oneplanet.mjs --apply
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const DB = 'springforth-coord';
const KEY = process.env.ONEPLANET_API_KEY;
if (!KEY) { console.error('ONEPLANET_API_KEY required'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const WS = '3db92684-b538-4fdc-9799-83ca141483cb';
// Plan uuids to import — default: every plan in the workspace (full copy).
// Pass uuids as args to narrow, e.g. `node seed-oneplanet.mjs <uuid> …`.
const PLANS_ARG = process.argv.filter((a) => /^[0-9a-f-]{36}$/.test(a));

const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8' }))[0].results;
const NOW = new Date().toISOString();

// ── MCP client — official SDK (resolved from edge's deps, pnpm isolation)
import { Client } from '../packages/edge/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StreamableHTTPClientTransport } from '../packages/edge/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
const client = new Client({ name: 'springforth-seed', version: '0.1.0' });
await client.connect(new StreamableHTTPClientTransport(
  new URL('https://mcp.oneplanet.com/mcp'),
  { requestInit: { headers: { authorization: `Bearer ${KEY}` } } }));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error(`${name}: ${JSON.stringify(r.content).slice(0, 200)}`);
  const t = (r.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return JSON.parse(t);
};

const canonicalize = (s) => s.toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(the|a|an|of|for|and|in|to|project|programme|program|plan|initiative|scheme)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const OAI_KIND = { outcome: 'outcome', action: 'action', indicator: 'indicator' };

// real plan names from list_workspace_plans (uuid → name); pages through all
const nameOf = new Map();
for (let offset = 0; ; offset += 100) {
  const d = await call('list_workspace_plans',
    { workspace_uuid: WS, limit: 100, offset }, 2);
  for (const p of d.items ?? []) nameOf.set(p.uuid, p.name);
  if (!d.has_more) break;
}
const PLANS = PLANS_ARG.length ? PLANS_ARG : [...nameOf.keys()];
// ledger events only for plans not already stored (idempotent re-runs)
const already = new Set(
  q("SELECT id FROM entities WHERE kind='plan' AND id LIKE 'oneplanet:%'").map((r) => r.id));
console.log(`plans in workspace: ${nameOf.size} · already imported: ${already.size}`);

const entityRows = [];
const imported = [];
for (const planId of PLANS) {
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const d = await call('query_plan_oais', { plan_uuid: planId, limit: 100, offset }, 1);
    items.push(...(d.items ?? []));
    if (!d.has_more) break;
  }
  if (!items.length) { console.error(`no OAIs for ${planId}`); continue; }
  const source = `oneplanet:${planId}`;
  const nodes = [];
  for (const it of items) {
    const kind = OAI_KIND[String(it.label ?? '').toLowerCase()];
    if (!kind) continue;
    const label = String(it.name ?? `${kind} ${it.uuid}`);
    nodes.push({
      id: `${source}-${kind}-${it.uuid}`, kind, label,
      canonical: canonicalize(label), source,
      orgIds: [], tags: [],
      timeframe: it.due_date ? { to: it.due_date } : {},
      description: String(it.description ?? ''),
    });
  }
  entityRows.push(['plan', source, {
    id: source, source,
    title: nameOf.get(planId) ?? `OnePlanet ${planId.slice(0, 8)}`,
    owner: 'OnePlanet SFLive Sandbox',
    importedAt: NOW, nodeCount: nodes.length }]);
  for (const n of nodes) entityRows.push(['plannode', n.id, n]);
  if (!already.has(source)) imported.push({ id: source, nodes: nodes.length });
  console.log(`${source}: ${nodes.length} OAI nodes — ${nameOf.get(planId) ?? ''}`);
}

// ledger — continue the remote chain
const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
let seq = head.seq, prev = head.hash;
const ledgerRows = [];
for (const imp of imported) {
  const e = { seq: ++seq, at: NOW, actor: 'api', kind: 'plan.imported',
    payload: { id: imp.id, nodes: imp.nodes, via: 'mcp' }, prev_hash: prev };
  prev = eventHash(e);
  ledgerRows.push({ ...e, hash: prev });
}

const esc = (s) => s.replace(/'/g, "''");
const sql = [
  ...entityRows.map(([kind, id, obj]) =>
    `INSERT INTO entities(kind,id,json,updated_at) VALUES('${kind}','${esc(id)}','${esc(JSON.stringify(obj))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  ...ledgerRows.map((e) =>
    `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${e.seq},'${e.at}','${esc(e.actor)}','${e.kind}','${esc(JSON.stringify(e.payload))}','${e.prev_hash}','${e.hash}');`),
];

await mkdir('out', { recursive: true });
const MAX = 48 * 1024;
const chunks = []; let cur = [];
for (const stmt of sql) {
  if (cur.join('\n').length + stmt.length > MAX && cur.length) { chunks.push(cur); cur = []; }
  cur.push(stmt);
}
if (cur.length) chunks.push(cur);
const files = [];
for (const [i, c] of chunks.entries()) {
  const f = `out/seed-41${String.fromCharCode(97 + i)}.sql`;
  await writeFile(f, c.join('\n') + '\n');
  files.push(f);
}
console.log(`wrote ${files.join(', ')} (${sql.length} stmts, ledger ${head.seq + 1}→${seq})`);
if (APPLY) for (const f of files) {
  console.log(`── applying ${f}`);
  console.log(execFileSync('npx',
    ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
    { encoding: 'utf8' }).slice(0, 400));
}
