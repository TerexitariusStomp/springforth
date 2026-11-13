# Ops export — charter §5 interface

Read-only, materialized NDJSON snapshot of the round for the ops leg.
Verify the file, don't trust the feed.

## Routes

| Route | What |
|---|---|
| `GET /export/ops.ndjson` | latest snapshot (`application/x-ndjson`) |
| `GET /export/ops` | JSON index: spec, latest cut, dated files |
| `GET /export/ops/<YYYY-MM-DD>.ndjson` | last build of that UTC day |
| `POST /export/ops/rebuild` | admin: force rebuild (pre-D0 sample run) |

Freshness: the snapshot rebuilds only when the ledger head moves —
hourly cron plus a staleness check on each `ops.ndjson` request, so a
polled file is at most one event old. Dated files are the last build
of their UTC day.

## File format

UTF-8 NDJSON, LF line endings, one record per line. The **manifest is
always the last line** and carries:

```json
{
  "type": "manifest",
  "spec": "springforth.ops-export/v1",
  "generatedAt": "…",
  "cut": { "seq": 4217, "ledger_head": "f83b…" },
  "counts": { "declaration": 12, "commitment": 31, "…": 0 },
  "records": 58,
  "file_sha256": "…",
  "recompute": "sed '$d' ops.ndjson | sha256sum"
}
```

- `cut.ledger_head` — hash of the last ledger event at export cut.
  Byte-identical to `/ledger/verify`'s `head` at the same tip.
- `file_sha256` — SHA-256 over the bytes of every line *before* the
  manifest line (each LF included). Recompute:
  `sed '$d' ops.ndjson | sha256sum`

Two different checks: `file_sha256` proves the file arrived intact;
`ledger_head` says which public chain tip the file claims to describe.

## Record types

| `type` | Fields | Source |
|---|---|---|
| `declaration` | possibilityId, actor, at, status, threshold{min,max}, needs[{id,required,category}], brings[nodeIds], deadline, place, h3 | `possibility` + linked `plannode`s |
| `commitment` | id, possibilityId, actor, at, bringingNodeId, hours | `participation` |
| `quorum` | possibilityId, activated_at, committed[actor…] | quorumAt + joins ≤ activation |
| `evidence` | id, via (oracle-check / forum-post / report / claim-artifact), nodeId/possibilityId/claimId, uriHash/textHash/refHash, at | checks (demo excluded), forum evidence posts, report.evidence, claim artifactRefs |
| `attestation_edge` | via (appreciation / attestation), id, from, to, possibilityId, at | `appreciation`, `attestation` — deduped to one edge per pair (earliest) |
| `match_flow` | lane (matching_fund / pledge / donation / stream / yield / revshare), id, roundId/possibilityId/needNodeId, actor, amount, currency, state, at | `round`, `pledge`, `donation`, `recurring-support`, `yieldstream`, derived |
| `trust_epoch` | epoch, program, cut{seq,ledger_head}, inputHash, paramsHash, outputRoot, totalValue, scoresHash, edgeCount, actorCount, at | `trust-epoch` journals — pointers, not score blobs |
| `external_trust` | id, network, root, account, actor, value, totalValue, at | `external-score` — leaves verified against a trustgraphs network's accepted root. `account` stays raw (it's the public leaf key); `actor` pseudonymizes |

`matching_fund` records carry `skimBps`/`upstreamSplitBps` — the round's
frozen revenue params (love.fund criterion #20 / #6). `revshare` records
are derived, emitted only when accrued skim on *settled* donations is
nonzero (same math as `endowmentAccrual`: amount × bps / 10000).

Actors are pseudonymized: `a_<16-hex>` = sha256(salt, actor) — stable
across daily files so records join over time. Pseudonymous, not
anonymous; salt rotates via `EXPORT_SALT`.

Evidence is pointers, never footage: URIs hash to `uriHash`, free text
to `textHash`/`refHash`.

## Known limits

- Snapshot body is stored as a D1 entity JSON row — fine at pilot scale;
  past ~1MB of export the lane should move to R2.
- `attestation` edges carry the raw `to` target (claim/node id), not a
  pseudonym — targets are entities, not people.
- A disputed attestation is a flag *event*, not an edit — nothing in
  this export is ever rewritten; corrections append.

## v1.1 (2026-11-08)

- Record `id` and id-shaped join fields (`needs[]`, `brings[]`,
  `bringingNodeId`, `nodeId`, `needNodeId`, `claimId`, attestation `to`)
  ship as opaque `x_<hash>` values: `x_` + `sha256("${salt}:id:${raw}")[:16]`.
  Same input → same output, so joins hold. `a_` and `x_` share the salt.
- New `claim` record type: every claim an edge can target gets a row,
  evidence or none. Fields: `claimId`, `possibilityId`, `state`,
  `contributors[]` (pseudonymized), `nodeIds[]`, `checks`,
  `appreciations`, `artifacts`, `scopeHash`, `at`.
- Salt: `env.EXPORT_SALT` if set, else a random UUID minted once and
  persisted server-side. The spec-string fallback is deprecated —
  `a_`/`x_` values rotated once at this schema's first cut.
- Rebuild gate compares `cut.seq` AND `cut.ledger_head`, not seq alone.
- A failed dated write appends an `ops-export.snapshot_failed` ledger
  event; a failed cron refresh appends `ops-export.refresh_failed`.
- `/ledger/verify?seq=N` returns `{ ok, seq, head }` at exactly that cut
  (404 beyond the head). Same-cut replay: dated file + `?seq=` +
  `sed '$d' file.ndjson | sha256sum`.

## v1.2

- New `trust_epoch` record type: one row per accepted trust epoch,
  carrying the journal fields — `epoch`, `program`, `cut{seq,ledger_head}`,
  `inputHash`, `paramsHash`, `outputRoot`, `totalValue`, `scoresHash`,
  `edgeCount`, `actorCount`, `at`. These are *pointers, not score blobs*:
  a reviewer fetches `/trust/epochs/:n/inputs.json` and `/scores.json`
  against the same cut, recomputes, and compares root/hashes — recipe
  in `docs/TRUSTGRAPH.md`. `cut.ledger_head` replays against
  `/ledger/verify?seq=` exactly like the manifest's own head.
- `matching_fund` / retro records pin `trustEpoch` at open; the epoch
  rows let a reviewer reproduce the trust inputs an allocation or
  cohort decision was computed over.
- New `external_trust` record type (emitted only when rows exist):
  per-actor entries verified against an external trustgraphs network's
  accepted Merkle root — `network`, `root`, `account` (raw public leaf
  key), `actor` (pseudonymized), `value`, `totalValue`, `at`.
