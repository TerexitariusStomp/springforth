// Sparklines — d3-shape geometry over oracle-check score series.
// Renders nothing when a series has <2 points (insufficient data is
// shown as text, not a flat line pretending to be a trend).

import { line as d3line, curveMonotoneX } from 'd3-shape';

export interface Reading { at: string; score: number }

export function sparkline(readings: Reading[], w = 96, h = 22): string {
  const pts = readings
    .filter((r) => Number.isFinite(r.score))
    .sort((a, b) => a.at.localeCompare(b.at));
  if (pts.length < 2) return '';
  const path = d3line<Reading>()
    .x((_, i) => (i / (pts.length - 1)) * w)
    .y((r) => h - 2 - r.score * (h - 4))
    .curve(curveMonotoneX)(pts) ?? '';
  const last = pts[pts.length - 1]!;
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"
  aria-label="trend ${(pts[0]!.score * 100).toFixed(0)}% → ${(last.score * 100).toFixed(0)}%">
<path d="${path}" fill="none" stroke="var(--sf-ink)" stroke-width="1.4" stroke-opacity="0.7"/>
<circle cx="${w}" cy="${(h - 2 - last.score * (h - 4)).toFixed(1)}" r="2" fill="var(--sf-accent)"/>
</svg>`;
}
