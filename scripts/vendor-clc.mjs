#!/usr/bin/env node
// Vendor the subset of clc-app's @clc/api + @clc/core packages that
// src/adapters/clc.ts actually imports — transitive closure only, so the
// vendored tree stays typecheckable without pulling TanStack/React.
// Usage: node scripts/vendor-clc.mjs [git-ref]   (default: pinned in VENDOR.md)
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { tmpdir } from 'os';

const REPO = 'https://github.com/cosmo-local-credit/clc-app.git';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DEST = join(ROOT, 'vendor/clc');
const ENTRIES = [
  'api/client/http-client.ts', 'api/client/errors.ts',
  'api/features/pools/client.ts', 'api/features/pools/deploy-client.ts',
  'api/features/vouchers/client.ts', 'api/features/vouchers/deploy-client.ts',
  'api/features/accounts/client.ts', 'api/features/offerings/client.ts',
  'api/features/marketplace/client.ts', 'api/features/market-map/client.ts',
  'api/features/wants/client.ts', 'api/features/oracle-feeds/client.ts',
  'api/features/deployments/client.ts',
].map((p) => `packages/${p.replace(/^api\//, 'api/src/')}`);

const manifestPath = join(DEST, 'VENDOR.md');
const pinned = existsSync(manifestPath)
  ? readFileSync(manifestPath, 'utf8').match(/commit: `([0-9a-f]+)`/)?.[1]
  : undefined;
const ref = process.argv[2] ?? pinned ?? 'd6c9464b2a16e4e3089c969294526b5e60bc1db0';

const tmp = join(tmpdir(), `clc-vendor-${Date.now()}`);
execSync(`git clone --quiet --depth 1 ${REPO} ${tmp}`);
try { execSync(`git -C ${tmp} fetch --quiet --depth 1 origin ${ref}`); } catch {}
execSync(`git -C ${tmp} checkout --quiet ${ref}`);
const commit = execSync(`git -C ${tmp} rev-parse HEAD`).toString().trim();

// transitive closure over import specifiers
const exts = ['.ts', '/index.ts'];
const tryFile = (p) => ['', ...exts].map((e) => p + e).find((f) => existsSync(f) && !f.endsWith('.test.ts'));
const resSpec = (spec, from) => {
  let base = null;
  if (spec.startsWith('@clc/core')) base = spec.replace('@clc/core', join(tmp, 'packages/core/src'));
  else if (spec.startsWith('@clc/api')) base = spec.replace('@clc/api', join(tmp, 'packages/api/src'));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return { external: spec.split('/')[0].startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0] };
  const f = tryFile(base);
  return f ? { file: f } : { unresolved: spec };
};
const seen = new Set(); const external = new Set(); const unresolved = [];
const queue = entries0();
function entries0() { return ENTRIES.map((e) => join(tmp, e)); }
while (queue.length) {
  const f = queue.pop();
  if (seen.has(f) || !existsSync(f)) continue;
  seen.add(f);
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
    const r = resSpec(m[1], f);
    if (r.external) external.add(r.external);
    else if (r.unresolved) unresolved.push(`${m[1]} in ${relative(tmp, f)}`);
    else queue.push(r.file);
  }
}
if (unresolved.length) { console.error('UNRESOLVED:\n' + unresolved.join('\n')); process.exit(1); }

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const f of seen) {
  const rel = relative(join(tmp, 'packages'), f).replace(/^api\/src\//, 'api/').replace(/^core\/src\//, 'core/');
  const out = join(DEST, rel);
  mkdirSync(dirname(out), { recursive: true });
  // zod v4 alongside springforth's zod v3: vendored code imports 'zod4' (npm:zod@4)
  cpSync(f, out);
  writeFileSync(out, readFileSync(out, 'utf8').replace(/(from\s+['"])zod(['"])/g, '$1zod4$2'));
}
cpSync(join(tmp, 'LICENSE'), join(DEST, 'LICENSE'));
writeFileSync(manifestPath, `# Vendored CLC client code

Source: ${REPO}
commit: \`${commit}\`
Vendored: ${new Date().toISOString()}
License: AGPL-3.0 (see LICENSE in this directory — Springforth is AGPL-3.0-only, compatible)

Transitive-closure subset of \`packages/api/src\` + \`packages/core/src\` needed by
\`src/adapters/clc.ts\`. \`*.test.ts\` excluded; \`queries\` modules (TanStack-coupled)
are outside the closure. Vendored files import \`zod4\` (npm:zod@4 alias) so they
coexist with the repo's zod v3. Regenerate: \`node scripts/vendor-clc.mjs <ref>\`.
Entries: ${ENTRIES.length}; files: ${seen.size}; externals: ${[...external].sort().join(', ')}
`);
console.log(`vendored ${seen.size} files from ${commit.slice(0, 12)}; externals: ${[...external].sort().join(', ')}`);
rmSync(tmp, { recursive: true, force: true });
