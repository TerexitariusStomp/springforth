// Shared fetch + error plumbing for the live adapters. Each keeps a
// module-level lastError for sync-route diagnostics — makeErr carries the
// contract without the boilerplate.
export const UA = 'springforth-adapter/1.0 (+https://springforth.earth)';

export const makeErr = () => {
  let e = '';
  return { set: (m: string) => { e = m; }, get: () => e };
};
export type Err = ReturnType<typeof makeErr>;
type Init = { method?: string; headers?: Record<string, string>; body?: string };

// fetch with UA + error capture; null on transport/HTTP failure.
export async function fetchOk(
  f: typeof fetch, url: string, err: Err, init: Init = {},
): Promise<Response | null> {
  const res = await f(url, {
    ...init, headers: { 'user-agent': UA, ...init.headers },
  }).catch((e) => { err.set(`fetch: ${e}`); return null; });
  if (!res) return null;
  if (!res.ok) { err.set(`http ${res.status}`); return null; }
  return res;
}

// fetch → JSON; null on any failure (reason in err). Clears err on success.
export async function getJson(
  f: typeof fetch, url: string, err: Err, init?: Init,
): Promise<unknown | null> {
  const res = await fetchOk(f, url, err, init);
  if (!res) return null;
  const body = await res.json().catch((e) => { err.set(`json: ${e}`); return null; });
  if (body == null) return null;
  err.set('');
  return body;
}

// GraphQL POST → data; `gql: <msg>` on GraphQL-level errors. partial: still
// return data on errors (OpenCollective tolerates field-level failures).
export async function postGql(
  f: typeof fetch, url: string, query: string, err: Err,
  opts: { headers?: Record<string, string>; partial?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const body = await getJson(f, url, err, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...opts.headers },
    body: JSON.stringify({ query }),
  }) as { data?: Record<string, unknown>; errors?: { message?: string }[] } | null;
  if (!body) return null;
  if (body.errors?.length) {
    err.set(`gql: ${body.errors[0]!.message}`);
    if (!opts.partial) return null;
  }
  return body.data ?? null;
}
