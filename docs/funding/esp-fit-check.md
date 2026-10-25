# Ethereum Foundation ESP — fit check

*esp.ethereum.foundation/applicants — rolling. Wishlist and RFP-driven; ESP explicitly funds open-source, non-commercial work aligned with their Wishlist (CROPS: cryptography, robustness, openness, privacy, security) and posted RFPs.*

## Verdict: conditional — do not cold-apply

ESP is not a general public-goods funder; applications must answer a listed Wishlist item or open RFP. Before drafting:

1. Pull the current Wishlist (esp.ethereum.foundation) and check for items in: coordination/funding mechanisms, public-goods infrastructure, attestations/EAS tooling, account abstraction for communities, or rollup-adjacent settlement.
2. If a Wishlist item matches (plausible: open-source funding mechanisms, EAS tooling, AA wallet patterns), file an application naming that item — ESP wants the mapping explicit.
3. If nothing matches, request **office hours** (ESP offers them) with a 3-line framing: "coordination + funding + evidence infrastructure, non-custodial, shipped on EVM rails; seeking fit guidance."

## What we'd pitch if a wishlist item fits
- EIP-191/ERC-1271 wallet↔actor binding as reusable pattern (`verifyWalletBinding`, `ActorPersonhood` via MiniKit SIWE)
- EAS attestation schemas for outcome verification (`springforth.outcome.v1`, `springforth.evaluation.v1`, GAP-compatible update schema)
- Non-custodial tx-builder surface as public pattern: GET → unsigned calldata → wallet signs → record hash
- Allo v2 / EAS / Hypercerts composed as infrastructure, not a product moat

## Notes
- ESP funding goes to *ecosystem-relevant open-source work* — frame as Ethereum-ecosystem public infrastructure, not a product pitch.
- AI-provenance: no ESP AI-code policy found; still disclose honestly in the application narrative.
