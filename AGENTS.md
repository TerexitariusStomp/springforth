# Springforth — agent working rules

## Security gates (machine-enforced)

- `wrangler deploy` runs TruffleHog + Trivy + Semgrep before deploying; HIGH/CRITICAL findings block. Do not use `SECURITY_SKIP` unless the user explicitly approves.
- `git push` runs Gitleaks on the pushed range via the global pre-push hook. Never commit secrets.

## Frontend design gate (StyleSeed)

The portal uses the vendored StyleSeed suite in `.devin/skills/` (upstream: bitjaru/styleseed, MIT — see `.devin/skills/PROVENANCE.md`). Design lock: `STYLESEED.md`. Artifact registry: `.styleseed/`.

Before shipping frontend changes:

```bash
pnpm design:check                 # deterministic scan across all 6 artifacts — must be 0 findings
pnpm -F portal run typecheck
pnpm -F portal run test
```

Golden rules (StyleSeed core invariants — apply to all UI work):

1. Semantic tokens only — colors come from `packages/portal/src/theme.ts` `--sf-*` vars, never hardcoded hex in components.
2. One identifiable primary action per screen (coral); one focal point — avoid all-even card grids.
3. No `transition-all`; name transitioned properties. Any animation needs a `prefers-reduced-motion` fallback.
4. Never suppress focus outlines without a visible replacement. Touch targets ≥44px. Desktop body text ≥16px.
5. Status color encodes severity only — don't use accent colors for decoration.
6. Pico CSS (classless, vendored at `/vendor/pico.css`) sets element-level styles — inherited colors on `p`, headings etc. must be set explicitly on the element or Pico wins.
7. No emoji as UI icons. Use inline SVG.
8. After visual changes: screenshot at 1440×900 and 390×844 (Playwright is installed) and actually read the PNGs — do not claim visual verification from code alone.

Slop-detect (`slop <url> --json`, globally installed) is a supplementary anti-genericness diagnostic — treat its score as evidence, not a pass/fail. Documented-intentional flags on this portal: `all_caps_labels` (editorial kickers), `numbered_steps` (how-it-works), `glassmorphism` (modal backdrop), `hero_eyebrow_pill` (nav CTA is chrome, not an eyebrow), `faq_accordion`, `nested_cards`.

## Architecture notes

- Server-rendered portal: `packages/portal/src/*.ts` render functions → `packages/edge/src/index.ts` Worker routes → D1.
- All pages share `pageShell()` + `SF_CSS` from `packages/portal/src/theme.ts` — change tokens/shared classes there, not per-page styles.
- HTMX vendored at `/vendor/htmx.js`; every interactive feature must degrade to plain links/forms without JS.
- Landing/deck data is always live — never hardcode stats.
- Dark mode follows `prefers-color-scheme` via token remap in theme.ts — components must consume `--sf-*` vars so both modes work; `--sf-ink-fixed`/`--sf-pale` are the never-flip tokens for text on always-light (lime/coral/pale) or always-dark accents.
- `POST /possibilities` accepts form-encoded bodies and 303-redirects to the new card's deep link.
- `/all` splices page bodies server-side via a `SELF` service binding (Cloudflare blocks plain self-fetch, error 1042).

## Testing

- `pnpm -r --if-present run test` — `packages/client` has no test files (pre-existing; exits nonzero in a recursive run, ignore it).
- Portal render smoke tests assert judge-critical markers (status pills, value blocks, gate badges, endowment) — keep them green.
