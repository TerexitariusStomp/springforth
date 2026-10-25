# Filecoin Foundation — Builder Next Step grant draft

*Rolling. $5k–$10k. GitHub-issue application at fil.org/grants. Open-source required — AGPL-3.0.*

## Pitch
**Content-addressed evidence for public-goods funding.** Springforth's evidence layer already freezes and pins:

- `POST /datasets/{name}/release` — freezes a graph slice to JSONL, builds a sha256 manifest, OTS-anchors the digest (Bitcoin calendars, keyless), pins to IPFS via Kubo RPC (`IPFS_API` env), and stores the `cid` on the `DatasetRelease` entity.
- `POST /evidence/anchor` — sha256 manifest of arbitrary evidence files, pinned to IPFS, `cid` returned and ledger-attributed (`evidence.anchored` events carry the cid).

Result: every evidence pack — field reports, oracle readings, round allocations — is a content-addressed artifact with a Bitcoin-anchored timestamp and a hash-chained ledger event. Durable, verifiable, platform-independent.

## What the grant funds
1. **Filecoin persistence lane** — move beyond hot IPFS pins: Filecoin deal-making for long-term evidence storage (Lighthouse/web3.storage deal APIs or direct). Evidence outlives pinning services.
2. **CID-first evidence surface** — `/evidence/:cid` resolution + gateway fallbacks so any cid is dereferenceable without our worker.
3. **Round-archive format** — a funding round's full record (donations, allocation, evidence, attestations) as one pinned CAR — funder-grade audit artifact.

## Why Filecoin cares
Public-goods evidence is exactly the data that should outlive its host: grant-makers and evaluators need replayable proof years later. Filecoin's public-data mission maps one-to-one; we become a reference consumer of the storage lane in the ReFi/public-goods sector.

## Attachments
- Live `/ledger/verify`, `/datasets` registry (cid fields populated when IPFS_API configured)
- `src/attest.ts` anchor section + `pinToIpfs` in `src/index.ts`
