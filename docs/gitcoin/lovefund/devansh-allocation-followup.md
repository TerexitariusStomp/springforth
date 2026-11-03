Following through on the follow-up promised elsewhere — the design surface the charter leaves open is *allocation*, and this is the market-mechanism draft for it. [@thedevanshmehta] offered to review; posting here because §5 made this thread the channel of record, and allocation decisions belong on it.

**The open surface.** The charter froze mechanism and accountability: quorum, caps, attester floor, exports, interpretations. What it doesn't answer is *distribution* — if a match pool exists, how much lands on which possibility. The defaults are bad at this scale: a curator picks, or the pool splits uniformly. Both ignore the best information source in the round — the participants' own knowledge of what can actually be delivered.

**The instrument.** One categorical market per approved possibility: "does P reach attested completion by close?" Venue candidate is seer.pm — Gnosis rails, conditional tokens, Kleros as dispute backstop — because the resolution question is already answered by the ledger: attested completion requires ≥3 distinct attestors, no self-attestation, and disputes resolve by flag events. The market resolves on the append-only event; Kleros is the fallback arbiter, not the primary oracle. A flagged event resolves N/A — never an edit.

**The allocation rule.** A possibility's match weight = its market price *at its quorum event* — read at activation and written to the ledger like a §1 param: frozen, checkable, never revisited. Weight-at-quorum does two things: it prices the match on information current at activation rather than at application, and it can't be gamed by schedule — the manipulator doesn't control when quorum lands.

**Why it composes.** Escrow guarantees the match *exists*; markets only decide *distribution*. The Artizen failure mode — promised money that wasn't held — stays impossible because allocation never touches existence.

**At zero match the market still runs.** No money flows through it, but predicted-vs-attested calibration becomes a readout line — Brier per possibility, by group. The round then measures two things: whether the mechanism activates a crew, and whether prices knew what attestors knew. That's a real result either way.

**The conviction lane is a different instrument, and I'm keeping them separate.** Opinion markets — Confetti-style vote-and-earn contests — aggregate subjective conviction: "which possibility deserves backing." That's an engagement surface for the crypto-side cohort, not an allocation oracle. Seer prices will-it-happen; persuasion markets measure should-it-be-backed. Conflating them is where most market-funding designs go wrong, so this draft doesn't.

**Gaming surface, disclosed not smoothed.** Participants can trade their own possibility — hedging is information, and the attester floor plus share-concentration metric is the detection surface for gaming attestation to move resolution. Thin markets get reported as thin in the readout. Nobody gets an honest mechanism by hiding its attack surface.

**Lineage.** Deep funding's pairwise estimation with a market anchor is the scale path — the GG24 model that dropped its market feature degraded ~51%, which is evidence the price carries the dominant signal. One market per possibility is right for a round this size; the pairwise estimator is for when possibility count outgrows per-market attention.

**Asks — three, all answerable:**
1. **Venue.** Is Seer viable for a sub-$5k, phone-first Kenyan cohort — liquidity, gas, mobile UX — or is an internal LMSR the honest round-1 venue with Seer for round 2?
2. **Pitch effect.** Does market-priced allocation strengthen the matcher pitch or complicate it? My read: "your match is distributed by information markets and every distribution is checkable" beats "a committee split it" — but you're closer to funder psychology than I am.
3. **The research surface.** Market-priced allocation against ledger-resolved outcomes produces a public calibration dataset nobody has. AI4PG funds exactly this lane (up to $10k, rolling) — and [@sejal_rekhan] was already in the conversation. If the spec converges this week, a proposal can be in before the pilot opens and the round itself becomes the evaluation.

Charter note for ops: if the market runs, §5b gains one pre-registered line — "allocation weight = market price at quorum, recorded on ledger" — and the readout gains one column. Both are append operations; nothing about the round changes retroactively.
