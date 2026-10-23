#!/usr/bin/env node
// Refresh an upstream artifact. Usage: node scripts/upstream-sync.mjs <name>
// For `kind: npm` artifacts embedded in src/vendor.ts: fetch latest dist asset
// and rewrite the embedded literal + upstream.json `current`.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const mp = `${root}upstream.json`, vp = `${root}src/vendor.ts`;
const m = JSON.parse(readFileSync(mp, 'utf8'));
const [name] = process.argv.slice(2);
const a = m.artifacts.find(x => x.name === name);
if (!a) { console.error(`unknown artifact '${name}' — have: ${m.artifacts.map(x => x.name).join(', ')}`); process.exit(1); }
if (a.kind !== 'npm') { console.error(`'${name}' is ${a.kind} — sync manually: ${a.sync ?? a.note ?? 'see upstream.json'}`); process.exit(1); }

const latest = execSync(`npm view ${a.pkg} version`, { encoding: 'utf8' }).trim();
if (latest === a.current) { console.log(`${name} already at ${latest}`); process.exit(0); }
const url = `https://unpkg.com/${a.pkg}@${latest}/${a.asset}`;
console.log(`fetching ${url}`);
const body = await (await fetch(url)).text();
if (body.length < 100) { console.error('suspiciously small asset — aborting'); process.exit(1); }

const [, constName] = a.path.split(':');
const src = readFileSync(vp, 'utf8');
const re = new RegExp(`export const ${constName} = ".*";`, 's');
if (!re.test(src)) { console.error(`literal ${constName} not found in src/vendor.ts`); process.exit(1); }
writeFileSync(vp, src.replace(re, `export const ${constName} = ${JSON.stringify(body)};`));
a.current = latest;
writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
console.log(`${name}: ${a.path} ${name === 'pico-css' ? 'CSS' : 'JS'} → ${latest} (${body.length} bytes)`);
