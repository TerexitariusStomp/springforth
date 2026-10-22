#!/usr/bin/env node
// Springforth design gate — runs the vendored StyleSeed deterministic checker
// across every registered artifact. Fails nonzero if any finding appears.
// Token/theme files (theme.ts, registry token files) are exempt per SS rules.

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const artifactsDir = resolve(root, ".styleseed/artifacts");
const checker = resolve(root, ".devin/skills/ss-score/scripts/styleseed-check.mjs");

if (!existsSync(checker)) {
  console.error("styleseed-check.mjs not found — skills not vendored at .devin/skills/ss-score/");
  process.exit(2);
}

const artifacts = readdirSync(artifactsDir)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => f.replace(/\.json$/, ""));

let failed = 0;
for (const artifact of artifacts) {
  let out;
  try {
    out = execFileSync(process.execPath, [checker, "scan", "--project-root", root, "--artifact", artifact, "--format", "json"], { encoding: "utf8" });
  } catch (e) {
    console.error(`✗ ${artifact}: checker error\n${e.stdout ?? ""}${e.stderr ?? ""}`);
    failed += 1;
    continue;
  }
  const findings = JSON.parse(out).findings ?? [];
  if (findings.length === 0) {
    console.log(`✓ ${artifact}: clean`);
  } else {
    failed += findings.length;
    for (const f of findings) console.log(`✗ ${artifact}: ${f.rule} ${f.file ?? ""}:${f.line ?? ""} ${f.message ?? ""}`);
  }
}

process.exit(failed ? 1 : 0);
