# Pitch-morning runbook — Oct 28

## Pre-flight (10 min before)

```bash
cd ~/Documents/springforth

# 1. Verify prod is green
curl -s https://springforth.widespread.workers.dev/ledger/verify   # {"ok":true}
curl -s https://springforth.widespread.workers.dev/?format=json    # counts

# 2. Re-seed if anything drifted (idempotent — safe to re-run)
cd packages/edge && source <(grep ADMIN_TOKEN .dev.vars) && cd ../..
ADMIN_TOKEN=$ADMIN_TOKEN node scripts/seed-demo.mjs

# 3. Confirm the live-flip card sits at quorum-1
curl -s "https://springforth.widespread.workers.dev/possibilities?format=json" \
  | python3 -c "import json,sys; \
    [print(p['id'],p['status']) for p in json.load(sys.stdin)['possibilities'] \
     if 'in this room' in p['title']]"

# 4. QR for the flip beat
open docs/hackathon/demo-assets/join-qr.png
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
- Pairwise contrast: `/rounds/round-mida-creek` vs
  `/rounds/round-pairwise-demo` — same needs, clique discounted
  ($232.84 vs ~$263).
- The flip: QR → judges join `poss-you-in-this-room-…` → quorum activates
  live + Telegram pings. If the room has no signal, join twice yourself
  from two devices — never fake it.
- Judge self-serve: `/tour` on the landing page is the 5-minute path.

## After

- `/ledger/anchor` (admin) to Bitcoin-anchor the day's ledger head.
- Datasets registry: release any new slices for the data-lane beat.
