#!/usr/bin/env node
// Re-vendor an embedded upstream asset into src/vendor.ts.
//   node scripts/upstream-sync.mjs pico-css|htmx [--to <version>]
import { readFileSync, writeFileSync } from 'node:fs';
const manifestUrl = new URL('../upstream.json', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl));
const name = process.argv[2];
const a = manifest.artifacts.find((x) => x.name === name);
if (!a?.pkg || a.sync !== 'upstream-sync') {
  console.error(`not a syncable artifact: ${name ?? '(none)'}. Syncable: ${manifest.artifacts.filter((x) => x.sync === 'upstream-sync').map((x) => x.name).join(', ')}`);
  process.exit(1);
}
const toIdx = process.argv.indexOf('--to');
const version = toIdx > 0 ? process.argv[toIdx + 1] : 'latest';
const meta = await (await fetch(`https://registry.npmjs.org/${encodeURIComponent(a.pkg)}/${version}`)).json();
if (!meta.version) { console.error('version not found:', version); process.exit(1); }
const body = await (await fetch(`https://unpkg.com/${a.pkg}@${meta.version}/${a.file}`)).text();
if (body.length < 1000) { console.error(`suspicious payload (${body.length}b) — aborting`); process.exit(1); }

const [file, ident] = a.path.split('#');
const vsrc = readFileSync(file, 'utf8');
const out = vsrc.replace(new RegExp(`export const ${ident} = "(?:[^"\\\\]|\\\\.)*";`), `export const ${ident} = ${JSON.stringify(body)};`);
if (out === vsrc) { console.error('could not locate', a.path); process.exit(1); }
writeFileSync(file, out);
a.current = meta.version;
writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${name}: ${a.pkg}@${meta.version} → ${a.path} (${body.length}b). Run pnpm typecheck + pnpm test.`);
