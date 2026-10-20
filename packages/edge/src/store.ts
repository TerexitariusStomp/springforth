import type { D1Database } from '@cloudflare/workers-types';
import { createHash } from 'node:crypto';

// D1 entity store: validated domain objects as JSON rows (kind,id).
// Semantics live in @springforth/core; storage stays a dumb key-value layer.

export async function put(db: D1Database, kind: string, id: string, obj: unknown) {
  await db.prepare(
    'INSERT INTO entities(kind,id,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at',
  ).bind(kind, id, JSON.stringify(obj), new Date().toISOString()).run();
}

export async function get<T>(db: D1Database, kind: string, id: string): Promise<T | null> {
  const r = await db.prepare('SELECT json FROM entities WHERE kind=? AND id=?')
    .bind(kind, id).first<{ json: string }>();
  return r ? JSON.parse(r.json) as T : null;
}

export async function list<T>(db: D1Database, kind: string): Promise<T[]> {
  const r = await db.prepare('SELECT json FROM entities WHERE kind=? ORDER BY id')
    .bind(kind).all<{ json: string }>();
  return (r.results ?? []).map((x) => JSON.parse(x.json) as T);
}

const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const eventHash = (e: { seq: number; at: string; actor: string; kind: string; payload: unknown; prev_hash: string }) =>
  digest(JSON.stringify([e.seq, e.at, e.actor, e.kind, e.payload, e.prev_hash]));

// D1-backed hash chain: append reads only the head; verify scans all.
export async function ledgerAppend(
  db: D1Database, actor: string, kind: string, payload: unknown, at = new Date().toISOString(),
) {
  const head = await db.prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')
    .first<{ seq: number; hash: string }>();
  const seq = (head?.seq ?? -1) + 1;
  const prev_hash = head?.hash ?? '0'.repeat(64);
  const base = { seq, at, actor, kind, payload, prev_hash };
  const hash = eventHash(base);
  await db.prepare('INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(?,?,?,?,?,?,?)')
    .bind(seq, at, actor, kind, JSON.stringify(payload), prev_hash, hash).run();
  return { ...base, hash };
}

export async function ledgerEvents(db: D1Database) {
  const r = await db.prepare('SELECT * FROM ledger ORDER BY seq').all<{
    seq: number; at: string; actor: string; kind: string; payload: string; prev_hash: string; hash: string;
  }>();
  return (r.results ?? []).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
}

export async function ledgerVerify(db: D1Database) {
  const events = await ledgerEvents(db);
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const prev = i === 0 ? '0'.repeat(64) : events[i - 1]!.hash;
    if (e.prev_hash !== prev || e.hash !== eventHash(e)) return { ok: false, brokenAt: e.seq };
  }
  return { ok: true, events: events.length };
}
