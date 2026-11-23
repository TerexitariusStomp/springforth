import type { D1Database } from '@cloudflare/workers-types';
import { createHash } from 'node:crypto';

// D1 entity store: validated domain objects as JSON rows (kind,id).
// Semantics live in @springforth/core; storage stays a dumb key-value layer.

export async function put(db: D1Database, kind: string, id: string, obj: unknown) {
  await db.prepare(
    'INSERT INTO entities(kind,id,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at',
  ).bind(kind, id, JSON.stringify(obj), new Date().toISOString()).run();
}

// Bulk put — one D1 round-trip per ~500 rows instead of per row; sync
// importers (Silvi claims, plan graphs) write thousands of entities.
export async function putMany(
  db: D1Database, kind: string, rows: { id: string; obj: unknown }[],
) {
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    await db.batch(rows.slice(i, i + 500).map((r) =>
      db.prepare(
        'INSERT INTO entities(kind,id,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at',
      ).bind(kind, r.id, JSON.stringify(r.obj), now)));
  }
}

// putMany variant that reads existing rows first and writes only rows
// whose serialized JSON actually changed. Re-runnable syncs (Silvi claims,
// Giveth backfill, Bloom chapters) cost reads (5M/day) instead of
// re-burning the write budget (100k rows/day) on identical rows.
export async function putManyIfChanged(
  db: D1Database, kind: string, rows: { id: string; obj: unknown }[],
): Promise<{ written: number; unchanged: number }> {
  const changed: typeof rows = [];
  let unchanged = 0;
  for (let i = 0; i < rows.length; i += 90) {
    const slice = rows.slice(i, i + 90);
    const marks = slice.map(() => '?').join(',');
    const existing = await db.prepare(
      `SELECT id, json FROM entities WHERE kind=? AND id IN (${marks})`,
    ).bind(kind, ...slice.map((r) => r.id)).all<{ id: string; json: string }>();
    const byId = new Map((existing.results ?? []).map((r) => [r.id, r.json]));
    for (const r of slice) {
      if (byId.get(r.id) === JSON.stringify(r.obj)) unchanged++;
      else changed.push(r);
    }
  }
  await putMany(db, kind, changed);
  return { written: changed.length, unchanged };
}

// Packed provenance — a fetched upstream page stored as ONE entity
// ({records:[...]}), so bulk imports write ~30 rows instead of ~15k.
// Packed kinds get a distinct name (<raw>-pg) so LIKE-prefix readers
// never confuse a page blob with a per-record row; consumers flatten
// packed pages and legacy per-record rows together.
export async function putPackedPage(
  db: D1Database, kind: string, id: string, records: unknown[],
) {
  return putManyIfChanged(db, kind, [{ id, obj: { records } }]);
}

export async function listPacked<T>(
  db: D1Database, kind: string, like: string,
): Promise<T[]> {
  const pages = await listWhere<{ records: T[] }>(db, kind, 'id LIKE ?', like);
  return pages.flatMap((p) => p.records ?? []);
}

// Insert only when absent, then re-read — concurrent first-writers
// converge on the single persisted row instead of racing two minted
// values where only one survives (the ops-export salt race, 2026-11
// review: atomic get-or-create returning the same value to all callers).
export async function putIfAbsent<T>(
  db: D1Database, kind: string, id: string, obj: unknown,
): Promise<T | null> {
  await db.prepare(
    'INSERT INTO entities(kind,id,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO NOTHING',
  ).bind(kind, id, JSON.stringify(obj), new Date().toISOString()).run();
  return get<T>(db, kind, id);
}

export async function get<T>(db: D1Database, kind: string, id: string): Promise<T | null> {
  const r = await db.prepare('SELECT json FROM entities WHERE kind=? AND id=?')
    .bind(kind, id).first<{ json: string }>();
  return r ? JSON.parse(r.json) as T : null;
}

export async function del(db: D1Database, kind: string, id: string) {
  await db.prepare('DELETE FROM entities WHERE kind=? AND id=?').bind(kind, id).run();
}

