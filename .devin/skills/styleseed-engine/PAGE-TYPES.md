# StyleSeed — Page-Type Playbooks

The second axis of design judgment (see `APP-PLAYBOOKS.md` for the first). The 74
rules in `DESIGN-LANGUAGE.md` always apply; this file says **what a given kind of
screen needs to get right**, regardless of domain.

> **Domain × page type = the actual call.** A fintech *dashboard* and a social
> *dashboard* differ by domain; a *dashboard* and a *form* differ by page type.
> Read the domain playbook **and** the page-type playbook, then scaffold.

For each type: **the job**, **structure**, **hierarchy**, **signature patterns**,
**anti-patterns**, **mobile**.

---

## Dashboard / Home / Overview

- **Job:** answer "how are things?" in 3 seconds, then let the user drill down.
- **Structure:** information pyramid — one hero metric → a small KPI set →
  supporting list/chart. Vary section types (Rule 14/61): never four identical
  cards in a row.
- **Hierarchy:** density increases as you scroll. Top = 48px hero number; bottom
  = 13–14px detailed rows.
- **Patterns:** HeroCard, KPI grid (mixed: trend / progress / comparison),
  ChartCard, RankedList, BriefingCarousel for alerts.
- **Anti-patterns:** wall of identical KPIs, no clear primary metric, charts with
  6 legend colors, everything the same visual weight.
- **Mobile:** single column, hero first, horizontal-scroll carousels for KPI sets,
  `mx-6` single cards / `px-6` grids.

## Form / Create / Edit

- **Job:** get accurate input with the least friction and the most confidence.
- **Structure:** **single column**, logical grouping into `SectionCard`s, one
  clear primary action (bottom or sticky). Labels **above** fields, not beside.
- **Hierarchy:** the field you're on > the next field > everything else. Primary
  action visually dominant; secondary/cancel quiet.
- **Patterns:** labeled inputs, inline validation (validate on blur, not on every
  keystroke), grouped sections, sticky save bar, `wiggle` + helper text on error,
  clear required/optional marking.
- **Anti-patterns:** multi-column forms (eye zig-zags), placeholder-as-label,
  validating before the user finishes, two primary buttons, error states with no
  recovery guidance, disabled submit with no explanation.
- **Mobile:** full-width fields, ≥44px touch targets, numeric keyboards for number
  fields, sticky primary above the keyboard.

## Landing / Marketing / Home (public)

- **Job:** in one screen, say what it is + why it matters + one next action.
- **Structure:** hero (headline + subhead + single primary CTA) → proof
  (features/social proof) → CTA again. One conversion goal per page.
- **Hierarchy:** headline dominates; CTA is the single brightest element; supporting
  text recedes. The accent belongs to the CTA.
- **Patterns:** hero with one CTA, feature grid, social proof (logos/stats/quotes),
  before/after, comparison, closing CTA.
- **Motion — this is the ONE surface where the Cinematic tier applies (DESIGN-LANGUAGE §43).**
  Unlike an app/dashboard, a brand page *should* use motion as craft: **scroll-LINKED reveals,
  pinned/sticky sections, sequential "the product assembles as you scroll" choreography, subtle
  parallax, a 3D/tilt hero or showcase card, an animated gradient/mesh or video background, rich
  hover** (magnetic/glow/lift). This is how family.co / stripe.com / linear.app read premium —
  don't apply dashboard restraint here. Guardrails still hold: purposeful (not jitter), 60fps
  (`transform`/`opacity` only), never blocks the first read or the CTA/LCP, `prefers-reduced-motion`
  leaves a complete static page, one motion language.
- **Anti-patterns:** multiple competing CTAs, wall of text, every section the same rhythm,
  autoplaying *audio*, motion that **delays the headline or hides content until you scroll**,
  **scroll-JACKING** (hijacking scroll speed / trapping — different from scroll-linked, which is
  fine), six accent colors, no reduced-motion fallback.
- **Mobile:** stack everything, keep the CTA reachable, don't shrink the headline
  into mush.

## Detail / Profile / Item

- **Job:** show one thing deeply, with its primary action obvious.
- **Structure:** identity header (title/image/status) → key facts → body/sections →
  one primary action (often sticky on mobile).
- **Hierarchy:** the subject's name/title and its primary action win. Metadata is
  tertiary.
- **Patterns:** hero/identity block, key-value facts, tabbed or sectioned body,
  sticky primary action, related items rail, status indicators.
- **Anti-patterns:** burying the primary action, equal weight on everything, no
  clear "what is this," metadata louder than the subject.
- **Mobile:** sticky action bar, collapse long sections, single column.

## List / Index / Browse / Search

- **Job:** scan many items fast, find the right one, act.
- **Structure:** optional filter/search bar → consistent rows/cards → clear
  per-item action or tap target. Consistency beats variety here.
- **Hierarchy:** the item's identifying field (name/title) is boldest; status and
  meta are quieter; the value/amount is emphasized on the trailing edge.
- **Patterns:** `ListItem` (title + status dot + trailing value), filterable list,
  segmented control, swipe actions on mobile, empty state, `stagger-cascade`
  entrance, skeleton while loading.
- **Anti-patterns:** rows that vary wildly, no empty/loading state, status by color
  alone (pair with text/dot), tiny tap targets, pagination where infinite scroll
  fits (or vice-versa).
- **Mobile:** full-width rows, swipe-to-act, ≥44px rows, sticky filter.

## Settings / Account / Preferences

- **Job:** let the user find and change one setting with confidence, safely.
- **Structure:** grouped `SectionCard`s by topic (profile / notifications /
  billing / danger), each setting a labeled row with its control on the trailing
  edge. Destructive actions isolated and clearly marked.
- **Hierarchy:** flat and scannable — settings are equal-weight within a group;
  group titles orient. Danger zone visually separated.
- **Patterns:** toggle rows, select rows, account header, billing card, **danger
  zone** (the one place a functional border + destructive tone is right),
  inline-save or explicit-save (be consistent).
- **Anti-patterns:** destructive actions next to benign ones, unclear save model,
  settings with no labels, toggles whose state is ambiguous, no confirmation on
  irreversible actions.
- **Mobile:** full-width rows, controls reachable with the thumb, ≥44px toggles.

## Onboarding / First-run / Empty

- **Job:** get the user to their first win with minimal steps, never a dead end.
- **Structure:** few steps with visible progress, one decision per step, a strong
  "what's next." Empty states are onboarding in disguise — always offer the next
  action.
- **Hierarchy:** the current step and its single action dominate; progress is
  visible but quiet.
- **Patterns:** stepper/progress, one-question-per-screen, `EmptyState` (icon +
  title + description + action), `pop-in`/`confetti-pop` on completion, contextual
  tips, skip/defer where fair.
- **Anti-patterns:** asking everything up front, empty screens with no next action,
  no sense of progress, punishing or shaming empty states, forcing setup before
  any value.
- **Mobile:** one step per screen, big primary, progress at top.

---

## Resolving conflicts

When a domain playbook, a page-type playbook, and a Golden Rule seem to pull
different directions, resolve in this order:

1. **Golden Rules** (`DESIGN-LANGUAGE.md` §Prohibition) — never violated.
2. **Page-type job** — the screen must do its job (a form must be fillable; a
   landing must convert).
3. **Domain bias** — within the above, lean into the domain's DNA.

Example: a fintech (restraint) onboarding (rewards) → keep the palette restrained
(domain), but a single celebratory `confetti-pop` on first deposit is fine
(page-type job: reward the first win) — as long as no Golden Rule breaks.
