// Boundary-hardening tests — worker.handle() against a minimal env stub.
// Every assertion short-circuits before D1 access, so no DB mock is needed.
import { describe, expect, it } from 'vitest';
import worker, { timingSafeEq } from '../src/index.ts';
import { fetchOk, makeErr } from '../src/adapters/fetch.ts';
import type { Env } from '../src/index.ts';

const env = (over: Partial<Env> = {}) => over as Env;
const post = (path: string, init: RequestInit = {}) =>
  new Request(`https://x.test${path}`, { method: 'POST', ...init });

describe('timingSafeEq', () => {
  it('accepts equal strings', () => expect(timingSafeEq('abc', 'abc')).toBe(true));
  it('rejects different strings', () => expect(timingSafeEq('abc', 'abd')).toBe(false));
  it('rejects length mismatch', () => expect(timingSafeEq('abc', 'abcd')).toBe(false));
  it('rejects empty vs set', () => expect(timingSafeEq('', 'a')).toBe(false));
});

describe('admin auth', () => {
  it('401s an unauthenticated write to an admin route', async () => {
    const res = await worker.handle(post('/evidence/anchor', {
      headers: { 'content-type': 'application/json' }, body: '{}',
    }), env({ ADMIN_TOKEN: 'secret' }));
    expect(res.status).toBe(401);
  });
  it('401s a wrong token', async () => {
    const res = await worker.handle(post('/evidence/anchor', {
      headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
      body: '{}',
    }), env({ ADMIN_TOKEN: 'secret' }));
    expect(res.status).toBe(401);
  });
});

describe('body caps', () => {
  // undici strips/doesn't set content-length on constructed Requests, so the
  // cap tests stub the request surface handle() actually reads.
  const fakeReq = (path: string, len: number, headers: Record<string, string> = {}, raw = '') =>
    ({
      method: 'POST',
      url: `https://x.test${path}`,
      headers: new Headers({ 'content-length': String(len), ...headers }),
      json: async () => JSON.parse(raw),
    }) as unknown as Request;

  it('413s an oversized unauthenticated write', async () => {
    const res = await worker.handle(fakeReq('/possibilities', 300 * 1024), env());
    expect(res.status).toBe(413);
  });
  it('lets admin-authed bodies through the tight cap', async () => {
    // 300KB exceeds the 256KB anon cap but not the 8MB admin ceiling — the
    // request should fail later (bad JSON → outer catch), not at the cap.
    const res = await worker.handle(fakeReq('/evidence/anchor', 300 * 1024,
      { authorization: 'Bearer secret' }), env({ ADMIN_TOKEN: 'secret' }));
    expect(res.status).not.toBe(413);
    expect(res.status).not.toBe(401);
  });
  it('413s even authed bodies above the hard ceiling', async () => {
    const res = await worker.handle(fakeReq('/evidence/anchor', 9 * 1024 * 1024,
      { authorization: 'Bearer secret' }), env({ ADMIN_TOKEN: 'secret' }));
    expect(res.status).toBe(413);
  });
});

describe('telegram webhook', () => {
  const tg = (headers: Record<string, string> = {}) =>
    post('/tg', { headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
  it('401s when the secret is not configured', async () => {
    const res = await worker.handle(tg(), env());
    expect(res.status).toBe(401);
  });
  it('401s on a wrong secret token', async () => {
    const res = await worker.handle(tg({ 'x-telegram-bot-api-secret-token': 'nope' }),
      env({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_WEBHOOK_SECRET: 's' }));
    expect(res.status).toBe(401);
  });
});

describe('fetchOk timeout', () => {
  it('returns null when the upstream hangs', async () => {
    const hung: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation timed out.', 'TimeoutError')));
      });
    const err = makeErr();
    const res = await fetchOk(hung, 'https://up.test/slow', err, {}, 50);
    expect(res).toBeNull();
    expect(err.get()).toContain('fetch');
  });
});
