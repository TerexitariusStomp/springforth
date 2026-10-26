# Springforth — agent working rules

## Security gates (machine-enforced)

- `wrangler deploy` runs TruffleHog + Trivy + Semgrep before deploying; HIGH/CRITICAL findings block. Do not use `SECURITY_SKIP` unless the user explicitly approves.
- `git push` runs Gitleaks on the pushed range via the global pre-push hook. Never commit secrets.
- Secret comparisons go through `timingSafeEq` (src/index.ts) — never `===`/`!==` on ADMIN_TOKEN or webhook secrets.
- Request bodies are capped in `handle()`: 256KB unauthenticated writes, 8MB hard ceiling (authed callers keep headroom for evidence packs). Don't add an unbounded `req.json()` path around it.
- `fetchOk` (src/adapters/fetch.ts) applies a 15s `AbortSignal.timeout` to every upstream call — keep adapter fetches behind it so a hung source can't stall the hourly cron.
- Deploy via `pnpm run deploy` / `pnpm web:deploy` (or `npx wrangler deploy`) — bare `pnpm deploy` collides with pnpm's builtin.

## Frontend design gate (StyleSeed)

The portal uses the vendored StyleSeed suite in `.devin/skills/` (upstream: bitjaru/styleseed, MIT — see `.devin/skills/PROVENANCE.md`). Design lock: `STYLESEED.md`. Artifact registry: `.styleseed/`.

Before shipping frontend changes:

```bash
pnpm check                        # typecheck + vitest + design:check — same as CI
pnpm a11y:check                   # axe vs the LIVE site — run after deploy to catch regressions
```

CI (`.github/workflows/ci.yml`) runs typecheck, vitest, design:check, web:typecheck, web:build on every push/PR.

Golden rules (StyleSeed core invariants — apply to all UI work):

1. Semantic tokens only — colors come from `src/portal/theme.ts` `--sf-*` vars, never hardcoded hex in components.
2. One identifiable primary action per screen (coral); one focal point — avoid all-even card grids.
3. No `transition-all`; name transitioned properties. Any animation needs a `prefers-reduced-motion` fallback.
4. Never suppress focus outlines without a visible replacement. Touch targets ≥44px. Desktop body text ≥16px.
5. Status color encodes severity only — don't use accent colors for decoration.
6. Pico CSS (classless, vendored at `/vendor/pico.css`) sets element-level styles — inherited colors on `p`, headings etc. must be set explicitly on the element or Pico wins.
7. No emoji as UI icons. Use inline SVG.
8. After visual changes: screenshot at 1440×900 and 390×844 (Playwright is installed) and actually read the PNGs — do not claim visual verification from code alone.

Slop-detect (`slop <url> --json`, globally installed) is a supplementary anti-genericness diagnostic — treat its score as evidence, not a pass/fail. Documented-intentional flags on this portal: `all_caps_labels` (editorial kickers), `numbered_steps` (how-it-works), `glassmorphism` (modal backdrop), `hero_eyebrow_pill` (nav CTA is chrome, not an eyebrow), `faq_accordion`, `nested_cards`.

## Architecture notes

- Server-rendered portal: `src/portal/*.ts` render functions → `src/index.ts` Worker routes → D1.
- All pages share `pageShell()` + `SF_CSS` from `src/portal/theme.ts` — change tokens/shared classes there, not per-page styles.
- HTMX vendored at `/vendor/htmx.js`; every interactive feature must degrade to plain links/forms without JS.
- Landing/deck data is always live — never hardcode stats.
- Dark mode follows `prefers-color-scheme` via token remap in theme.ts — components must consume `--sf-*` vars so both modes work; `--sf-ink-fixed`/`--sf-pale` are the never-flip tokens for text on always-light (lime/coral/pale) or always-dark accents.
- `POST /possibilities` accepts form-encoded bodies and 303-redirects to the new card's deep link.
- Feed signals are persisted entities: `POST /possibilities/:id/pass` (excluded from the actor's deck via `viewerDeck`, never public) and `POST /possibilities/:id/interest` (the `Interest` entity — warm "I'm interested" short of joining; count is public on the card, identities are not). Both take a `next` param sanitized to local `/possibilities*` paths and 303 back. `?for=<actor>` scopes the deck to joined-or-interested and decorates cards with since-engagement markers (`personal.newSince`/`lastEvent` derived from the audit trail vs the viewer's earliest engagement).
- `CouncilSeat` (`council-seat`) auto-seats at quorum in `sweepPossibilities` (declarer + participants; verifiers self-seat via `POST /possibilities/:id/council`; sponsors seat on bound pledge). `ForumPost` (`forum-post`) opens at quorum; writes are council-gated and ledger-attributed (`council.seated`, `forum.posted`).
- `/map` is server-rendered SVG (`src/portal/map.ts` + hand-simplified `worldmap-data.ts`, Natural Earth 110m provenance in the header) — no tiles, no JS. Geography resolves via `src/geo.ts`: gazetteer → `Possibility.h3` → plannode h3 fallback. `/map` serves HTML only to `Accept: text/html`; JSON clients get `{markers, unlocated}`.
- Card overlays carry the verification surfaces: audit trail (ledger events naming the card), verifier-replay `<details>` per value figure, capital-grouped valuation (`capitals` on each `byCurrency` row), Two-pathways scenario block, council, forum, and appreciation-note reviews.

## Information architecture

- The site is organized as five plain-language hubs plus a Learn menu: `/possibilities`, `/collaborate`, `/fund`, `/impact`, `/community`, with Learn holding `/how-it-works`, `/whitepaper`, `/docs`, and the Telegram bot.
- Retired top-level surfaces 302-redirect to their hub section (e.g. `/coordination` → `/collaborate#overlaps`, `/rounds` → `/fund#rounds`, `/verify` → `/impact#evidence`, `/governance` → `/community#decisions`). The full map lives in `RETIRED` in `src/index.ts`.
- Redirects apply to browser HTML requests only — JSON API routes answer exactly as before, forever. Never reuse a retired slug for new UI.
- Every visible string goes through `t(lang, key)` with `en`/`sw`/`fr` dictionaries in `src/portal/strings/`; tests enforce key parity across all three locales — add a key to all three or the suite fails.
- People and actors render through `displayName()` — a humanized visible name with the raw id kept only in `title`/link hrefs.
- Hub sections are `hubSection()` wrappers: `<details open>` with a one-based `data-hub-index`; the inline `hubScript` collapses sections at index ≥ 3 on narrow viewports. Indexing is one-based — keep `index: i + 1` when adding sections.
- `pnpm a11y:check` runs axe-core through Playwright at 1440×900 and 390×844 against every hub, landing, Learn pages, and `/docs`; zero serious/critical violations is the gate.

## Testing

- `pnpm test` — vitest across `test/`; `pnpm typecheck` — single tsc pass over `src/`+`test/`.
- Portal render smoke tests assert judge-critical markers (status pills, value blocks, gate badges, endowment) — keep them green.
