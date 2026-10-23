#!/usr/bin/env node
// Upstream drift report. Usage: node scripts/upstream-check.mjs [--probe]
// Reads upstream.json; resolves latest version per artifact (npm registry /
// git ls-remote); --probe also pings each adapter's live upstream endpoint.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const m = JSON.parse(readFileSync(new URL('../upstream.json', import.meta.url), 'utf8'));
const probe = process.argv.includes('--probe');
const dim = s => `\x1b[2m${s}\x1b[0m`, ok = s => `\x1b[32m${s}\x1b[0m`, warn = s => `\x1b[33m${s}\x1b[0m`;

let drift = 0;
for (const a of m.artifacts) {
  let latest = null;
  try {
    if (a.kind === 'npm') latest = execSync(`npm view ${a.pkg} version`, { encoding: 'utf8' }).trim();
    else if (a.kind === 'repo') latest = execSync(`git ls-remote https://github.com/${a.repo}.git HEAD`, { encoding: 'utf8' }).split('\t')[0]?.slice(0, 12);
  } catch { latest = 'unreachable'; }
  const cur = a.current ?? a.rev?.slice(0, 19) ?? 'n/a';
  const stale = latest && latest !== 'unreachable' && a.current && latest !== a.current;
  if (stale) drift++;
  console.log(`${stale ? warn('DRIFT') : ok('ok   ')} ${a.name.padEnd(18)} ${String(cur).padEnd(20)} → ${latest ?? dim(a.kind + ' (manual)')} ${dim(a.license ?? '')}`);
  if (stale) console.log(`       ${dim('sync: ' + (a.sync ?? 'manual — ' + (a.note ?? '')))}`);
}

if (probe) {
  console.log('\n── upstream API probes');
  for (const p of m.probes ?? []) {
    try {
      const r = await fetch(p.url, {
        method: p.method ?? 'GET',
        headers: p.body ? { 'content-type': 'application/json' } : {},
        body: p.body,
        signal: AbortSignal.timeout(10000),
      });
      console.log(`${r.ok ? ok('up  ') : warn('fail')} ${p.name.padEnd(18)} ${r.status}`);
    } catch (e) { console.log(`${warn('down')} ${p.name.padEnd(18)} ${e.cause?.code ?? e.message}`); }
  }
}
process.exitCode = drift ? 1 : 0;
