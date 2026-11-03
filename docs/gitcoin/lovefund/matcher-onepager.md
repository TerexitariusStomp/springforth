# Matcher one-pager — love.fund × Kilifi commitment-pool pilot

*For: Bread decision-makers · Techne pilot pool · SF Live sponsors*

## The hole

Artizen collapsed owing match money it had promised but never held — thousands of donors learned what matching feels like, then what it feels like to lose it. The fix isn't a better promise; it's a different structure.

## The mechanism

Participants declare *possibilities*: I want to do X, I bring A, I need B, this activates when N people commit. Commitments can be capital or real-world resources — the Kilifi round involves boats, propagules, transport, labor. Coordination activates at quorum. Completion is attested on a public hash-chained ledger anchored to Bitcoin — `/ledger/verify`, anyone can recompute.

## The guarantees (structural, not policy)

- **Match exists before it's promised.** Dominant-assurance pledges lock in escrow; failed quorum refunds automatically. The Artizen liability cannot form.
- **Rules can't move.** Round parameters are written to the ledger at open and hash-checkable at close — a changed bar shows as a broken hash.
- **Audit by construction.** Daily NDJSON export; every file carries the ledger head + a file hash recomputable with `sed '$d' | sha256sum`. The ops leg verifies the file, never trusts it.
- **Two-leg accountability.** Signed charter v0.2.2: platform owns mechanism/escrow/ledger; an independent ops executor owns recruitment/review/reporting — $0 fee, replaceable without cause, holds no funds. The charter's negotiation is public in the thread — the accountability is the artifact.

## The differentiator

**Allocation is market-priced, not committee-picked.** A completion-probability market per possibility resolves on the ledger's attestation event; each possibility's match weight is its price at quorum — frozen, checkable, unrevisable. No crowdfunding lane has this; it turns "who deserves match" from a curator's call into an information instrument.

## The checkable artifact

Everything above is inspectable today: the ledger, the charter history (15 posts of public negotiation), the export spec (`docs/OPS-EXPORT.md`), and the toolkit for how applications are judged. The signature stands on documents that don't flatter us.

## The ask

A named match for the round — or nothing, stated plainly. The fallback is ratified: the round runs at zero match, the readout reports conversion not dollars, and the mechanism is measured either way.

## The return

Verified outcomes you can point at: attested deliveries, a published readout inside 72h of close (funnel, attester concentration, market calibration, what we got wrong), and a durable mutual-recognition trust graph that makes the next round smarter than this one.
