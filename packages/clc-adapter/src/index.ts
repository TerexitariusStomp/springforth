import { CapitalForm, ExternalPlan, PlanNode, canonicalize } from '@springforth/coordination';
import { latLngToCell } from 'h3-js';
import { z } from 'zod';

// Cosmo-Local Credit / Sarafu adapter — normalises CLC commitments into the
// plan graph so needs×offers matching can run over them (see
// detectComplements in @springforth/coordination). Three intake lanes:
//   1. fetchSarafu(base)  — live public tRPC on the Sarafu app
//   2. fromJson(data)     — fixture lane: {vouchers:[], pools:[]}
//   3. fetchChain(rpc, calls) — env-gated generic eth_call reader (stretch)
// Vouchers become 'offer' nodes; commitment pools become 'framework' nodes
// (the curation boundary — who stewards it, what rules apply, which
// vouchers it lists). Needs are not Sarafu data — they arrive via plan
// adapters or are inferred from action-verbs by the resolver.
//
// Terms of use: a voucher is a *published commitment*, not proof of
// delivery. `terms` carries the issuer's stated conditions; `capacity` is
// only set when the source declares it. Field names verified against
// https://sarafu.network/api/trpc/{voucher,pool}.list (Oct 19).

const Geo = z.object({ x: z.number(), y: z.number() }).nullable().optional();

export const SarafuVoucher = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  voucher_address: z.string().optional(),
  voucher_name: z.string().min(1),
  voucher_description: z.string().nullable().optional(),
  geo: Geo,                                    // x = latitude, y = longitude
  location_name: z.string().nullable().optional(),
  voucher_type: z.string().optional(),         // 'GIFTABLE', …
  voucher_uoa: z.string().optional(),          // unit of account, e.g. 'KES'
  symbol: z.string().optional(),
  voucher_value: z.union([z.string(), z.number()]).optional(),
  sink_address: z.string().nullable().optional(),
  redemption_address: z.string().nullable().optional(),
  transaction_count: z.union([z.string(), z.number()]).transform(Number).optional(),
  created_at: z.string().optional(),
  capacity: z.string().optional(),             // non-standard; honoured if present
  capital: CapitalForm.optional(),             // explicit form override for fixtures
}).passthrough();
export type SarafuVoucher = z.infer<typeof SarafuVoucher>;

export const SarafuPool = z.object({
  contract_address: z.string().optional(),
  pool_name: z.string().min(1),
  pool_symbol: z.string().optional(),
  description: z.string().nullable().optional(),
  geo: Geo,
  tags: z.array(z.string()).default([]),
  swap_count: z.union([z.string(), z.number()]).transform(Number).optional(),
  voucher_count: z.union([z.string(), z.number()]).transform(Number).optional(),
}).passthrough();
export type SarafuPool = z.infer<typeof SarafuPool>;

const H3_RES = 5;                               // ~250 km² cells — neighbourhood scale
const h3For = (geo: { x: number; y: number } | null | undefined) =>
  geo && Math.abs(geo.x) <= 90 && Math.abs(geo.y) <= 180
    ? latLngToCell(geo.x, geo.y, H3_RES)
    : undefined;

export function normalizeVoucher(v: unknown, source = 'sarafu'): PlanNode {
  const s = SarafuVoucher.parse(v);
  const desc = s.voucher_description ?? '';
  return PlanNode.parse({
    id: `${source}-offer-${s.symbol ?? s.id}`,
    kind: 'offer',
    label: s.voucher_name,
    canonical: canonicalize(`${s.voucher_name} ${desc}`),
    source,
    placeId: s.location_name ? canonicalize(s.location_name) : undefined,
    h3: h3For(s.geo),
    orgIds: s.voucher_address ? [`${source}-issuer-${s.voucher_address}`] : [],
    tags: ['voucher', ...(s.voucher_uoa ? [s.voucher_uoa] : []),
      ...(s.transaction_count ? ['active'] : [])],
    timeframe: { from: s.created_at },
    description: desc,
    terms: [s.symbol, s.voucher_uoa, s.voucher_type,
      s.redemption_address ? 'redemption address set' : undefined,
    ].filter(Boolean).join(' · ') || undefined,
    capacity: s.capacity,
    capital: s.capital,                          // else inferCapital() at read
  });
}

