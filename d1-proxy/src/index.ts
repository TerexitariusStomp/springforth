// sf-d1proxy — HTTP front for a D1 database on a different account.
// springforth's edge worker (Widespread, D1 row-quota exhausted) routes
// env.DB calls here; this worker holds the real binding on Pressword.
// Auth: bearer PROXY_KEY, constant-time compare. Endpoints:
//   POST /query  {sql, params?}            → D1 .all() result
//   POST /first  {sql, params?}            → D1 .first() result
//   POST /run    {sql, params?}            → D1 .run() result
//   POST /batch  [{sql, params?}, ...]     → D1 .batch() results (atomic)
interface Env { DB: D1Database; PROXY_KEY?: string }

const enc = new TextEncoder();
const safeEq = (a: string, b: string) => {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i]! ^ y[i]!;
  return d === 0;
};

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    if (!env.PROXY_KEY || !safeEq(tok, env.PROXY_KEY)) return json({ error: 'auth' }, 401);
    const path = new URL(req.url).pathname;
    try {
      const body = await req.json() as { sql?: string; params?: unknown[] } | { sql?: string; params?: unknown[] }[];
      const stmt = (q: { sql?: string; params?: unknown[] }) =>
        env.DB.prepare(String(q.sql)).bind(...(q.params ?? []) as never[]);
      if (path === '/batch')
        return json({ results: await env.DB.batch((body as { sql?: string; params?: unknown[] }[]).map(stmt)) });
      const q = body as { sql?: string; params?: unknown[] };
      if (path === '/first') return json({ result: await stmt(q).first() });
      if (path === '/run') return json({ result: await stmt(q).run() });
      return json(await stmt(q).all());
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
};
