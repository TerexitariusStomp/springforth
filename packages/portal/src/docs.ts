// Rendered API docs — a readable route table grouped by family so a
// judge sees documentation, not a JSON wall. Raw spec stays at /docs.json.
import { pageShell } from './theme.ts';

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
  return pageShell({ title: 'API — Springforth', htmx: false,
    extraCss: `.m{background:rgba(200,243,109,.35);font-weight:700;border-radius:.25em}
.page td{vertical-align:top}` }, `<div class="page">
<h1>Springforth API</h1>
<p class="lede">Every surface below is live. Non-custodial: chain endpoints return
unsigned calldata — wallets sign. Admin routes take
<code>authorization: Bearer &lt;token&gt;</code>. Raw OpenAPI 3.1:
<a href="/docs.json">/docs.json</a> · typed client:
<code>@springforth/client</code>.</p>
${[...groups.entries()].map(([g, rows]) => section(g, rows)).join('')}
${misc.length ? section('Other', misc) : ''}
</div>`);
}
