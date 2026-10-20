// Judge tour — the self-serve demo path. Numbered stops, each with what
// to notice and which judging criterion it proves. Doubles as presenter
// checklist for the live pitch.
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STOPS: { href: string; title: string; notice: string; proves: string }[] = [
  { href: '/', title: 'Landing — "coordinate first"',
    notice: 'The triage: what needs attention — overlaps awaiting humans, cards near quorum, unmet needs.',
    proves: 'UX / first-time user' },
  { href: '/possibilities', title: 'Possibility deck',
    notice: '"I want to…" cards with quorum thresholds — commitment binds at quorum, not before.',
    proves: 'The core primitive: people ∧ resources' },
  { href: '/coordination', title: 'Coordination layer',
    notice: 'Machine-flagged overlaps between plans in different systems — validated by humans with strength/materiality/readiness.',
    proves: 'PS1 direct answer: dedupe without centralising' },
  { href: '/outcomes', title: 'Outcomes',
    notice: 'Who else is pursuing the same outcome — across OnePlanet, Treegens, Silvi, and community cards.',
    proves: 'Use of datasets' },
  { href: '/rounds', title: 'Funding rounds',
    notice: 'Quadratic matching over unmet needs — pairwise mode discounts coordinated giving using our own trust graph.',
    proves: 'The moat: collusion resistance without an external passport' },
  { href: '/verify', title: 'Open-evidence readings',
    notice: 'Remote sensing, sensors, biodiversity records scored per node — evidence for review, human validation authoritative.',
    proves: 'Technical implementation + feasibility' },
  { href: '/governance', title: 'Governance',
    notice: 'Parameter ballots gated by EigenTrust standing — the social graph is the franchise, not a token.',
    proves: 'Scalability + decentralisation' },
  { href: '/datasets', title: 'Dataset releases',
    notice: 'Signed, Bitcoin-anchored data releases — the data-revenue lane.',
    proves: 'Business idea' },
  { href: '/docs', title: 'API + typed client',
    notice: 'Full route surface, OpenAPI 3.1, typed SDK — others can build on the layer.',
    proves: 'Technical implementation' },
  { href: '/ledger', title: 'Audit ledger',
    notice: 'Every decision hash-chained; head anchored to Bitcoin via OpenTimestamps.',
    proves: 'Trust without custody' },
  { href: '/agent', title: 'Agent query (POST {"q":"…"})',
    notice: 'Deterministic cited answers over the live graph — the idea-starter\'s "agentic AI" lane.',
    proves: 'PS1 idea starter' },
];

export function renderTourPage(): string {
  const rows = STOPS.map((s, i) => `
<div class="stop"><span class="n">${i + 1}</span>
<div><a href="${s.href}">${esc(s.title)}</a>
<p>${esc(s.notice)}</p>
<small class="muted">proves: ${esc(s.proves)}</small></div></div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Judge tour — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:44rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
.stop{display:flex;gap:1rem;border:1px solid #ddd;border-left:5px solid #4a7a4a;border-radius:.4rem;padding:.8rem;margin:.7rem 0}
.n{font-size:1.6rem;font-weight:700;color:#4a7a4a;min-width:1.8rem}
p{margin:.3rem 0}.muted{color:#555}a{color:#2d6a2d}</style></head><body>
<h1>The tour — ~5 minutes</h1>
<p>Springforth answers PS1: overlapping plans in different systems get
deduplicated into coordinated, funded action. Each stop is live — click
through in order.</p>
${rows}
<footer><small>Springforth — PS1 Collaboration Reverse · Team Two ·
<a href="/">home</a></small></footer></body></html>`;
}
