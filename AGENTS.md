# Springforth — agent working rules

## Security gates (machine-enforced)

- `wrangler deploy` runs TruffleHog + Trivy + Semgrep before deploying; HIGH/CRITICAL findings block. Do not use `SECURITY_SKIP` unless the user explicitly approves.
- `git push` runs Gitleaks on the pushed range via the global pre-push hook. Never commit secrets.
- Secret comparisons go through `timingSafeEq` (src/index.ts) — never `===`/`!==` on ADMIN_TOKEN or webhook secrets.
- Request bodies are capped in `handle()`: 256KB unauthenticated writes, 8MB hard ceiling (authed callers keep headroom for evidence packs). Don't add an unbounded `req.json()` path around it.
- `fetchOk` (src/adapters/fetch.ts) applies a 15s `AbortSignal.timeout` to every upstream call — keep adapter fetches behind it so a hung source can't stall the hourly cron.
- Deploy via `pnpm run deploy` / `pnpm web:deploy` (or `npx wrangler deploy`) — bare `pnpm deploy` collides with pnpm's builtin.
- Cross-account D1 fallback: `D1_PROXY_URL`/`D1_PROXY_KEY` route every `env.DB` call over HTTPS to `sf-d1proxy` (d1-proxy/, Pressword account — fresh row quota while Widespread's was exhausted). `proxiedDb(env)` wraps `fetch`+`scheduled`; remove the var to return to the local `DB` binding. Only prepare/bind/all/first/run/raw/batch are proxied — new D1 surface needs proxy endpoints added.

## CPU budget (free Workers plan — ~10ms/request)

- A full page render costs ~20ms CPU → Cloudflare kills ~half of requests with error 1102 (observed via `wrangler tail`: `outcome: exceededCpu`). This is why anonymous GETs are memoized.
- `anonGetCache` (src/index.ts, in `fetch`) caches anonymous GET responses per `(url, accept/sf-ui variant)` for 5s per isolate. Cookie/`x-actor`/authorization always bypass — never cache personalized output. Any non-GET request clears the map (joins/pledges flip card state, so a post-write GET on the same isolate re-renders fresh).
- Outer layer: `env.PAGES` R2 bucket (`springforth-cache`, binding live since 2026-10-26) caches the same entries globally for 60s under `pages/<epoch>/<key>` — the `page-epoch` object is bumped on every write → instant global invalidation (R2 is strongly consistent, unlike KV's ~60s propagation which makes KV useless at these TTLs). Bucket lifecycle rule `expire-pages` deletes `pages/` objects after 1d (orphaned epoch dirs).
- Cross-isolate staleness is ≤ TTL — don't raise TTLs without considering the live quorum-flip demo.
- i18n instances are cached per lang in `web/app/lib/i18n.ts` (nothing ever calls `changeLanguage`). If mutable i18n state is ever needed, revert to per-request instances.
- Web routes must import portal modules by file (`src/portal/ui.ts`), never the `src/portal/index` barrel — tree-shaking keeps the bundle lean but the barrel pulls every renderer + worldmap data into the graph.
- The durable fix is Workers Paid + `limits: { cpu_ms: 30000 }` in `web/wrangler.jsonc` and `wrangler.toml` (line is already commented there). If upgraded, the memo is still worth keeping for latency.

## D1 free-tier quota (~5M rows read/day, resets 00:00 UTC)

- **Observed 2026-10-26**: quota exhausted → every data-backed route 500s until reset. Each page `list()`s whole entity kinds — a few hundred requests/day of uncached traffic can burn it.
- `list()` parses every row of a kind; hot pages must use `listWhere` with a real `json_extract` filter (precedent: the deck loads only plannodes with `possibilityId`; `loadEvidence` loads only check-referenced nodes).
- The anon-GET cache also shields the quota — cached hits do zero D1 reads.
- `verify-checkpoint` (kind `verify-checkpoint`, id `head`) memoizes ledger chain verification — never clear it unnecessarily; a miss re-scans all ~7k events.
- If quota is out, cached pages still serve; uncached data routes return 500 until 00:00 UTC. Workers Paid removes this class entirely (D1 paid = usage-based).

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
