# RFP Response: Reboot the Gitcoin Community — Workstream A

**Who:** Terexitarius — [gov.gitcoin.co/u/TerexitariusStomp](https://gov.gitcoin.co/u/TerexitariusStomp), [@Terexitarius](https://x.com/Terexitarius)
**What:** Workstream A only, solo, milestone-gated, **$15k** over ~90 days
**Where:** this thread + kevin@gitcoin.co

Here's the thing nobody else bidding can say: I'm already inside the thing you're rebooting. The love.fund pilot — the experiment Kevin asked for in the bread thread — is chartered, countersigned, and opens mid-November. Two legs, public rules, a recomputable export anyone can check today.

I'm bidding A only. Delegation is the long pole — nothing else in the reboot matters until quorum is real — and it's the workstream where my approach is a mechanism, not a promise.

## What I've got to show (links, not claims)

- [springforth.widespread.workers.dev](https://springforth.widespread.workers.dev) — a live coordination platform: commitment pools, escrow pledges, a hash-chained ledger you can recompute at [`/ledger/verify`](https://springforth.widespread.workers.dev/ledger/verify), and a daily export at [`/export/ops.ndjson`](https://springforth.widespread.workers.dev/export/ops.ndjson) — run `sed '$d' ops.ndjson | sha256sum` on it, the hash in the manifest matches. AGPL.
- The [pilot thread](https://gov.gitcoin.co/t/love-fund-pilot-a-commitment-pooling-experiment/25438) — 15 posts of public negotiation that ended in a signed charter: rubrics, replacement clauses, published failure modes, $0 ops terms. That's my portfolio for this job. Not a deck — a thing that happened.
- [commons-protocol](https://github.com/TerexitariusStomp/commons-protocol) — the open Artizen archive: 3,375 rescued projects, liquidity pools, an endowment that feeds itself.

## How A gets done

Your open question is the right one: how do you keep the new delegate base from being the inner circle in new hats? Most bidders will answer with "I'll find good people" — which is the inner circle with extra steps.

The fix is mechanical: build the longlist from **computed standing**, not from who I know. Forum history, contribution trails, attestation edges — the same signals Gitcoin's own TrustGraph is already shadow-scoring. The literature backs the move (arXiv:2512.23618 does delegation routing exactly this way), and the failure it's preventing is documented too — the Uniswap delegation study showed insider affinity is measurable, not hypothetical (arXiv:2503.11940). That's also why the ≤20% concentration cap matters: it's a countermeasure, not a hope.

The candidate net doesn't live on crypto twitter either. The longlist pulls from five more graphs: **Nostr** (the open-social regen crowd), **Bluesky** (ATProto natives — the same graph Simocracy's agent-driven funding rounds live on), **Farcaster** (the builder crowd), **Talent Protocol** (Builder Score as a third standing signal — off-github reputation that isn't my rolodex), and **Human Passport** — Gitcoin's own personhood rail. Passport does double duty: it vets delegate candidates (one human, one profile) and it keeps the delegation metric honest — 100 new delegations means 100 humans, not 100 wallets. Using Gitcoin's own infrastructure for this is intentional.

Every candidate, mine or suggested, clears the same public rubric. Nobody gets in through "Kevin vouched for them" and nothing else. On the rubric itself: the ICIS study across 66k+ candidates found sustained commitment predicts delegation outcomes, so it scores stewardship signals, not resume weight.

## First 30 days

- **Week 1** — public rubric draft posted for comment
- **Week 2** — 40+ name longlist across five-plus communities, computed-standing scores attached
- **Weeks 3–4** — ten vetted profiles live on gov.gitcoin.co, onboarding running
- **Throughout** — delegation-matching conversations open with the holders you said you'd intro

Health checks after that compute delegate-voter alignment on-chain, not self-reported turnout — the similarity-recommender work (IEEE ICBC 2026) is pretty clear that alignment, not participation theatre, is what moves the needle.

## Money

All three milestones are public and checkable:

**Milestone 1 — $2,500 (the trial).** Rubric + 40-name longlist + ten published delegate profiles. Fire me here if it's the wrong start — you keep the artifacts, no obligation. Worst case is $2.5k for a public rubric and a vetted candidate pool.

**Milestone 2 — $10,000.** ≥2.5M GTC delegated across ≥10 delegates, no delegate above 20% concentration. This is an on-chain number — it moves or it doesn't, and I don't get paid on effort.

**Milestone 3 — $2,500.** Public roster + delegate handbook + first health check published.

**Total: $15,000.** A delegate-ops shop will quote you multiples of this for the same headcount. The difference isn't quality — it's that I'm one person with a mechanism, not a payroll with a rolodex.

## Your open questions

**Inner circle in new hats?** Covered above — computed standing, one rubric, concentration cap. The answer that isn't "trust my network."

**Re-engage the 2023–25 leavers without litigating the past?** Don't litigate it at all. People who left over unverifiable promises don't need an apology essay — they need something they can check. A public rubric applied to named profiles is the re-onboarding for this workstream.

**Non-crypto audience without alienating crypto natives?** For A, the honest version: the longlist spans crypto-native graphs (Farcaster) and off-crypto reputation (Talent Protocol, Bluesky's ATProto crowd) — the rubric scores both on the same criteria, so nobody's grandfathered in from either side.

**MVP vs. theater?** Theater is a flat monthly retainer. Signal is $10k gated on an on-chain number.

## Why A and why me

$15k buys the quorum layer back — the treasury itself stays behind its multisig and security layers, but without delegation the governance above it can't act at all. Everything else in the reboot is a plan about a plan until that layer works. With it, the bread yield flywheel the other thread already sized ($1–2M at 4–6%) can actually be voted in — $40–120k/yr gross potential against a $15k one-time spend, conditional on governance approving it and the rails landing. And love.fund's own published docs price graduation directly: campaigns share revenue back to Gitcoin — one $500k-class city round at the published 10% covers this bid ~3×.

I'm A-only because solo means honest scope. If you want B and C covered well, award them to someone whose full attention they get — my full attention goes to the 90 days that decide whether the rest has a quorum to serve.

## Conflicts

- GTC: none held — no delegate self-interest in the pool I'm recruiting
- I hold operator-of-record on the love.fund pilot — a Gitcoin-adjacent engagement, disclosed. The ops executor is an independent counterparty, not my staff.
- Springforth runs part-time alongside; its artifacts inform the sourcing approach, disclosed rather than pretended is a coincidence.

## References

- Lin Jiaze — ops executor, love.fund pilot (the counterparty on that signed charter — ask him how I negotiate)
- Djimo — Silvi (Silvi's data feeds are live integrations in my stack — ask him what working with me looks like)
- Leo (CivilMonkey) — regen community (ecosystem standing)
