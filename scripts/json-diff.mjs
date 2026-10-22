// Post-change JSON contract check — compares each live JSON response
// against the pre-change snapshot in .styleseed/evidence/json-before/.
// Reports two classes:
//   SHAPE  — key added/removed or JSON type changed  → contract break (fail)
//   DRIFT  — same shape, values differ / list grew   → live data drift (report)
// Usage: node scripts/json-diff.mjs [baseUrl]
import { readFileSync, readdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'https://springforth.widespread.workers.dev';
const DIR = '.styleseed/evidence/json-before';
const ROUTES = {
  'metrics.json': '/metrics',
  'trust.json': '/trust',
  'commitments.json': '/commitments',
  'resources.json': '/resources',
  'retro.json': '/retro',
  'pledges.json': '/pledges',
  'claims.json': '/claims',
  'attestations.json': '/attestations',
  'actors_demo-amina.json': '/actors/demo-amina',
  'governance.json': '/governance',
  'rounds_format_json.json': '/rounds?format=json',
  'streams.json': '/streams',
  'datasets.json': '/datasets',
  'sources.json': '/sources',
  'verify_format_json.json': '/verify?format=json',
  'possibilities_format_json.json': '/possibilities?format=json',
};

const shape = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function diff(a, b, path, out, depth = 0) {
  if (shape(a) !== shape(b)) { out.shape.push(`${path}: ${shape(a)} → ${shape(b)}`); return; }
  if (shape(a) === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.join() !== kb.join())
      out.shape.push(`${path}: keys [${ka}] → [${kb}]`);
    for (const k of ka) if (k in b) diff(a[k], b[k], `${path}.${k}`, out, depth + 1);
    return;
  }
  if (shape(a) === 'array') {
    if (a.length !== b.length) out.drift.push(`${path}: length ${a.length} → ${b.length}`);
    // Compare overlapping elements (capped); item shape differences are breaks.
    const n = Math.min(a.length, b.length, 400);
    for (let i = 0; i < n; i++) diff(a[i], b[i], `${path}[${i}]`, out, depth + 1);
    return;
  }
  if (a !== b) out.drift.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}

let fails = 0;
for (const file of readdirSync(DIR)) {
  const route = ROUTES[file];
  if (!route) { console.log(`skip ${file}`); continue; }
  const before = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8'));
  const res = await fetch(BASE + route, { headers: { accept: 'application/json' } });
  let after = null;
  try { after = await res.json(); } catch { /* leave null */ }
  const out = { shape: [], drift: [] };
  diff(before, after, '$', out);
  if (out.shape.length) {
    fails++;
    console.log(`SHAPE-BREAK ${route}`);
    for (const s of out.shape.slice(0, 8)) console.log(`   ${s}`);
  } else if (out.drift.length) {
    console.log(`drift ${route} (${out.drift.length} value changes — live data, shape intact)`);
  } else {
    console.log(`ok    ${route}`);
  }
}
console.log(fails ? `\n${fails} route(s) broke the contract` : '\nno contract breaks');
process.exit(fails ? 1 : 0);
