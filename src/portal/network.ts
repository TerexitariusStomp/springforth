// Cross-plan network — an SVG picture of which plans' nodes overlap.
// Positions are computed server-side (graphology + ForceAtlas2 in the
// worker); this module is a pure renderer.

import { t, type Lang } from './i18n.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface NetVertex {
  id: string;
  label: string;
  /** viewBox coordinates, already laid out */
  x: number; y: number;
  /** node count behind this vertex — drives radius */
  count: number;
  kind: 'plan' | 'possibility';
}

export interface NetEdge {
  a: string; b: string;
  /** number of overlap records between the two vertices */
  count: number;
  /** strongest record confidence */
  confidence: number;
}

export interface NetworkGraph { vertices: NetVertex[]; edges: NetEdge[] }

export const NETWORK_CSS = `
.net-svg{width:100%;height:auto;border:1px solid var(--sf-line);border-radius:12px;background:var(--sf-card)}
.net-svg text{font-family:inherit;fill:var(--sf-ink);font-size:11px}
.net-svg .net-sub{fill:var(--sf-muted);font-size:9px}
.net-svg a{cursor:pointer}
.net-svg circle{stroke:var(--sf-bg);stroke-width:2}
`;

const W = 900, H = 560;

export function renderNetworkSvg(g: NetworkGraph, lang: Lang): string {
  if (!g.edges.length) return '';
  const byId = new Map(g.vertices.map((v) => [v.id, v]));
  const edgeEls = g.edges.map((e) => {
    const a = byId.get(e.a), b = byId.get(e.b);
    if (!a || !b) return '';
    const w = 0.8 + Math.min(4, Math.log2(1 + e.count));
    const o = 0.25 + Math.min(0.65, e.confidence * 0.6);
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"
      stroke="var(--sf-ink)" stroke-width="${w.toFixed(1)}" stroke-opacity="${o.toFixed(2)}">
      <title>${esc(t(lang, 'hub.collaborate.network.edge'))}: ${e.count} · ${(e.confidence * 100).toFixed(0)}%</title></line>`;
  }).join('\n');
  const vertEls = g.vertices.map((v) => {
    const r = 8 + Math.min(26, Math.sqrt(v.count) * 2.4);
    const fill = v.kind === 'possibility' ? 'var(--sf-accent)' : 'var(--sf-ink)';
    const label = v.label.length > 34 ? `${v.label.slice(0, 32)}…` : v.label;
    return `<g>
<circle cx="${v.x.toFixed(1)}" cy="${v.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="0.85">
  <title>${esc(v.label)} — ${v.count} ${esc(t(lang, 'hub.collaborate.network.nodes'))}</title></circle>
<text x="${v.x.toFixed(1)}" y="${(v.y + r + 12).toFixed(1)}" text-anchor="middle">${esc(label)}</text>
<text class="net-sub" x="${v.x.toFixed(1)}" y="${(v.y + r + 22).toFixed(1)}" text-anchor="middle">${v.count}</text>
</g>`;
  }).join('\n');
  return `<svg class="net-svg" viewBox="0 0 ${W} ${H}" role="img"
  aria-label="${esc(t(lang, 'hub.collaborate.network.t'))}">
${edgeEls}
${vertEls}
</svg>`;
}
