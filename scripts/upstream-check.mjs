#!/usr/bin/env node
// Upstream drift report — reads upstream.json, resolves each artifact's
// latest upstream ref (npm registry or GitHub releases), prints a drift table.
// Read-only. `--probe` additionally pings each adapter's live upstream endpoint.
import { readFileSync } from 'node:fs';

const { artifacts } = JSON.parse(readFileSync('upstream.json', 'utf8'));
const probe = process.argv.includes('--probe');
const gh = (p) => `https://api.github.com/repos/${p}/releases/latest`;

async function latestFor(a) {
  try {
    if (a.kind === 'npm') {
      const r = await fetch(`https://registry.npmjs.org/${a.package}/latest`);
      return r.ok ? (await r.json()).version : `http ${r.status}`;
    }
    if (a.upstream?.includes('/')) {
      const r = await fetch(gh(a.upstream), { headers: { 'user-agent': 'springforth-upstream-check' } });
      if (r.ok) return (await r.json()).tag_name;
      // no releases — try tags
      const t = await fetch(`https://api.github.com/repos/${a.upstream}/tags?per_page=1`, { headers: { 'user-agent': 'springforth-upstream-check' } });
      return t.ok ? (await t.json())[0]?.name ?? 'no-tags' : `http ${t.status}`;
    }
  } catch (e) { return `error: ${e.message}`; }
  return 'manual';
}

console.log('artifact               current                latest                 status');
for (const a of artifacts) {
  const latest = await latestFor(a);
  const drift = latest !== 'manual' && !String(latest).startsWith('error') && !String(latest).startsWith('http')
    && !String(a.current).includes(String(latest).replace(/^v/, '')) ? 'DRIFT' : 'ok';
  console.log(`${a.name.padEnd(22)} ${String(a.current).padEnd(22)} ${String(latest).padEnd(22)} ${drift}`);
}

if (probe) {
  const probes = JSON.parse(readFileSync(new URL('./upstream-probes.json', import.meta.url)));
  console.log('\nadapter probes:');
  for (const [name, url] of Object.entries(probes)) {
    try {
      const t0 = Date.now();
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      console.log(`  ${name.padEnd(14)} ${r.status < 500 ? 'ok' : 'FAIL'} ${r.status} ${Date.now() - t0}ms`);
    } catch (e) { console.log(`  ${name.padEnd(14)} FAIL ${e.message}`); }
  }
}
