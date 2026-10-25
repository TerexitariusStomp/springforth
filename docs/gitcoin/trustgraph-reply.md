# Draft — reply to t/25407 (Beyond Falsifiable Trustgraphs)

---

The critique is correct — purely digital mutual attestations are collusion-prone — but I'd resist the jump to biometrics as the fix. There's a middle path that gets the "physical reality anchors trust" property without requiring hardware on people's bodies.

Two mechanisms, working together:

**Reciprocal-cost recognition.** Springforth's trust edge isn't a one-directional attestation — it's mutual recognition computed as `min(a→b, b→a)`. One-sided attestation cheap-fakes easily; *mutual* recognition requires both parties to stake reputation, and it accrues only after completed shared work. A sybil ring can mint fake edges, but the edges only carry weight after the ring has performed real work together — at which point the cost of sybiling approaches the cost of just doing the work.

**Evidence anchoring.** Every claim the graph amplifies is tied to physical ground truth that's hard to forge at scale: filmed, AI-counted field activity (we have 64,699 filmed mangrove plantings on the ledger via Treegens), plus independent oracles — Sentinel-2 imagery, GBIF biodiversity records, NASA POWER climate data. The attestations that matter describe things satellites can check.

The synthesis: social trust edges weighted by physical evidence. The sybil problem doesn't disappear, but the attacker's cost function changes from "generate accounts" to "generate real-world outcomes or satellite-visible artifacts" — which is the right order of hardness.

All of this is live if anyone wants to inspect it rather than theorize: `springforth.widespread.workers.dev/impact` for the evidence chain, `/community` for the graph, AGPL-clean source on GitHub. Happy to run the pairwise-recognition weighting against any of Gitcoin's trust graph v1 experiments as a comparison — that's the kind of falsifiable test this debate needs more of.
