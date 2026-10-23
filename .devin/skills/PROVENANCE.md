# Vendored skills — provenance

| Skill | Upstream | License | Version |
|---|---|---|---|
| `styleseed/` (router + 22 `ss-*` workflows + node scripts) | https://github.com/bitjaru/styleseed (`npx skills add bitjaru/styleseed`, edge channel) | MIT (LICENSE included) | engine 5.0.0, rev `sha256:82a1b8071fc8fb2ab034e8b24d8e254f48eff906ab55838f6e9d8f6f748d2d2c` |
| `styleseed-engine/` (method knowledge base) | same distribution | MIT | 5.0.0 |
| `claude-design/` | Hermes `creative/` skill (BadTechBandit) | MIT | 1.1.0 |
| `popular-web-designs/` (54 real design systems) | VoltAgent/awesome-design-md via Hermes | MIT | 1.0.0 |
| `design-md/` (Google DESIGN.md spec) | Hermes `creative/` skill | MIT | — |

Source of the copy: `root@147.79.71.192:~/.hermes/skills/` (Hermes VPS install).

## How the ss-* skills work in Devin

The `ss-*` SKILL.md files use Claude-style frontmatter (`/ss-*` slash commands do
not auto-invoke here). Use them as method documents and run the node-stdlib `.mjs`
scripts directly:

```bash
# Diagnose registry/compile state (read-only)
node .devin/skills/styleseed/ss-resolve/scripts/styleseed-doctor.mjs --project-root .

# Compile a design bundle for one artifact
node .devin/skills/styleseed/ss-resolve/scripts/resolve-context.mjs \
  --project-root . --artifact <id> --agent generic

# Deterministic design score (SS001–SS006)
node .devin/skills/styleseed/ss-score/scripts/styleseed-check.mjs scan \
  --project-root . --artifact <id> --format json
```

ss-verify has no script — it is a workflow: screenshot the rendered page with
Playwright (installed: `~/.local/bin/playwright`), read the PNG, score the golden
rules against the pixels, fix, re-shoot.

This directory is also vendored at `~/.devin/skills/` for cross-project use.
