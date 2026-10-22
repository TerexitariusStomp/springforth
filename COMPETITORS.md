# Competitive landscape — where Springforth stands

Benchmarked against the platforms that overlap our scope. Verdicts are
honest: where a competitor beats us today, the row says so.

| Competitor | What they do | Where we stand |
|---|---|---|
| **OnePlanet** | Workspace plans (outcomes/actions/indicators), mindmap/table/geomap lenses, meaning search, plan reports, MCP API (read-only for customer keys) | We import their whole graph live (`oneplanet:*` plans in D1) and add what their API withholds: cross-plan overlap detection, inferred action→outcome parentage, hash-chained ledger, and a read/write surface that doesn't need a login. Their search matches by meaning — ours does too (`/search`, Workers AI embeddings + minisearch). Their network view is workspace-scoped; ours draws edges between *different* plans and field reports. |
| **Pastry** (Bread Coop) | Yield-funded matching: pasUSD endowments, only interest pays for matching, principal always redeemable | Mechanism parity, surfaced on `/fund`: our endowment rounds lock principal and spend accrued fees only — "the match that exists before it is promised." Plus dominant-assurance pledges (pledges bind only if the round fills; otherwise refunded), which is a safety property Pastry doesn't have. |
| **Gitcoin / Pomelo / Giveth** (Allo stack) | Quadratic funding, retro rounds, Passport-based sybil resistance | Parity+: QF + retro + conviction + streams, all present. Sybil resistance is EigenTrust over the appreciation graph instead of external identity scoring. |
| **Hypercert-style cert platforms** | Tradable impact certificates | Deliberate divergence — our `attest` claims are non-tradable by design (impact claims, not certificates). EAS-shaped proofs without the speculation surface. |
| **Event-plan teams** (sandbox OAIs) | Pension-fund instruments, bond concepts, digital twins — as plan entries | Concepts on a plan page vs. a running protocol: 560+ real imported nodes, live overlap detection, a funding rail, and a ledger anyone can replay. |

## The two genuinely novel pieces

1. **Cross-plan network** (`/collaborate#network`) — ForceAtlas2-laid SVG
   where vertices are *plans from different organisations* and edges are
   detected content overlaps. Nobody else draws that graph because nobody
   else computes it.
2. **Inferred hierarchy** (`scripts/infer-hierarchy.mjs`) — reconstructs
   action→outcome parentage that OnePlanet's customer API doesn't return.
   Our copy of their data is structurally richer than their own export.

## Honest gaps

- OnePlanet's write tools are gated (our `create_*` calls → FORBIDDEN);
  the reverse push is built (`scripts/push-oneplanet.mjs`) but blocked on
  a write-scoped key or Editor role in the sandbox workspace.
- Their polished mindmap UX is nicer than our SVG network — by a lot, on
  visuals. Ours is server-rendered and verifiable; theirs is prettier.
