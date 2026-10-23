// Megaplan seed — h3 geo fields on seeded possibilities, council seats,
// forum posts, and review notes on the completed card. Emits
// out/seed-39.sql continuing the remote ledger hash chain.
// Run: node --experimental-strip-types scripts/seed-megaplan.mjs
// Apply: node --experimental-strip-types scripts/seed-megaplan.mjs --apply
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolvePlace } from '../src/geo.ts';

const DB = 'springforth-coord';
const APPLY = process.argv.includes('--apply');
const q = (sql) => JSON.parse(execFileSync('npx',
  ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
  { encoding: 'utf8' }))[0].results;

const NOW = new Date().toISOString();
const slug = (s) => s.toLowerCase().replace(/\W+/g, '-');

// 1. Possibilities → h3 cells via the gazetteer/node fallback.
const possRows = q(`SELECT id, json FROM entities WHERE kind='possibility'`)
  .map((r) => ({ id: r.id, ...JSON.parse(r.json) }));
const nodeRows = q(`SELECT json FROM entities WHERE kind='plannode'`)
  .map((r) => JSON.parse(r.json));
const h3Updates = [];
for (const p of possRows) {
  if (p.h3) continue;
  const g = resolvePlace({ id: p.id, place: p.place }, nodeRows);
  if (g?.h3) h3Updates.push([p.id, g.h3]);
}
console.log(`h3 resolvable: ${h3Updates.length}/${possRows.length} cards`);

// 2. Council seats + forum posts on the completed card(s).
const parts = q(`SELECT json FROM entities WHERE kind='participation'`)
  .map((r) => JSON.parse(r.json));
const completed = possRows.filter((p) => p.status === 'completed' || p.status === 'quorum');
const entities = [];
const seatFor = (pid, actor, role) => {
  const id = `seat-${pid}-${slug(actor)}-${role}`;
  entities.push(['council-seat', id,
    { id, possibilityId: pid, actor, role, at: NOW }]);
};
const forum = (pid, actor, kind, text, parentId) => {
  const id = `fp-${pid}-${slug(actor)}-${slug(text).slice(0, 20)}`;
  entities.push(['forum-post', id,
    { id, possibilityId: pid, parentId, actor, kind, text, at: NOW }]);
  return id;
};
const forumEvents = [];
for (const p of completed) {
  const mine = parts.filter((x) => x.possibilityId === p.id);
  seatFor(p.id, p.declarerId, 'declarer');
  for (const pt of mine) seatFor(p.id, pt.actor, 'participant');
  seatFor(p.id, 'aurelia (judge walkthrough)', 'verifier');
  forumEvents.push(['system', 'council.seated', { id: p.id, seats: mine.length + 2 }]);
  const first = forum(p.id, p.declarerId, 'note',
    'Debrief thread — what worked, what we would change before the next planting window.');
  const e1 = forum(p.id, 'aurelia (judge walkthrough)', 'evidence',
    'Verified the shoreline section in person on 2026-02-21 — planting rows visible above the tideline as reported.');
  forum(p.id, mine[0]?.actor ?? p.declarerId, 'review',
    'Logistics were tight but the nursery voucher covered the gap — would join again.');
  forum(p.id, p.declarerId, 'note',
    'Tool count starts earlier next time — spades ran short by 10.', first);
  forumEvents.push([p.declarerId, 'forum.posted', { id: first, possibilityId: p.id, kind: 'note' }]);
  forumEvents.push(['aurelia (judge walkthrough)', 'forum.posted', { id: e1, possibilityId: p.id, kind: 'evidence' }]);
}
console.log(`council/forum seeded on ${completed.length} activated cards`);

// 3. Review notes — the Kwale card already carries three; add one more
// on each activated card that has participants but no notes yet.
const apps = q(`SELECT json FROM entities WHERE kind='appreciation'`)
  .map((r) => JSON.parse(r.json));
for (const p of completed) {
  const mine = parts.filter((x) => x.possibilityId === p.id);
  if (mine.length < 2) continue;
  if (apps.some((a) => a.possibilityId === p.id && a.note?.trim())) continue;
  const [a, b] = mine;
  const id = `app-${slug(a.actor)}-${slug(b.actor)}-review`;
  entities.push(['appreciation', id, {
    id, fromActor: a.actor, toActor: b.actor, possibilityId: p.id,
    note: 'showed up early and stayed until the last tray was empty',
    at: NOW }]);
  forumEvents.push([a.actor, 'possibility.appreciated', { id: p.id, to: b.actor }]);
}

// 3.5 Interest rows — the warm "I'm interested" signal on live cards,
// from actors who haven't joined (watching, not committed). Feeds the
// ?for=<actor> interest feed and the public watching count.
const live = possRows.filter((p) => ['active', 'draft'].includes(p.status));
const WATCHERS = ['bilal', 'chao', 'dunia', 'ezra', 'femi'];
let seeded = 0;
for (const p of live) {
  const joined = new Set(parts.filter((x) => x.possibilityId === p.id)
    .map((x) => x.actor));
  for (const w of WATCHERS) {
    if (joined.has(w) || seeded >= 4) break;
    const id = `interest-${p.id}-${slug(w)}`;
    entities.push(['interest', id,
      { id, possibilityId: p.id, actor: w, at: NOW }]);
    forumEvents.push([w, 'possibility.interested', { id: p.id }]);
    seeded++;
    break;
  }
}
console.log(`interests seeded: ${seeded}`);

// 4. Ledger rows — continue the remote hash chain (same hash as store.ts).
const digest = (s) => createHash('sha256').update(s).digest('hex');
const eventHash = (e) => digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));
const head = (q('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')[0]) ?? { seq: -1, hash: '0'.repeat(64) };
let seq = head.seq, prev = head.hash;
const ledgerRows = [];
const append = (actor, kind, payload) => {
  const e = { seq: ++seq, at: NOW, actor, kind, payload, prev_hash: prev };
  prev = eventHash(e);
  ledgerRows.push({ ...e, hash: prev });
};
for (const [actor, kind, payload] of forumEvents) append(actor, kind, payload);
append('seed', 'geo.resolved', { cards: h3Updates.length });

const esc = (s) => s.replace(/'/g, "''");
const sql = [
  ...h3Updates.map(([id, h3]) =>
    `UPDATE entities SET json=JSON_SET(json,'$.h3','${h3}'), updated_at='${NOW}' WHERE kind='possibility' AND id='${esc(id)}';`),
  ...entities.map(([kind, id, obj]) =>
    `INSERT INTO entities(kind,id,json,updated_at) VALUES('${kind}','${esc(id)}','${esc(JSON.stringify(obj))}','${NOW}') ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;`),
  ...ledgerRows.map((e) => `INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(${e.seq},'${e.at}','${esc(e.actor)}','${e.kind}','${esc(JSON.stringify(e.payload))}','${e.prev_hash}','${e.hash}');`),
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
const files = [];
for (const [i, c] of chunks.entries()) {
  const f = `out/seed-${String(39 + i).padStart(2, '0')}.sql`;
  await writeFile(f, c.join('\n') + '\n');
  files.push(f);
}
console.log(`wrote ${files.join(', ')} (${sql.length} statements, ledger seq ${head.seq + 1}→${seq})`);
if (APPLY) {
  for (const f of files) {
    console.log(`── applying ${f}`);
    console.log(execFileSync('npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--file', f],
      { encoding: 'utf8' }).slice(0, 400));
  }
} else {
  console.log('dry run — re-run with --apply to push to remote D1');
}
