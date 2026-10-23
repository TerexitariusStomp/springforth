// Springforth → OnePlanet push — the reverse lane of seed-oneplanet.mjs.
// Publishes live possibility cards as OAIs in the SFLive "Sustainable
// Finance Live 2025 Event" plan so hackathon OnePlanet can see our data:
//   every possibility → Outcome (title + status/quorum/provenance URL)
//   flagship cards    → + Action and Indicator for depth
// Idempotent: find_oai checks the name first; already-present OAIs are
// skipped. Writes a `oneplanet.exported` ledger event on the remote DB so
// the push is auditable alongside plan.imported events.
// Run:   node scripts/push-oneplanet.mjs            (from packages/edge; key in .dev.vars)
// Apply: node scripts/push-oneplanet.mjs --apply
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.ONEPLANET_API_KEY
  ?? (await readFile('.dev.vars', 'utf8').catch(() => '')).match(/ONEPLANET_API_KEY=(\S+)/)?.[1];
if (!KEY) { console.error('ONEPLANET_API_KEY required'); process.exit(1); }
const DB = 'springforth-coord';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const PLAN = '4c45107b-b551-413a-b47f-26af21785248'; // Sustainable Finance Live 2025 Event
const SITE = 'https://springforth.widespread.workers.dev';

// ── MCP client — official SDK (resolved from edge's deps) ───────────────
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const client = new Client({ name: 'springforth', version: '1.0' });
await client.connect(new StreamableHTTPClientTransport(
  new URL('https://mcp.oneplanet.com/mcp'),
  { requestInit: { headers: { authorization: `Bearer ${KEY}` } } }));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const c = r?.content?.[0]?.text;
  if (r?.isError) {
    if (c?.includes('FORBIDDEN') || c?.includes('Insufficient permissions')) {
      console.error(`${name}: FORBIDDEN — this API key is read-only. ` +
        'Write ops need a write-scoped key from OnePlanet (request via ' +
        'the Help Desk channel / Pooran); re-run once granted.');
      process.exit(2);
    }
    throw new Error(`${name}: ${c ?? 'tool error'}`);
  }
  try { return JSON.parse(c); } catch { return c; }
};

// ── Live data from the prod worker ──────────────────────────────────────
const poss = (await (await fetch(`${SITE}/possibilities?format=json`)).json()).possibilities;
const exists = async (name) => {
  const r = await call('find_oai', { query: name });
  const items = r?.matches ?? r?.results ?? r?.items ?? (Array.isArray(r) ? r : []);
  return items.find?.((m) => (m.name ?? '') === name) ?? null;
};

// What we push — one Outcome per card; flagship gets Action + Indicator.
// Dry-run does find_oai checks only; creates run solely under --apply.
const created = [], skipped = [], planned = [];
for (const p of poss) {
  if (await exists(p.title)) { skipped.push(p.title); continue; }
  planned.push(p);
}
console.log(`to create: ${planned.length} outcomes · skipped existing: ${skipped.length}`);

if (APPLY) for (const p of planned) {
  const desc = `${(p.description ?? '').slice(0, 400)}`
    + ` — Coordinated on Springforth (${SITE}/possibilities#${p.id}): `
    + `status ${p.status}, quorum ${p.participantCount ?? '?'}/${p.minParticipants ?? '?'}, `
    + `${p.place ?? 'location flexible'}.`;
  const o = await call('create_outcome', { plan_uuid: PLAN, name: p.title.slice(0, 120),
    description: desc, is_shared: true });
  created.push({ kind: 'outcome', name: p.title, uuid: o?.uuid ?? o?.oai?.uuid ?? o?.oai_uuid });
}

// Flagship depth — Action + Indicator under the event plan, linked by name
// (OnePlanet OAIs are flat; reviewers see them together in the plan list).
const FLAG = 'poss-mida-creek-mangrove';
const flag = poss.find((p) => p.id === FLAG);
if (flag && APPLY) {
  const an = 'Plant 1,200 mangrove propagules — Mida Creek shoreline day';
  if (!(await exists(an))) {
    const a = await call('create_action', { plan_uuid: PLAN, name: an,
      description: `Working day under "${flag.title}" — Springforth card reached quorum logic with committed participants. ${SITE}/possibilities#${FLAG}` });
    created.push({ kind: 'action', name: an, uuid: a?.uuid ?? a?.oai?.uuid });
  }
  const iname = 'Mangrove propagules planted at Mida Creek (count)';
  if (!(await exists(iname))) {
    const i = await call('create_indicator', { plan_uuid: PLAN, name: iname,
      description: 'Trees planted, cross-checked against Sarafu field reports + Sentinel-2 NDVI baseline (Springforth oracle readings).', is_shared: true });
    created.push({ kind: 'indicator', name: iname, uuid: i?.uuid ?? i?.oai?.uuid });
  }
}
console.log(`created ${created.length} OAIs · skipped ${skipped.length} existing`);
for (const c of created) console.log(' +', c.kind, c.name.slice(0, 60), c.uuid ?? '');

// ── Ledger event on remote D1 (audit trail for the push) ────────────────
if (APPLY && created.length) {
  const q = (sql) => JSON.parse(execFileSync('npx',
    ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
    { encoding: 'utf8' }))[0].results;
  const digest = (s) => createHash('sha256').update(s).digest('hex');
  const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
  const head = q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0];
  const e0 = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'oneplanet.exported',
    payload: { plan: PLAN, created: created.map((c) => ({ kind: c.kind, uuid: c.uuid })),
      skipped: skipped.length }, prev_hash: head.hash };
  const row = { ...e0, hash: eventHash(e0) };
  const esc = (s) => s.replace(/'/g, "''");
  const sql = `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${row.seq},'${row.at}','${row.actor}','${row.kind}','${esc(JSON.stringify(row.payload))}','${row.prev_hash}','${row.hash}');`;
  await mkdir('out', { recursive: true });
  await writeFile('out/oneplanet-export.sql', sql + '\n');
  execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--file', 'out/oneplanet-export.sql'], { encoding: 'utf8' });
  console.log(`ledger ${row.seq} — oneplanet.exported`);
}