export async function list<T>(db: D1Database, kind: string): Promise<T[]> {
  const r = await db.prepare('SELECT json FROM entities WHERE kind=? ORDER BY id')
    .bind(kind).all<{ json: string }>();
  return (r.results ?? []).map((x) => JSON.parse(x.json) as T);
}

// Filtered list — the SQL WHERE clause runs inside D1 so hot paths only
// parse the rows they actually consume (e.g. deck cards need only the
// plannodes carrying a possibilityId, not every imported plan node).
export async function listWhere<T>(db: D1Database, kind: string, where: string, ...binds: unknown[]): Promise<T[]> {
  const r = await db.prepare(`SELECT json FROM entities WHERE kind=? AND ${where} ORDER BY id`)
    .bind(kind, ...binds as never[]).all<{ json: string }>();
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

// Atomic entity writes + ledger event in one db.batch. The head read
// supplies seq/prev_hash; a concurrent append between the read and the
// batch collides on the seq primary key, the whole batch rolls back,
// and we retry on a fresh head — so entity state and its provenance
// event can never tear across a ledger cut (the claim-writer race the
// 2026-11 export review demonstrated).
export async function ledgerAppendWith(
  db: D1Database,
  writes: { kind: string; id: string; obj: unknown }[],
  event: { actor: string; kind: string; payload: unknown; at?: string },
  attempts = 3,
): Promise<{ seq: number; hash: string }> {
  const at = event.at ?? new Date().toISOString();
  for (let i = 0; ; i++) {
    const head = await db.prepare('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1')
      .first<{ seq: number; hash: string }>();
    const seq = (head?.seq ?? -1) + 1;
    const prev_hash = head?.hash ?? '0'.repeat(64);
    const base = { seq, at, actor: event.actor, kind: event.kind, payload: event.payload, prev_hash };
    const hash = eventHash(base);
    try {
      await db.batch([
        db.prepare(
          'INSERT INTO ledger(seq,at,actor,kind,payload,prev_hash,hash) VALUES(?,?,?,?,?,?,?)',
        ).bind(seq, at, event.actor, event.kind, JSON.stringify(event.payload), prev_hash, hash),
        ...writes.map((w) => db.prepare(
          'INSERT INTO entities(kind,id,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at',
        ).bind(w.kind, w.id, JSON.stringify(w.obj), at)),
      ]);
      return { seq, hash };
    } catch (e) {
      if (i >= attempts - 1 || !/unique|constraint/i.test(String(e))) throw e;
    }
  }
}

type LedgerRow = {
  seq: number; at: string; actor: string; kind: string; payload: string; prev_hash: string; hash: string;
};
const parseRow = (e: LedgerRow) => ({ ...e, payload: JSON.parse(e.payload) });

// Head at an exact seq — the same-cut reference a reviewer needs when
// replaying a dated export against the chain. This is a STORED-hash
// lookup, not verification; pair with ledgerVerifyPrefix (the route's
// ?seq=N&verify=1) when the claim is chain integrity, not just a
// matching cut.
export async function ledgerHeadAt(db: D1Database, seq: number) {
  return db.prepare('SELECT seq, hash FROM ledger WHERE seq=?')
    .bind(seq).first<{ seq: number; hash: string }>();
}

async function ledgerEventsUpTo(db: D1Database, uptoSeq: number) {
  const r = await db.prepare('SELECT * FROM ledger WHERE seq<=? ORDER BY seq')
    .bind(uptoSeq).all<LedgerRow>();
  return (r.results ?? []).map(parseRow);
}

// Recompute the hash chain for events 1..uptoSeq and compare the tip to
// the stored head at that cut — a real prefix verification, not a
// stored-hash echo. Use it to answer "is the chain intact through cut
// N" (dated export replay); full-chain integrity is ledgerVerify.
// Full event row at a seq — the /ledger/proof inclusion surface.
// Returns null for out-of-range or empty ledgers.
export async function ledgerEventAt(db: D1Database, seq: number) {
  return db.prepare('SELECT seq,at,actor,kind,payload,prev_hash,hash FROM ledger WHERE seq=?')
    .bind(seq).first<{
      seq: number; at: string; actor: string; kind: string;
      payload: string; prev_hash: string; hash: string;
    }>();
}

export async function ledgerVerifyPrefix(db: D1Database, uptoSeq: number) {
  const events = await ledgerEventsUpTo(db, uptoSeq);
  if (!events.length) return { ok: false, brokenAt: uptoSeq };
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const prev = i === 0 ? '0'.repeat(64) : events[i - 1]!.hash;
    if (e.prev_hash !== prev || e.hash !== eventHash(e))
      return { ok: false, brokenAt: e.seq };
  }
  const tip = events.at(-1)!;
  const stored = await ledgerHeadAt(db, uptoSeq);
  if (!stored || stored.hash !== tip.hash)
    return { ok: false, brokenAt: uptoSeq };
  return { ok: true, verified: events.length, head: tip.hash };
}

