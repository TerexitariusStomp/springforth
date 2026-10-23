#!/usr/bin/env node
// upstream-sync <name> — re-vendor an artifact per upstream.json.
// For kind:npm entries, fetches <package>@latest tarball, extracts <file>,
// rewrites the matching export in src/vendor.ts, and bumps `current` in
// upstream.json. Run tests after syncing.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const name = process.argv[2];
const up = JSON.parse(readFileSync('upstream.json', 'utf8'));
const a = up.artifacts.find((x) => x.name === name);
if (!a) { console.error(`unknown artifact: ${name}`); process.exit(1); }
if (a.kind !== 'npm') { console.error(`${name} is kind:${a.kind} — ${a.sync}`); process.exit(1); }

const [constName, path] = a.path.split('#');
const meta = await (await fetch(`https://registry.npmjs.org/${a.package}/latest`)).json();
console.log(`${name}: ${a.current} -> ${meta.version}`);
execSync(`npm pack ${a.package}@${meta.version} --pack-destination /tmp`, { stdio: 'inherit' });
const tgz = `/tmp/${a.package.replace('@', '').replace('/', '-')}-${meta.version}.tgz`;
execSync(`mkdir -p /tmp/upstream-${name} && tar -xzf ${tgz} -C /tmp/upstream-${name}`);
const content = readFileSync(`/tmp/upstream-${name}/package/${a.file}`, 'utf8');

let vts = readFileSync(path, 'utf8');
const re = new RegExp(`export const ${constName} = "(?:[^"\\\\]|\\\\.)*";`);
if (!re.test(vts)) { console.error(`export ${constName} not found in ${path}`); process.exit(1); }
vts = vts.replace(re, `export const ${constName} = ${JSON.stringify(content)};`);
writeFileSync(path, vts);

a.current = meta.version;
writeFileSync('upstream.json', JSON.stringify(up, null, 2) + '\n');
console.log(`synced ${name} ${meta.version} into ${path}`);
