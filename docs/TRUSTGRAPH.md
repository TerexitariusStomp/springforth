# Trust epochs — spec

Status: phase 1 — native epochs, proof-bearing reads, consumer pins.
In scope here: verify/recompute/pin. Out of scope (by design): EAS
publish (phase 2, `vouch-mirror` rows), external score intake (phase 3,
`external-score` rows + `trust.priorSource`/`priorShare` params),
on-chain verifier contracts. Nothing on these routes writes to a chain.

The trustgraphs.xyz epoch model applied natively to the mutual-recognition
graph. A checkpoint freezes the input edges and params at a ledger cut,
computes the score vector, and publishes a Merkle root anyone can
recompute. Verify the file, don't trust the feed — same contract as the
ops export.

## Concept mapping

| trustgraphs.xyz | here |
|---|---|
| checkpoint / epoch | ledger cut (`seq` + `ledger_head`) |
| input accumulator | `inputHash` over the canonical edge set; ground truth is replaying `possibility.appreciated` events ≤ `cut.seq` |
| paramsHash | sha256 of the published params object |
| outputRoot | Merkle root over `(actor, value)` leaves |
| journal | `trust_epoch` record + `trust.epoch` ledger event |
| prover | the recompute recipe below — a deterministic pure function |
| `/merkle/:snap/:root/:acct` | `GET /trust/epochs/:n/score/:actor` |

Two honest divergences, stated so nobody conflates them:

1. **Different program.** The external standard program is directed-vouch
   seeded PageRank with a trusted-start reachability gate. Ours gates
   influence on `min(a→b, b→a)` mutuality — a deliberately different
   semantic (their model permits per-network programs). Scores from a
   published external network are a *complementary* signal, never merged
   silently.
2. **No ZK at this layer.** An epoch proves *recompute-ability* — hash
   commitments plus a deterministic pure function — not zero-knowledge
   correctness. ZK enters via a real trustgraphs network (phase 2).

## The journal

```json
{
  "epoch": 3, "program": "springforth-mutual-recognition", "programVersion": 1,
  "cut": { "seq": 4217, "ledgerHead": "f83b…", "at": "…" },
  "inputHash": "…", "edgeCount": 20, "actorCount": 9,
  "paramsHash": "…", "params": { "alpha": 0.85, "iters": 20, "mutualRule": "min",
    "seedPolicy": "uniform", "poolScale": 1000000, "…": "…" },
  "outputRoot": "0x…", "totalValue": "1000000", "scoresHash": "…",
  "createdAt": "…"
}
```

- `cut.ledgerHead` — byte-identical to `/ledger/verify?seq=<cut.seq>`'s `head`.
- Epochs are numbered from 1; ids are `te-000001`-style zero-padded so id
  sort is epoch order. Acceptance is a `trust.epoch` ledger event —
  appended, never edited.

## Checkpoint rules (mirrors theirs)

- No checkpoint while the graph has zero edges.
- No new epoch while `inputHash` AND `paramsHash` are unchanged — a quiet
  network doesn't checkpoint; a param change recomputes one.
- A seq-gap cadence (`trust.epochMinSeqGap`, default 25) defers epochs
  during input churn; the hourly cron lands the deferred checkpoint.
- `POST /trust/epochs/checkpoint` (admin) forces one.

## Canonical encodings

- **Edges**: `trustEdges(appreciations)` → `{from,to,weight,mutual}` sorted
  by `(from,to)`. `inputHash = sha256(JSON.stringify({edges}))`.
- **Params**: `paramsHash = sha256(JSON.stringify(params))`.
- **Scores**: float EigenTrust vector → integer pool `poolScale`:
  normalize, floor, distribute the remainder by largest fraction
  (tiebreak: actor id). `Σ scores == totalValue` always.
  `scoresHash = sha256(JSON.stringify({scores}))`.
- **Leaves** (domain `springforth.trust-score/v1`):
  `keccak256(keccak256(abi.encode(string actor, uint256 value)))`.
  Leaves sort by hash; pairs hash `keccak256(concat(min,max))`; an
  unpaired node promotes — OpenZeppelin StandardMerkleTree conventions
  over our own leaf domain. These proofs are NOT their address domain.

## Routes

| Route | What |
|---|---|
| `GET /trust/epochs` | journals, newest first |
| `GET /trust/epochs/:n` | one journal |
| `GET /trust/epochs/:n/inputs.json` | canonical edges + params — the recompute package |
| `GET /trust/epochs/:n/scores.json` | canonical scores + outputRoot |
| `GET /trust/epochs/:n/score/:actor` | `{actor,value,leaf,index,proof}` bundle |
| `GET /trust/scores/current` | latest epoch + scores |
| `POST /trust/epochs/checkpoint` | admin: force a checkpoint |
| `GET /trust` | live graph + `epoch` journal pointer |

## Recompute recipe

```bash
curl -s $HOST/trust/epochs/3/inputs.json > inputs.json
curl -s $HOST/trust/epochs/3/scores.json > scores.json
# input binding:
node -e 'const i=require("./inputs.json"),c=require("crypto");
console.log(c.createHash("sha256").update(JSON.stringify({edges:i.edges})).digest("hex")===i.inputHash)'
# full recompute: run eigenTrust(edges, params) → quantize → buildScoreTree
# → compare outputRoot / scoresHash / totalValue. Reference impl: src/trustgraph.ts.
# same-cut anchor:
curl -s "$HOST/ledger/verify?seq=$(jq .cut.seq inputs.json)"   # head === cut.ledgerHead
```

## Consumers pin epochs

- `FundingRound.trustEpoch`, `RetroRound.trustEpoch`,
  `GovernanceProposal.trustEpoch` — written at open; pairwise allocation,
  badgeholders, and the eligible-voter cohort compute over the epoch's
  committed edges, not the live graph. Decisions stay open → the root
  they pinned stays citable.
- `scoreCard`/actor pages keep live vectors — display, not decision data.
- Governable params: `trust.epochMinSeqGap`, `trust.alpha`,
  `trust.iters`, `trust.poolScale` (epoch-scored); `trust.priorSource`,
  `trust.priorShare` (phase 3 — external prior, default off).

## Ops export

`trust_epoch` records carry the journal fields (pointers, not score
blobs) — see `docs/OPS-EXPORT.md` v1.2.