export async function ledgerEvents(db: D1Database) {
  const r = await db.prepare('SELECT * FROM ledger ORDER BY seq').all<LedgerRow>();
  return (r.results ?? []).map(parseRow);
}

// Tail of the chain — tickers and page summaries only need recent events.
export async function ledgerTail(db: D1Database, n = 60) {
  const r = await db.prepare('SELECT * FROM ledger ORDER BY seq DESC LIMIT ?')
    .bind(n).all<LedgerRow>();
  return (r.results ?? []).reverse().map(parseRow);
}

// Events whose payload text mentions a substring (e.g. 'poss-') — a
// superset pre-filter so per-card audit trails skip the full scan.
export async function ledgerEventsMentioning(db: D1Database, needle: string) {
  const r = await db.prepare('SELECT * FROM ledger WHERE payload LIKE ? ORDER BY seq')
    .bind(`%${needle}%`).all<LedgerRow>();
  return (r.results ?? []).map(parseRow);
}

export async function ledgerVerify(db: D1Database) {
  const events = await ledgerEvents(db);
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const prev = i === 0 ? '0'.repeat(64) : events[i - 1]!.hash;
    if (e.prev_hash !== prev || e.hash !== eventHash(e)) return { ok: false, brokenAt: e.seq };
  }
  // `head` is the published chain tip — the ops export's manifest
  // `ledger_head` is byte-identical to this value at the same cut.
  return { ok: true, events: events.length, head: events.at(-1)?.hash };
}

// Incremental verify for display banners: a `verify-checkpoint` entity
// remembers the last verified head {seq,hash}, so steady-state requests
// only hash newly appended events. /ledger/verify keeps the full scan.
export async function ledgerVerifyIncremental(db: D1Database) {
  const cp = await get<{ seq: number; hash: string }>(db, 'verify-checkpoint', 'head');
  const head = await db.prepare('SELECT seq FROM ledger ORDER BY seq DESC LIMIT 1')
    .first<{ seq: number }>();
  const tail = head?.seq ?? -1;
  if (cp && cp.seq >= tail) return { ok: true, events: tail + 1 };
  const r = await db.prepare('SELECT * FROM ledger WHERE seq>? ORDER BY seq')
    .bind(cp?.seq ?? -1).all<LedgerRow>();
  let prev = cp?.hash ?? '0'.repeat(64);
  let last = cp?.seq ?? -1;
  for (const e of r.results ?? []) {
    const ev = { seq: e.seq, at: e.at, actor: e.actor, kind: e.kind,
      payload: JSON.parse(e.payload), prev_hash: e.prev_hash };
    if (e.prev_hash !== prev || e.hash !== eventHash(ev))
      return { ok: false, brokenAt: e.seq };
    prev = e.hash; last = e.seq;
  }
  // Checkpoint is a memo, not correctness — a write-quota outage degrades
  // it to the full scan next time rather than erroring the page.
  await put(db, 'verify-checkpoint', 'head', { seq: Math.max(last, tail), hash: prev })
    .catch(() => undefined);
  return { ok: true, events: tail + 1 };
}
