# pub.techne.draft.fund.* — draft funding lexicon

techne.pub currently publishes `place` + `space` drafts only — no
causes/funding record types exist (probed 2026-11-03, all 404). The
ops export schema already ships typed, public, ledger-verifiable
versions of every record a funding network needs. Offered upstream
as the draft `pub.techne.draft.fund.*` set.

| Ops export type | Proposed NSID | Key fields |
|---|---|---|
| `declaration` | `pub.techne.draft.fund.cause` | id, title, place, declaredBy (pseudonymous), minParticipants, deadline, status, at |
| `commitment` | `pub.techne.draft.fund.contribution` | id, causeRef, actorRef, brings (resource|labor|money), at |
| `quorum` | `pub.techne.draft.fund.thresholdEvent` | causeRef, committedSet[], metAt |
| `evidence` | `pub.techne.draft.fund.evidence` | via (oracle-check/forum-post/report/claim-artifact), refHash/uriHash/textHash, at |
| `attestation_edge` | `pub.techne.draft.fund.vouch` | via (appreciation|attestation), from, to, causeRef, at — deduped per pair |
| `match_flow` | `pub.techne.draft.fund.fundingflow` | lane (matching_fund/pledge/donation/stream/yield/revshare), amount, currency, state, at |
| `manifest` | `pub.techne.draft.fund.cut` | seq, ledger_head, file_sha256 — the integrity anchor other apps can recompute |

## Properties (matches ops-export semantics)

- Append-only; disputes/corrections are flag *events*, never edits.
- Pseudonymous actors (`a_<sha256>`, stable across cuts) — records are
  joinable over time without doxxing participants.
- Hashes not footage: evidence pointers ship hashed.
- `revshare` lane carries the love.fund revenue share (criterion #20)
  + `skimBps`/`upstreamSplitBps` params on `matching_fund` records.

## Path

1. This doc = the draft. Offer to Techne/love.fund in-thread.
2. If accepted, emit `export/ops.atproto.ndjson` — same cut, NSID-typed
   records, PDS-writable when Techne opens writes.
