// Store-level tests over a real SQLite database (node:sqlite) with the
// production schema — exercises refreshOpsExport's dated-snapshot
// recovery and ledgerVerifyPrefix against actual SQL, the same boundary
// the 2026-11 CoWizardex review reproduced.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { refreshOpsExport } from '../src/opsexport.ts';
import { ledgerAppend, ledgerHeadAt, ledgerVerifyPrefix } from '../src/store.ts';
import type { D1Database } from '@cloudflare/workers-types';

type FailFn = (sql: string, args: unknown[]) => boolean;

function makeDb(fail?: FailFn) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_schema.sql', 'utf8'));
  const prep = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...a: unknown[]) => prep(sql, a),
    run: async () => {
      if (fail?.(sql, args)) throw new Error('injected D1 failure');
      const r = sqlite.prepare(sql).run(...(args as never[]));
      return { success: true, meta: { changes: Number(r.changes) } };
    },
    all: async () => {
      if (fail?.(sql, args)) throw new Error('injected D1 failure');
      return { results: sqlite.prepare(sql).all(...(args as never[])) };
    },
    first: async () => {
      if (fail?.(sql, args)) throw new Error('injected D1 failure');
      return sqlite.prepare(sql).get(...(args as never[])) ?? null;
    },
  });
  return {
    prepare: (sql: string) => prep(sql),
    batch: async (stmts: { sql: string; args: unknown[] }[]) =>
      stmts.map((s) => {
        if (/^\s*select/i.test(s.sql)) {
          if (fail?.(s.sql, s.args)) throw new Error('injected D1 failure');
          return { results: sqlite.prepare(s.sql).all(...(s.args as never[])) };
        }
        if (fail?.(s.sql, s.args)) throw new Error('injected D1 failure');
        sqlite.prepare(s.sql).run(...(s.args as never[]));
        return { success: true, meta: { changes: 1 } };
      }),
    exec: async () => undefined,
  } as unknown as D1Database;
}

const DAY = '2026-11-19';
const env = (db: D1Database) => ({ DB: db, BUILD_ID: 'test' });

async function seedHead(db: D1Database) {
  const ev = await ledgerAppend(db, 'test', 'seed', { n: 1 });
  return { seq: ev.seq, hash: ev.hash };
}

async function putRaw(db: D1Database, kind: string, id: string, obj: unknown) {
  await db.prepare(
    'INSERT INTO entities(kind,id,json,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json',
  ).bind(kind, id, JSON.stringify(obj), new Date().toISOString()).run();
}

async function getRaw(db: D1Database, kind: string, id: string) {
  const r = await db.prepare('SELECT json FROM entities WHERE kind=? AND id=?')
    .bind(kind, id).first<{ json: string }>();
  return r ? JSON.parse(r.json) : null;
}

async function latestSnap(db: D1Database, head: { seq: number; hash: string }) {
  return {
    day: DAY, generatedAt: `${DAY}T01:00:00.000Z`,
    cut: { seq: head.seq, ledger_head: head.hash },
    counts: {}, records: 0,
    file_sha256: 'f'.repeat(64), body: '{}\n',
  };
}

