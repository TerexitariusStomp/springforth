# Pitch-morning runbook — Oct 28

> **Confirmed schedule** (Lobby → Notes → "Dates for the Hackathon", Oct 5):
> Submissions **Oct 27, 2–3 PM** · Pitches **Oct 28, 10 AM–12 PM** ·
> Judging 1–2 PM · Awards 3–4 PM. **8 minutes per team**, slots allocated
> nearer the deadline, Teams meeting lands in calendar. Demo script is a
> 6-min cut (leaves ~2 min for questions/hand-off); the 2:30 captioned
> video is the fallback.

## Pre-flight (10 min before)

```bash
cd ~/Documents/springforth

# 1. Verify prod is green
curl -s https://springforth.widespread.workers.dev/ledger/verify   # {"ok":true}
curl -s https://springforth.widespread.workers.dev/?format=json    # counts

# 2. Re-seed if anything drifted (idempotent — safe to re-run)
#    (401s? the secret drifted once before — restore it:
#     grep SPRINGFORTH_ADMIN_TOKEN ~/.hermes/.env | cut -d= -f2 \
#       | npx wrangler secret put ADMIN_TOKEN)
cd packages/edge && source <(grep ADMIN_TOKEN .dev.vars) && cd ../..
ADMIN_TOKEN=$ADMIN_TOKEN node scripts/seed-demo.mjs

# 3. Confirm a live-flip card sits at quorum-1 ('active', 2/3 in).
#    Completed demo flips show 'quorum' — expected, leave them.
curl -s "https://springforth.widespread.workers.dev/possibilities?format=json" \
  | python3 -c "import json,sys; \
    [print(p['id'],p['status'],p.get('participantCount')) \
     for p in json.load(sys.stdin)['possibilities'] \
     if 'in this room' in p['title']]"

# 4. QR for the flip beat
open docs/hackathon/demo-assets/join-qr.png

# 5. Value block renders (treasurer beat)
curl -s "https://springforth.widespread.workers.dev/possibilities?format=json" \
  | python3 -c "import json,sys; \
    [print(p['id'],'→',p.get('value',{}).get('byCurrency')) \
     for p in json.load(sys.stdin)['possibilities'] \
     if 'Shrewsbury' in p['title']]"
```

## If prod is down or slow

- Rollback: `cd packages/edge && npx wrangler deployments list` →
  `npx wrangler rollback <previous-version-id>`
- Known-good tag: `git tag pitch-2026-10-28` — redeploy that commit if
  HEAD drifted.
- Full fallback: screenshots in `demo-assets/` (numbered, in demo-script
  order) or the recorded video (VIDEO-SCRIPT.md narration).

## During the pitch

- Demo order: `docs/hackathon/DEMO-SCRIPT.md` (6-min version; 4-min short
  cut marked *).
- UK endorsed-data beat: the "Shrewsbury riverside flood response" card on
  `/possibilities` carries live verified context (EA Flood Monitoring,
  Open-Meteo, FHRS, Land Registry, ONS, CKAN, iNaturalist, Climate TRACE);
  `/rounds/round-severn-flood` shows the UK pairwise round;
  `/impact#evidence` lists the full endorsed matrix (`DATA-SOURCES.md`).
- Treasurer beat: pause on the Severn card's **"Coordinated value (est.)"**
  block — committed + matched (£, ledger) + declared hours × ONS £14.43/h
  + in-kind budgets + EA/ABI £30k/home risk benchmarks. Methodology:
  `VALUATION.md`.
- Pairwise contrast: `/rounds/round-mida-creek` vs
  `/rounds/round-pairwise-demo` — same needs, clique discounted
  ($232.84 vs ~$263).
- The flip: QR → reviewers join `poss-you-in-this-room-…` → quorum
  activates live + Telegram pings. If the room has no signal, join twice
  yourself from two devices — never fake it.
- Self-serve: `/how-it-works` (linked from the landing page's Learn menu)
  is the 5-minute walkthrough.

## Submission pack — Shared tab, Oct 27 2–3 PM

Per Richard Peers (Oct 21): submissions post to **Team Two via the Shared
tab**; criteria + suggested elements are in Resources/Notes. Stage:

- [ ] `docs/hackathon/BMC.md` — Business Model Canvas (their 9 blocks)
- [ ] `docs/hackathon/PITCH.md` — pitch notes (rubric-mapped)
- [ ] `docs/hackathon/ARCHITECTURE.md` + `architecture.png` — logical architecture
- [ ] `docs/hackathon/VALUATION.md` — valuation methodology
- [ ] Live demo URL: `https://springforth.widespread.workers.dev` (+ `/how-it-works`)
- [ ] `demo-assets/walkthrough.mp4` — 2:30 captioned fallback video
- [ ] Repo link: github.com/TerexitariusStomp/springforth
- [ ] `DATA-SOURCES.md` — endorsed-source matrix

Confirm on the day: file upload vs link post vs both (Richard's fuller
post is expected "today").

### Ready-to-paste post

> **Team Two — PS1 submission: Springforth**
>
> Springforth turns fragmented community plans and "I want to…"
> declarations into coordinated commitments and quorum-activated funding —
> needs matched to offers first, pooled funding second, human approval
> before anything moves, every step on a hash-chained audit ledger.
>
> - **Live demo**: https://springforth.widespread.workers.dev —
>   `/how-it-works` is the 5-minute self-serve walkthrough; `/docs` is
>   the API reference
> - **Code + docs**: https://github.com/TerexitariusStomp/springforth
>   (MIT-clean; BMC, pitch, architecture, valuation methodology under
>   `docs/hackathon/`)
> - **Walkthrough video** (2:30, captioned): attached / link below
> - Evidence lane reads endorsed public sources hourly (EA Flood,
>   Open-Meteo, FHRS, IoD 2025); funding lane runs quadratic + pairwise
>   matching behind a demand gate — match exists before it is promised;
>   every card carries treasurer-grade value accounting (committed +
>   matched + in-kind + volunteer time, per-currency, never converted).
>
> Happy to walk any reviewer through the ledger-verify or the valuation
> methodology live.

## After

- `/ledger/anchor` (admin) to Bitcoin-anchor the day's ledger head.
- Datasets registry: release any new slices for the data-lane beat.
