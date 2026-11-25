#!/usr/bin/env node
// One-command export verifier — the artifact no competitor ships.
// Given a dated or live ops export, proves end-to-end:
//   1. file_sha256 — the manifest's hash covers every line before it
//   2. ledger_head — /ledger/verify?seq=N&verify=1 replays the chain
//      through exactly this cut
//   3. signature — the manifest's Ed25519 JWS verifies against the
//      service's published key (a SCITT 'signed statement' — proves
//      the operator issued THIS cut, not just that bytes are consistent)
//   4. anchors — OTS anchor records carry receipt structure (subject,
//      calendar, status)
// Usage:
//   node scripts/verify-export.mjs [file.ndjson] [--base <url>]
//   node scripts/verify-export.mjs --day 2026-11-24 [--base <url>]
// Exit 0 = all checks pass; non-zero prints the failing check.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { jwtVerify, importJWK } from 'jose';

const BASE_DEFAULT = 'https://springforth.widespread.workers.dev';
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const base = flag('--base') ?? BASE_DEFAULT;
const day = flag('--day');
const fileArg = args.find((a) => !a.startsWith('--') && a !== flag('--base') && a !== flag('--day'));

let body;
if (fileArg) {
  body = readFileSync(fileArg, 'utf8');
} else if (day) {
  const r = await fetch(`${base}/export/ops.ndjson?day=${day}`);
  if (!r.ok) fail(`fetch day ${day}: HTTP ${r.status}`);
  body = await r.text();
} else {
  const r = await fetch(`${base}/export/ops.ndjson`);
  if (!r.ok) fail(`fetch export: HTTP ${r.status}`);
  body = await r.text();
}

const lines = body.trimEnd().split('\n');
if (lines.length < 2) fail('export has no manifest line');
const manifest = JSON.parse(lines[lines.length - 1]);
if (manifest.type !== 'manifest') fail('last line is not a manifest');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// 1. file_sha256 covers every pre-manifest line, byte-exact.
const payload = lines.slice(0, -1).join('\n') + '\n';
const recomputed = createHash('sha256').update(payload, 'utf8').digest('hex');
check('file_sha256', recomputed === manifest.file_sha256,
  `recomputed ${recomputed.slice(0, 16)}… vs manifest ${String(manifest.file_sha256).slice(0, 16)}…`);

// 2. ledger head at the manifest cut — prefix-verified server-side.
const seq = manifest.cut?.seq;
if (typeof seq !== 'number') fail('manifest has no cut.seq');
const v = await fetch(`${base}/ledger/verify?seq=${seq}&verify=1`);
if (!v.ok) check('ledger_head', false, `verify HTTP ${v.status}`);
else {
  const j = await v.json();
  check('ledger_head', j.ok === true && j.head === manifest.cut.ledger_head
    && j.verifiedThrough === seq,
    `cut seq ${seq}, verifiedThrough=${j.verifiedThrough}`);
}

// 3. manifest signature vs the published JWK set.
if (manifest.signature == null) {
  check('signature', false, 'manifest unsigned (signature:null — signing not configured on this build)');
} else {
  const kr = await fetch(`${base}/.well-known/springforth-keys.json`);
  const jwks = kr.ok ? await kr.json() : { keys: [] };
  const jwk = (jwks.keys ?? []).find((k) => k.kid === manifest.keyId) ?? jwks.keys?.[0];
  if (!jwk) check('signature', false, 'no matching key published');
  else {
    try {
      const key = await importJWK(jwk, 'EdDSA');
      const { payload: claims } = await jwtVerify(manifest.signature, key);
      const expected = `${manifest.file_sha256}:${manifest.cut.ledger_head}:${manifest.cut.seq}`;
      check('signature', claims.signingInput === expected,
        `kid ${manifest.keyId}`);
    } catch (e) {
      check('signature', false, `verify failed: ${e.message}`);
    }
  }
}

// 4. anchor records carry OTS receipt structure.
const anchors = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((r) => r?.type === 'anchor');
const wellFormed = anchors.filter((a) =>
  a.calendar && a.status && typeof a.receiptBytes === 'number' && a.receiptBytes > 0);
check('anchors', anchors.length > 0 && wellFormed.length === anchors.length,
  `${wellFormed.length}/${anchors.length} well-formed`);

// 5. funnel sanity — counts reconcile to record lines.
const counts = manifest.counts ?? {};
const actual = {};
for (const l of lines.slice(0, -1)) {
  const t = JSON.parse(l).type;
  actual[t] = (actual[t] ?? 0) + 1;
}
const mismatched = Object.keys(counts).filter((k) => counts[k] !== actual[k]);
check('counts', mismatched.length === 0,
  mismatched.length ? `mismatch: ${mismatched.join(', ')}` : `${actual.manifest ?? lines.length - 1} records reconciled`);

const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0
  ? `\nVERIFIED — ${lines.length - 1} records, cut seq ${seq}, ${manifest.revision ?? '?'}`
  : `\nFAILED — ${failed.length} check(s)`);
process.exit(failed.length === 0 ? 0 : 1);

function fail(msg) { console.error(`FAIL  ${msg}`); process.exit(1); }
