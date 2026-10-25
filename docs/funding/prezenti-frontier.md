# Prezenti Season 3 — Frontier Pool application draft

*Closes Dec 29, 2026. Frontier Pool: agent-economy + protocol infrastructure on Celo.*

## One-line
Springforth is coordination-and-funding infrastructure already running on Celo mainnet — quadratic rounds, dominant-assurance pledges, attested outcomes — now with an agent-native surface (MCP + OpenAPI) so AI agents can declare, join, and fund possibilities.

## Celo traction (all verifiable today)
- Contract addresses verified live on Celo mainnet (block ~80.6M, 2026-10-20): EAS `0x72E1…`, Allo `0x1133…`, HypercertMinter, cUSD `0x765D…`.
- Unsigned-calldata builders in `src/chain.ts`: `buildCreateRoundTx` (Allo pool + QF strategy), `buildAttestTx` (EAS), `buildMintClaimTx` (HypercertMinter), `buildCreateFlowTx` (Superfluid CFA forwarder), Silvi `sponsorSpecies` rail.
- `/mcp/agent` — MCP server endpoint: agents discover and act on the whole API surface without bespoke integration.
- `/docs` — 90+ documented routes; `/docs.json` OpenAPI for programmatic clients.

## Frontier fit
The "agent economy on Celo" thesis needs infrastructure agents can actually transact through: declared intents (possibilities), programmable escrow-adjacent funding (assurance pledges, rounds, streams), and verifiable outcomes (EAS + OTS + IPFS evidence packs). Springforth is that layer — agent-native by design, Celo-settled by default.

## Milestones
1. Agent-facing round lifecycle demo: an agent runs a complete QF round on Celo (create pool → allocations → distribution) via `/mcp/agent` + wallet signing.
2. On-chain attestation pipeline: outcome payloads → EAS on Celo, indexed by Karma GAP tooling (schema already GAP-compatible).
3. Agent reputation: actor trust scores (`eigenTrust` over mutual recognition) exposed to agent callers for counterparty screening.

## Ask
Frontier Pool, ~$25k. AGPL-3.0-only; <4% custom code atop MIT/Apache upstreams (PROVENANCE.md).
