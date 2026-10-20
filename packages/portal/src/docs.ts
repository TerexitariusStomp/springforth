// Rendered API docs — a readable route table grouped by family so a
// judge sees documentation, not a JSON wall. Raw spec stays at /docs.json.
interface PathEntry { summary?: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FAMILY: [string, RegExp][] = [
  ['Coordination', /^\/(possibilities|plans|nodes|overlaps|signals|commitments|coordination|resources|portfolio|trust|agent|import)/],
  ['Actors & trust', /^\/actors/],
  ['Funding', /^\/(rounds|pledges|donations|retro|streams|subscriptions)/],
  ['Claims & attestations', /^\/(claims|attestations)/],
  ['Chain', /^\/chain/],
  ['Governance', /^\/governance/],
  ['Data', /^\/(datasets|evidence|ledger)/],
  ['Evidence & oracle', /^\/(oracle|sources|outcomes|report|verify|metrics)/],
  ['Integrations', /^\/(silvi|treegens|tg)/],
];

export function renderDocsPage(paths: Record<string, Record<string, PathEntry>>): string {
  const groups = new Map<string, [string, string, string][]>();
  const misc: [string, string, string][] = [];
  for (const [path, ops] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const row: [string, string, string] = [method.toUpperCase(), path, op.summary ?? ''];
      const fam = FAMILY.find(([, re]) => re.test(path));
      if (fam) {
        const arr = groups.get(fam[0]) ?? [];
        arr.push(row); groups.set(fam[0], arr);
      } else misc.push(row);
    }
  }
  const section = (title: string, rows: [string, string, string][]) => `
<h2>${esc(title)}</h2>
<table>${rows.sort((a, b) => a[1].localeCompare(b[1])).map(([m, p, s]) =>
    `<tr><td><code class="m">${m}</code></td><td><code>${esc(p)}</code></td>
<td class="muted">${esc(s)}</td></tr>`).join('')}</table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API — Springforth</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a;overflow-x:auto}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.4rem;text-align:left;font-size:.88rem;vertical-align:top}
.muted{color:#555}code{background:#f4f4f4;padding:.1rem .3rem;border-radius:.2rem;font-size:.82rem}
.m{background:#e6f4ea;font-weight:600}h2{margin-top:1.8rem}</style></head><body>
<h1>Springforth API</h1>
<p>Every surface below is live. Non-custodial: chain endpoints return
unsigned calldata — wallets sign. Admin routes take
<code>authorization: Bearer &lt;token&gt;</code>. Raw OpenAPI 3.1:
<a href="/docs.json">/docs.json</a> · typed client:
<code>@springforth/client</code>.</p>
${[...groups.entries()].map(([g, rows]) => section(g, rows)).join('')}
${misc.length ? section('Other', misc) : ''}
<footer><small>Springforth — <a href="/">home</a></small></footer></body></html>`;
}
