# Draft — reply to t/25429 (put the idle treasury to work)

---

Yes — and the yield destination matters as much as the yield source.

The natural pairing is yield → matching pool. Principal stays conservative (Spark/Aave at sane rates), and the ~$500k/yr becomes *match that exists before it's promised* — the invariant the bread-cooperative thread is converging on post-Artizen. Octant already proves this shape works (locked GLM → WETH rewards → rounds); Gitcoin running it at treasury scale is the bigger version of the same proof.

Two additions from our build worth stealing:

**Continuous match, not batch match.** Superfluid-style streams let yield accrue to the matching pool continuously, so rounds can draw on "yield to date" rather than waiting for harvest cycles. We've got these builders live on Celo.

**Ledger-visible treasury.** Whatever the custody structure, every treasury event should land on a publicly-verifiable append-only ledger — hash-chained, externally anchored. "The yield went where it said it would" should be recomputable by anyone, not attested in a report. Ours is at `/ledger/verify`; the pattern is trivially portable.

And a sharpening from experience: yield alone doesn't scale matching fast enough (that was the original critique that pushed us toward endowment design). At ~4-6% on $15M you're at ~$500-900k/yr — meaningful, but the pool also needs *growth* mechanics (sponsor inflows, secondary-market fee capture, round fees routed back) or the endowment stays a subsidy rather than becoming a flywheel.
