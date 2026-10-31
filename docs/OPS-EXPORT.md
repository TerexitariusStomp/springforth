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
| `match_flow` | lane (matching_fund / pledge / donation / stream / yield), id, roundId/possibilityId/needNodeId, actor, amount, currency, state, at | `round`, `pledge`, `donation`, `recurring-support`, `yieldstream` |

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
