// Sarafu field-report import — the Zenodo public dataset
// (zenodo.org/records/20120190, Grassroots Economics / Sarafu Network).
// APPROVED reports with GPS → 'action' plannodes under a
// `sarafu:field-reports` plan — fulfilment evidence that surfaces in
// outcome overlap detection near our Kenya cards.
// Input: /tmp/sarafu-extract/data/csv/sarafu_network.field_reports.csv
// Run:   node scripts/seed-sarafu-reports.mjs /path/to/field_reports.csv
// Apply: … --apply   (run from packages/edge for wrangler config)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// h3-js lives in the coordination/edge workspace deps (pnpm isolation);
// resolve it explicitly so the script runs from repo root or packages/*.
import { latLngToCell } from '../packages/coordination/node_modules/h3-js/dist/h3-js.es.js';

const CSV = process.argv.find((a) => a.endsWith('.csv'))
  ?? '/tmp/sarafu-extract/data/csv/sarafu_network.field_reports.csv';
const DB = 'springforth-coord';
const APPLY = process.argv.includes('--apply');
const PLAN_ID = 'sarafu:field-reports';
const SAMPLE = 42;
const NEAR = { lat: -3.36, lon: 39.85 }; // Mida Creek anchor

const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8' }))[0].results;
const NOW = new Date().toISOString();

// minimal CSV parse — quoted fields, embedded newlines
function parseCsv(text) {
  const rows = []; let f = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inQ = false; }
      else f += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length > 3)
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const canonicalize = (s) => s.toLowerCase()
  .replace(/\[redacted-name:[0-9a-f]+\]/g, ' ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(the|a|an|of|for|and|in|to|project|programme|program|plan|initiative|scheme)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const clean = (s) => String(s ?? '')
  .replace(/\[redacted-name:[0-9a-f]+\]/g, ' ')
  .replace(/\s+/g, ' ').trim();
const parseLoc = (s) => {
  const m = String(s ?? '').match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lon: +m[2] } : null;
};
const dist = (loc) => Math.hypot(loc.lat - NEAR.lat, loc.lon - NEAR.lon);

const rows = parseCsv(await readFile(CSV, 'utf8'));
const ok = rows.filter((r) =>
  r.status === 'APPROVED' && parseLoc(r.location) && clean(r.description).length > 40);
const RELEVANT = /mangrove|reforest|tree plant|kaya|nursery|checkdam|erosion|wetland|marine|beach|farm|food|water/i;
const isRelevant = (r) => RELEVANT.test(`${r.title} ${r.description} ${r.tags}`);
// relevance first (mangrove/tree/water/farm reports overlap our Kenya cards),
// then geographic proximity to Mida Creek, tag-spread to stay diverse
const rel = ok.filter(isRelevant).sort((a, b) => dist(parseLoc(a.location)) - dist(parseLoc(b.location)));
const rest = ok.filter((r) => !isRelevant(r)).sort((a, b) => dist(parseLoc(a.location)) - dist(parseLoc(b.location)));
const picked = []; const seenTag = new Map();
for (const r of [...rel, ...rest]) {
  if (picked.length >= SAMPLE) break;
  const tag = (r.tags.match(/\}?\"?([A-Za-z ]+)\"?[,}]/) ?? [])[1] ?? 'other';
  if ((seenTag.get(tag) ?? 0) >= 5) continue;
  seenTag.set(tag, (seenTag.get(tag) ?? 0) + 1);
  picked.push(r);
}
console.log(`reports usable: ${ok.length} → sampled ${picked.length}`);

const entityRows = [['plan', PLAN_ID, {
  id: PLAN_ID, source: PLAN_ID,
  title: 'Sarafu Network field reports (Zenodo 20120190)',
  owner: 'Grassroots Economics / Sarafu Network',
  importedAt: NOW, nodeCount: picked.length }]];
for (const r of picked) {
  const loc = parseLoc(r.location);
  let label = clean(r.title).slice(0, 90) || clean(r.description).slice(0, 90);
  label = label.charAt(0).toUpperCase() + label.slice(1);
  const tags = [...r.tags.matchAll(/"([^"]+)"|\{([^}",]+)/g)]
    .map((m) => (m[1] ?? m[2] ?? '').trim()).filter(Boolean);
  entityRows.push(['plannode', `sarafu:field-reports-action-${r.id}`, {
    id: `sarafu:field-reports-action-${r.id}`, kind: 'action',
    label, canonical: canonicalize(label), source: PLAN_ID,
    h3: latLngToCell(loc.lat, loc.lon, 7),
    placeId: `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`,
    orgIds: [], tags: [...tags.slice(0, 4), 'sarafu', 'field-report'],
    timeframe: { from: r.period_from?.slice(0, 10), to: r.period_to?.slice(0, 10) },
    description: `${clean(r.description).slice(0, 500)} — status ${r.status}, vouchers: ${r.vouchers || '—'}. Zenodo 20120190.`,
  }]);
}

const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
const e0 = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'plan.imported',
  payload: { id: PLAN_ID, nodes: picked.length, via: 'zenodo:20120190' }, prev_hash: head.hash };
const ledgerRow = { ...e0, hash: eventHash(e0) };

const esc = (s) => s.replace(/'/g, "''");
const sql = [
  // reseed is wipe-and-rewrite: stale picks from earlier samples must not linger
  `DELETE FROM entities WHERE kind='plannode' AND json_extract(json,'$.source')='${PLAN_ID}';`,
  ...entityRows.map(([kind, id, obj]) =>
    `INSERT INTO entities(kind,id,json,updated_at) VALUES('${kind}','${esc(id)}','${esc(JSON.stringify(obj))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${ledgerRow.seq},'${ledgerRow.at}','${ledgerRow.actor}','${ledgerRow.kind}','${esc(JSON.stringify(ledgerRow.payload))}','${ledgerRow.prev_hash}','${ledgerRow.hash}');`,
];
await mkdir('out', { recursive: true });
const f = 'out/seed-42a.sql';
await writeFile(f, sql.join('\n') + '\n');
console.log(`wrote ${f} (${sql.length} stmts, ledger ${head.seq + 1})`);
if (APPLY) console.log(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
  { encoding: 'utf8' }).slice(0, 400));
