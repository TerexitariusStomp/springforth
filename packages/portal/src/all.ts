import { footer } from './nav.ts';

// /all — every surface stacked on one scrollable page (review mode).
// Each section is a live iframe of the real route — no duplicated render
// logic, always current. Anchors make each section linkable.

const SECTIONS: [string, string][] = [
  ['Home — landing', '/'],
  ['Deck — possibility cards', '/possibilities'],
  ['Rounds — matching + endowment', '/rounds'],
  ['Outcomes', '/outcomes'],
  ['Coordination', '/coordination'],
  ['Portfolio', '/portfolio'],
  ['Governance', '/governance'],
  ['Datasets', '/datasets'],
  ['Streams', '/streams'],
  ['Trust graph', '/trust'],
  ['Tour — judge self-serve', '/tour'],
  ['API docs', '/docs'],
  ['Verify — open-evidence readings', '/verify'],
  ['Metrics (JSON)', '/metrics'],
  ['Ledger verify (JSON)', '/ledger/verify'],
];

export function renderAllPage(): string {
  const toc = SECTIONS.map(([t, p], i) =>
    `<a href="#s${i}">${t.split(' — ')[0]}</a>`).join(' · ');
  const secs = SECTIONS.map(([t, p], i) => `
<section id="s${i}">
<h2>${i + 1}. ${t} <small><a href="${p}" target="_blank">open ${p} ↗</a></small></h2>
<iframe src="${p}" loading="lazy"></iframe>
</section>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>All surfaces — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:80rem;margin:1.5rem auto;padding:0 1rem;color:#1a1a1a}
h1{margin-bottom:.2rem}h2{font-size:1rem;margin:2rem 0 .4rem}
section{border-top:2px solid #ddd;padding-top:.5rem}
iframe{width:100%;height:34rem;border:1px solid #ccc;border-radius:.4rem}
small{font-weight:normal;font-size:.8rem}</style></head><body>
<h1>All surfaces</h1>
<p class="toc">${toc}</p>
${secs}
${footer()}
</body></html>`;
}
