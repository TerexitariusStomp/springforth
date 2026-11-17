# Vendored CLC client code

Source: https://github.com/cosmo-local-credit/clc-app.git
commit: `d6c9464b2a16e4e3089c969294526b5e60bc1db0`
Vendored: 2026-11-17T05:02:29.367Z
License: AGPL-3.0 (see LICENSE in this directory — Springforth is AGPL-3.0-only, compatible)

Transitive-closure subset of `packages/api/src` + `packages/core/src` needed by
`src/adapters/clc.ts`. `*.test.ts` excluded; `queries` modules (TanStack-coupled)
are outside the closure. Vendored files import `zod4` (npm:zod@4 alias) so they
coexist with the repo's zod v3. Regenerate: `node scripts/vendor-clc.mjs <ref>`.
Entries: 13; files: 43; externals: viem, zod
