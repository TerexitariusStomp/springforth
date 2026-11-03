# Outbound PR — love-fund/docs.love.fund: fill the Ecosystem stub

Target: `docs.love.fund` repo, `/reference/ecosystem/` page (currently a stub).

## Proposed page content (offer as draft; maintainers edit freely)

```markdown
# Ecosystem

## Gitcoin

love.fund is a mainstream continuation of the Gitcoin mission. love.fund
is incubated at Gitcoin and governed by GTC.

## techne

techne is an everything app for localism. love.fund is an app that
contains our fundraising experiments — complementary: love.fund pushes
crowdfunding in the ai/crypto era, techne provides distribution, and
love.fund is where techne and aligned projects raise.

## Live pilots

- **Commitment pooling, Kilifi / Mida Creek** — a chartered, two-leg
  round (platform + independent ops executor) with coastal crews who
  already pool commitments offline. Frozen params written to a public
  ledger at open; daily recomputable export
  (springforth.widespread.workers.dev/export/ops.ndjson); readout ~2
  weeks after close. Charter negotiation is public:
  gov.gitcoin.co/t/25438.
- *Open: add your pilot here — pilots answer the four gate questions
  on the wide-aperture page before onboarding.*
```

PR title: `docs: fill ecosystem page — live pilots section (commitment pooling, Kilifi)`
Body: "The Ecosystem page was a stub. This fills it with the Gitcoin/Techne sections that were already drafted plus a Live pilots section seeded with the chartered Kilifi commitment-pooling round — a real experiment other pilots can copy the checklist from. Edit freely."
```

---

# Outbound issue — technefoundation/ePDS-upstream: LICENSE

Title: `Add a LICENSE — repo is currently all-rights-reserved`

Body:
```
Flagging: this repo has no LICENSE file, which makes it all-rights-
reserved by default — unusable for downstream/commercial work even
though it's public. Since it forks Bluesky's PDS (MIT/Apache-2.0
dual-licensed upstream), a PR restoring the upstream license terms is
likely the fix. Happy to open that PR if you want it — or if a different
license is intended, naming it resolves the same ambiguity.
```
