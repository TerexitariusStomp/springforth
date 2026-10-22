// Infers action→outcome parentage where the source withholds links
// (OnePlanet's customer API returns flat OAIs). Best parent = lexical
// (canonical token Jaccard) blended with stored-embedding cosine, same
// source only, thresholded. Writes parentOutcomeId + parentInferred:true
// and a `hierarchy.inferred` ledger event continuing the hash chain.
// Run:   node scripts/infer-hierarchy.mjs            (from packages/edge)
// Apply: node scripts/infer-hierarchy.mjs --apply
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const DB = 'springforth-coord';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const THRESHOLD = 0.32;          // blended score floor
const CHILD_KINDS = new Set(['action', 'indicator']);
const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))[0].results;

const nodes = q("SELECT json FROM entities WHERE kind='plannode'").map((r) => JSON.parse(r.json));
const embs = new Map(q("SELECT json FROM entities WHERE kind='embedding'")
  .map((r) => { const e = JSON.parse(r.json); return [e.id.replace(/^emb:/, ''), e.vec]; }));
console.log(`nodes ${nodes.length} · embeddings ${embs.size}`);

const tokens = (n) => new Set((n.canonical ?? n.label.toLowerCase()).split(/\s+/).filter((w) => w.length > 2));
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};
const jaccard = (a, b) => {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

const bySource = new Map();
for (const n of nodes) bySource.set(n.source, [...(bySource.get(n.source) ?? []), n]);

const updates = [];
for (const [source, group] of bySource) {
  const outcomes = group.filter((n) => n.kind === 'outcome');
  if (!outcomes.length) continue;
  const outTok = new Map(outcomes.map((o) => [o.id, tokens(o)]));
  for (const n of group) {
    if (!CHILD_KINDS.has(n.kind) || n.parentOutcomeId) continue;
    const nt = tokens(n), nv = embs.get(n.id);
    let best, bestScore = 0;
    for (const o of outcomes) {
      const ov = embs.get(o.id);
      const score = jaccard(nt, outTok.get(o.id)) * 0.45
        + (nv && ov ? Math.max(0, cosine(nv, ov)) * 0.55 : 0);
      if (score > bestScore) { bestScore = score; best = o; }
    }
    if (best && bestScore >= THRESHOLD)
      updates.push({ node: n, parent: best, score: +bestScore.toFixed(3) });
  }
}
console.log(`inferred ${updates.length} parent links across ${bySource.size} sources`);
for (const u of updates.slice(0, 10)) console.log(`  ${u.score}  ${u.node.label.slice(0, 52)} → ${u.parent.label.slice(0, 40)}`);

const esc = (s) => s.replace(/'/g, "''");
const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
const e0 = { seq: head.seq + 1, at: NOW, actor: 'api', kind: 'hierarchy.inferred',
  payload: { links: updates.length, threshold: THRESHOLD,
    bySource: Object.fromEntries([...bySource.keys()].map((s) => [s,
      updates.filter((u) => u.node.source === s).length]).filter(([, c]) => c)) },
  prev_hash: head.hash };
const ledgerRow = { ...e0, hash: eventHash(e0) };

const sql = [
  ...updates.map(({ node, parent, score }) => {
    const next = { ...node, parentOutcomeId: parent.id, parentInferred: true,
      inferredScore: score };
    return `UPDATE entities SET json='${esc(JSON.stringify(next))}', updated_at='${NOW}' WHERE kind='plannode' AND id='${esc(node.id)}';`;
  }),
  `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${ledgerRow.seq},'${ledgerRow.at}','${ledgerRow.actor}','${ledgerRow.kind}','${esc(JSON.stringify(ledgerRow.payload))}','${ledgerRow.prev_hash}','${ledgerRow.hash}');`,
];
await mkdir('out', { recursive: true });
await writeFile('out/hierarchy.sql', sql.join('\n') + '\n');
console.log(`wrote out/hierarchy.sql (${sql.length} stmts, ledger ${head.seq + 1})`);
if (APPLY) console.log(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--file', 'out/hierarchy.sql'],
  { encoding: 'utf8' }).slice(0, 300));
