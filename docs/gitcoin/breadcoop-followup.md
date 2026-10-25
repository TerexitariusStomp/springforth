# Draft — reply to t/25430 (gitcoin × bread cooperative)

Post as a follow-up in the existing thread where TerexitariusStomp already commented Oct 21.

---

Following up on my earlier comment, since two replies pushed this in a direction worth surfacing.

@gospelofchange's two critiques — exclusive emphasis on financial capital, and broadcast-mode platform-centrism — are the right ones, and @owocki's response ("interested in a commitment pooling experiment on love.fund") points at the same gap. I'd argue the fix isn't a feature bolted onto a crowdfunding app; it's a different substrate.

We've been building that substrate. It's live at `springforth.widespread.workers.dev` — AGPL-clean, under 4% custom code over public/MIT components, and currently being submitted to the Sustainable Finance Live hackathon.

How it maps to the critiques on the table:

**Non-financial capital.** The core object isn't a project page with a donate button — it's a declared *possibility*: "I want to do X, I bring A, I need B, we go if N people commit." Resources can be money *or* things — the live instance already matches boats, propagules, and transport alongside pledges. That's Grassroots-Economics-shaped commitment pooling (we read Sarafu/community-pool activity as a live evidence source), so the non-financial lane isn't an afterthought, it's the base layer.

**Many-to-many, not broadcast.** Relationships form pairwise and persist: post-completion appreciation becomes a mutual-recognition trust graph — `min(a→b, b→a)` — that improves future matching. There is no platform at the center of every relationship; the graph is the artifact.

**Match must exist before it's promised — enforced, not promised.** Dominant-assurance pledges lock the match in-escrow at pledge time and refund donors if quorum fails. The Artizen failure mode — match that was never real — is a structural impossibility, not a policy.

**Provable accounting.** Every event is hash-chained on an append-only ledger, anchored to Bitcoin, publicly verifiable at `/ledger/verify` (2,163 events today). Fiat or crypto doesn't matter — the accounting gap can't hide either way.

**Evidence-attached outcomes.** Claims arrive hypercert-shaped (lineage: GG23 Hypercerts for Nature Stewards), backed by independent oracles — filmed plantings, Sentinel-2, GBIF — so "impact" is checkable, not asserted. Karma-compatible reporting is already wired.

If the bread-cooperative build wants an engine rather than a greenfield start, this is one — the pledge machinery, the ledger, and the evidence rails are all deployed on Celo with verified mainnet transactions. And if the want is narrower — a commitment-pooling pilot under love.fund — that's the cleaner entry point; I'll be posting a concrete pilot proposal there next.
