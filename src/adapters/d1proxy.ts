// HTTP D1 facade — routes the D1Database surface used by this codebase
// (prepare→bind→{run,all,first,raw}, batch) through the sf-d1proxy worker
// on another account. Exists because the primary account's free-tier D1
// row quota is exhaustible; the proxy account is a fresh budget. See
// d1-proxy/ and AGENTS.md. Only plain JSON params are supported — this
// codebase binds strings/numbers/nulls only.
import type {
  D1Database, D1PreparedStatement, D1Result,
} from '@cloudflare/workers-types';

const post = async (url: string, key: string, path: string, body: unknown) => {
  const r = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(`d1proxy ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};

export function httpD1(url: string, key: string): D1Database {
  const stmt = (sql: string, params: unknown[]): D1PreparedStatement => ({
    sql, params,
    bind: (...p: unknown[]) => stmt(sql, p),
    run: async () =>
      (await post(url, key, '/run', { sql, params })).result as D1Result<unknown>,
    all: async <T = unknown>() =>
      await post(url, key, '/query', { sql, params }) as unknown as D1Result<T>,
    first: async <T = unknown>() =>
      (await post(url, key, '/first', { sql, params })).result as T | null,
    raw: async <T = unknown>() => {
      const r = await post(url, key, '/query', { sql, params }) as { results?: Record<string, unknown>[] };
      return (r.results ?? []).map((row) => Object.values(row) as T);
    },
  }) as unknown as D1PreparedStatement;
  return {
    prepare: (sql: string) => stmt(sql, []),
    batch: async <T = unknown>(stmts: D1PreparedStatement[]) => {
      const body = (stmts as unknown as { sql?: string; params?: unknown[] }[])
        .map((s) => ({ sql: s.sql, params: s.params ?? [] }));
      return (await post(url, key, '/batch', body)).results as D1Result<T>[];
    },
    exec: () => Promise.reject(new Error('d1proxy: exec unsupported')),
    dump: () => Promise.reject(new Error('d1proxy: dump unsupported')),
    withSession: () => { throw new Error('d1proxy: withSession unsupported'); },
  } as unknown as D1Database;
}
