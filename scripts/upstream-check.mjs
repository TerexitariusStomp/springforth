#!/usr/bin/env node
// Upstream drift report — reads upstream.json, compares pinned revs vs latest.
//   node scripts/upstream-check.mjs          → vendored-artifact drift table
//   node scripts/upstream-check.mjs --probe  → + live adapter endpoint health
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../upstream.json', import.meta.url)));

const npmLatest = async (pkg) => {
  const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, { signal: AbortSignal.timeout(8000) });
  return r.ok ? (await r.json()).version : `HTTP ${r.status}`;
};

console.log('artifact'.padEnd(16), 'current'.padEnd(38), 'latest'.padEnd(12), 'status');
for (const a of manifest.artifacts) {
  const latest = a.pkg ? await npmLatest(a.pkg).catch((e) => `ERR ${e.cause?.code ?? e.message}`) : '—';
  const status = a.pkg && a.current !== latest ? 'DRIFT' : 'ok';
  console.log(a.name.padEnd(16), String(a.current).padEnd(38), String(latest).padEnd(12), status,
    status === 'DRIFT' ? `→ node scripts/upstream-sync.mjs ${a.name}` : `(${a.sync})`);
}
console.log('\nnpm deps: `pnpm outdated` — the single package.json is the whole dependency surface.');

if (process.argv.includes('--probe')) {
  console.log('\nendpoint probes (adapter upstreams — flags API drift / outages):');
  for (const p of manifest.probes) {
    try {
      const t = Date.now();
      const r = await fetch(p.url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000) });
      console.log(' ', p.name.padEnd(15), r.status, `${Date.now() - t}ms`);
    } catch (e) {
      console.log(' ', p.name.padEnd(15), 'DOWN', e.cause?.code ?? e.message);
    }
  }
}