// A commitment pool is the curation/stewardship boundary — modelled as a
// framework node so offers can be grouped and matched within it.
export function normalizeClcPool(p: unknown, source = 'sarafu'): PlanNode {
  const s = SarafuPool.parse(p);
  return PlanNode.parse({
    id: `${source}-pool-${s.pool_symbol ?? canonicalize(s.pool_name).replace(/\s+/g, '-')}`,
    kind: 'framework',
    label: s.pool_name,
    canonical: canonicalize(`${s.pool_name} ${s.description ?? ''}`),
    source,
    h3: h3For(s.geo),                                // pools carry geo only — no place name field
    tags: ['commitment-pool', ...s.tags],
    description: s.description ?? '',
    terms: s.swap_count !== undefined
      ? `${s.voucher_count ?? '?'} vouchers · ${s.swap_count} swaps` : undefined,
  });
}

export const ClcDataset = z.object({
  vouchers: z.array(z.unknown()).default([]),
  pools: z.array(z.unknown()).default([]),
});

// Fixture / upload lane — `{vouchers:[…], pools:[…]}` → one ExternalPlan.
export function fromJson(data: unknown, source = 'sarafu'): ExternalPlan {
  const d = typeof data === 'string' ? JSON.parse(data) : data;
  const { vouchers, pools } = ClcDataset.parse(d);
  const nodes = [
    ...vouchers.map((v) => normalizeVoucher(v, source)),
    ...pools.map((p) => normalizeClcPool(p, source)),
  ];
  if (!nodes.length) throw new Error('clc dataset produced no nodes');
  return ExternalPlan.parse({
    id: source, source, title: `CLC commitments (${source})`,
    importedAt: new Date().toISOString(), nodes,
  });
}

// Live lane — the Sarafu app's public tRPC surface. `limit` bounds the
// offer set before it enters the graph (2.5k+ vouchers otherwise flood
// complement detection; the resolver also caps records per run).
export async function fetchSarafu(
  base = 'https://sarafu.network', opts: { limit?: number; source?: string } = {},
): Promise<ExternalPlan> {
  const b = base.replace(/\/$/, '');
  const source = opts.source ?? 'sarafu';
  const trpc = async (proc: string) => {
    const res = await fetch(`${b}/api/trpc/${proc}?input=${encodeURIComponent('{"json":{}}')}`);
    if (!res.ok) throw new Error(`sarafu ${proc} ${res.status}`);
    const d = await res.json() as { result?: { data?: { json?: unknown } } };
    return d?.result?.data?.json;
  };
  const [vouchers, pools] = await Promise.all([trpc('voucher.list'), trpc('pool.list')]);
  return fromJson({
    vouchers: (vouchers as unknown[] ?? []).slice(0, opts.limit ?? 250),
    pools: pools as unknown[] ?? [],
  }, source);
}

// Stretch lane — generic Celo JSON-RPC eth_call executor. ABI encoding is
// the caller's job (we don't vendor contract ABIs for raw reads); callers
// pass {to, data} pairs and get raw hex results back. Unused unless the
// stretch contracts lane activates.
export async function fetchChain(
  rpc: string, calls: { to: string; data: string }[],
): Promise<string[]> {
  return Promise.all(calls.map(async (c, i) => {
    const res = await fetch(rpc, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: i + 1, method: 'eth_call',
        params: [{ to: c.to, data: c.data }, 'latest'],
      }),
    });
    const d = await res.json() as { result?: string; error?: { message: string } };
    if (d.error) throw new Error(`eth_call: ${d.error.message}`);
    return d.result ?? '0x';
  }));
}
