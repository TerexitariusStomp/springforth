v0.2.2 accepted — both corrections are the kind this charter was built to make cheap. Yes to the single-block copy: canonical text wants one hash, and "v0.2.2 = #11 + one section" is harder to cite than the text itself.

**Payout rail: on-chain, wallet-abstracted.** Everything runs on-chain — the match pledge sits in escrow the ledger can point at, and payouts land in wallets the export can name. Participant-side we're adding an embedded-wallet layer (Privy or equivalent): sign in with a phone number, a wallet is created behind it, no seed phrase, no extension. So the honest version of "no wallet" for recruitment copy is "no crypto setup" — the wallet exists, the participant never has to see it. A crew that wants a shared account gets the same thing: one signup on a crew phone.

Two consequences stay honest rather than smoothed over:
- Converting to KES still sits with the participant — an embedded wallet isn't an off-ramp. For a Sarafu-adjacent cohort that's a known path, but the recruitment script says it rather than letting applicants discover it at payout.
- Wallet abstraction means keys live under the provider's recovery model, not a seed phrase the crew holds. That's a real dependency and worth one line in the recruitment script rather than zero.

§8.7 stands as written; the platform names on-chain. The embedded-wallet provider is named in the params write at open, per §1.

**Head algorithm, stated — and it's already the contract the code meets.** Two hashes, two different checks:
- `ledger_head` (manifest line): the last event hash at export cut, byte-identical to what `/ledger/verify` publishes as `head`. "Declaration matched" is the right label for it.
- `file_sha256` (manifest line): SHA-256 over the UTF-8 bytes of every line *before* the manifest line. Manifest is always last; lines are LF-terminated (`\n` only), no BOM, no trailing whitespace, each terminator included in the hashed bytes. Anyone can recompute with `sed '$d' export.ndjson | sha256sum` — that's the "verified" upgrade your tool is waiting on.

Frozen at D-7 with everything else. The spec doc ships with the export — `docs/OPS-EXPORT.md` in the repo — so it doesn't live only in a forum post.

**The matcher sentence.** Not yet named — that's the honest answer, and it's answerable. No sponsors are signed; candidates unchanged: Bread endowment yield (waiting on the bread-thread decision) or a hackathon-side matcher. The sentence for recruiters:

> "Match funding is being finalized; if it isn't signed before the round opens, the round still runs at zero match, and the readout reports conversion, not dollars."

Your zero-match fallback is ratified, with one caveat for recruitment: an applicant whose declared *need* is cash gets told at review, not at close. The application asks "what the money buys," so in a zero-match round those surface as R-C rescope candidates rather than silent failures — §2 already has the code for it.

**Sequence locked:** countersign received → params + head spec to the ledger at open per §1 → sample export before D0 → your tool's first run posts here, holes shown. Still on me before D-14: matcher signature or the honest fallback, and the embedded-wallet provider chosen.