describe('dated-snapshot recovery (CoWizardex 8247-01)', () => {
  it('heals a missing dated snapshot with no marker', async () => {
    const db = makeDb();
    const head = await seedHead(db);
    await putRaw(db, 'ops-export', 'latest', await latestSnap(db, head));
    await refreshOpsExport(env(db));
    expect(await getRaw(db, 'ops-export', `day-${DAY}`)).not.toBeNull();
    const evs = await db.prepare(
      "SELECT kind FROM ledger WHERE kind='ops-export.snapshot_recovered'").all();
    expect(evs.results).toHaveLength(1);
  });

  it('marker + failed failure-event no longer suppresses the retry', async () => {
    // The reproduced bug state: dated write failed, marker write
    // succeeded, snapshot_failed event write failed (head unchanged).
    // Marker carries the same file_sha256 — old code returned false
    // here forever; the fix retries the data write (backoff elapsed).
    const db = makeDb();
    const head = await seedHead(db);
    const snap = await latestSnap(db, head);
    await putRaw(db, 'ops-export', 'latest', snap);
    await putRaw(db, 'ops-export', `dayfailed-${DAY}`, {
      day: DAY, file_sha256: snap.file_sha256,
      error: 'boom', at: '2026-11-19T00:00:00.000Z',
      nextAttemptAt: '2026-11-19T00:05:00.000Z', // in the past
    });
    await refreshOpsExport(env(db));
    expect(await getRaw(db, 'ops-export', `day-${DAY}`)).not.toBeNull();
    expect(await getRaw(db, 'ops-export', `dayfailed-${DAY}`)).toBeNull();
    const evs = await db.prepare(
      "SELECT kind FROM ledger WHERE kind='ops-export.snapshot_recovered'").all();
    expect(evs.results).toHaveLength(1);
  });

  it('backoff defers the retry while nextAttemptAt is in the future', async () => {
    const db = makeDb();
    const head = await seedHead(db);
    const snap = await latestSnap(db, head);
    await putRaw(db, 'ops-export', 'latest', snap);
    await putRaw(db, 'ops-export', `dayfailed-${DAY}`, {
      day: DAY, file_sha256: snap.file_sha256,
      error: 'boom', at: new Date().toISOString(),
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await refreshOpsExport(env(db));
    expect(await getRaw(db, 'ops-export', `day-${DAY}`)).toBeNull();
    // After the window the retry lands.
    await db.prepare('UPDATE entities SET json=? WHERE kind=? AND id=?')
      .bind(JSON.stringify({
        day: DAY, file_sha256: snap.file_sha256,
        error: 'boom', at: new Date().toISOString(),
        nextAttemptAt: new Date(Date.now() - 1_000).toISOString(),
      }), 'ops-export', `dayfailed-${DAY}`).run();
    await refreshOpsExport(env(db));
    expect(await getRaw(db, 'ops-export', `day-${DAY}`)).not.toBeNull();
  });

  it('a new snapshot for the same day retries immediately (no backoff)', async () => {
    const db = makeDb();
    const head = await seedHead(db);
    const snap = await latestSnap(db, head);
    await putRaw(db, 'ops-export', 'latest', snap);
    await putRaw(db, 'ops-export', `dayfailed-${DAY}`, {
      day: DAY, file_sha256: 'e'.repeat(64), // different bytes
      error: 'boom', at: new Date().toISOString(),
      nextAttemptAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await refreshOpsExport(env(db));
    expect(await getRaw(db, 'ops-export', `day-${DAY}`)).not.toBeNull();
  });
});

describe('ledgerVerifyPrefix (CoWizardex 8247-02)', () => {
  it('recomputes the chain through a cut; stored head alone does not verify', async () => {
    const db = makeDb();
    await ledgerAppend(db, 'a', 'k1', { x: 1 });
    await ledgerAppend(db, 'b', 'k2', { x: 2 });
    await ledgerAppend(db, 'c', 'k3', { x: 3 });
    // seq is 0-based — three appends land at seqs 0,1,2.
    const ok = await ledgerVerifyPrefix(db, 2);
    expect(ok.ok).toBe(true);
    expect(ok.verified).toBe(3);

    // Corrupt a payload in place — stored hash stays, chain breaks.
    await db.prepare('UPDATE ledger SET payload=? WHERE seq=1')
      .bind(JSON.stringify({ x: 999 })).run();
    const stored = await ledgerHeadAt(db, 2);
    expect(stored?.hash).toBeTruthy();           // lookup still "works"
    const bad = await ledgerVerifyPrefix(db, 2);
    expect(bad.ok).toBe(false);
    expect(bad.brokenAt).toBe(1);
    const badPrefix = await ledgerVerifyPrefix(db, 0);
    expect(badPrefix.ok).toBe(true);              // prefix before corruption clean
  });
});
