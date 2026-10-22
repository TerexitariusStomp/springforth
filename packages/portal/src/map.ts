import { LAND_RINGS } from './worldmap-data.ts';
import { pageShell } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { pageHeader } from './ui.ts';

// Server-rendered equirectangular world map — no tiles, no CDN, no JS
// dependency. Landmass is the vendored Natural Earth outline; markers
// are <a>-wrapped SVG circles that deep-link into the card deck, so the
// whole thing degrades to plain navigation without a script runtime.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const W = 1000;
const H = 500;
const proj = (lon: number, lat: number): [number, number] =>
  [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  status: string;        // active | quorum | completed | expired | draft
  title: string;
  href: string;          // where the marker links (default /possibilities#id)
}

const landPaths = (): string =>
  LAND_RINGS.map((ring) => {
    const d = ring.map(([lon, lat], i) => {
      const [x, y] = proj(lon!, lat!);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join('');
    return `<path d="${d}Z" class="map-land"/>`;
  }).join('\n');

// One marker per card — 8px dot with a 22px transparent hit halo so the
// tap target clears 44px on any density. Status drives color only.
export function worldMapSvg(markers: MapMarker[], evidence: MapMarker[] = [], tt: (k: string) => string): string {
  const dots = markers.map((m) => {
    const [x, y] = proj(m.lon, m.lat);
    const st = ['active', 'quorum', 'completed', 'expired', 'draft'].includes(m.status) ? m.status : 'draft';
    return `<a href="${esc(m.href)}" class="map-pin" aria-label="${esc(m.title)}">
<circle class="map-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>
<circle class="map-dot map-${st}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"><title>${esc(m.title)} — ${esc(m.status)}</title></circle></a>`;
  }).join('\n');
  const evDots = evidence.map((m) => {
    const [x, y] = proj(m.lon, m.lat);
    return `<a href="${esc(m.href)}" class="map-pin" aria-label="${esc(m.title)}">
<circle class="map-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>
<circle class="map-dot map-evidence" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"><title>${esc(m.title)}</title></circle></a>`;
  }).join('\n');
  return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(tt('map.a11y'))}" class="sf-map">
<title>${esc(tt('map.title'))}</title>
${landPaths()}
${evDots}
${dots}
</svg>`;
}

export const MAP_CSS = `
.sf-map{width:100%;height:auto;display:block;border:1px solid var(--sf-line-2);border-radius:12px;background:var(--sf-map-sea)}
.sf-map .map-land{fill:var(--sf-map-land);stroke:var(--sf-line-2);stroke-width:.5}
.sf-map .map-halo{fill:transparent}
.sf-map .map-dot{stroke:var(--sf-card);stroke-width:1.2}
.sf-map .map-active{fill:var(--sf-green-3)}
.sf-map .map-draft{fill:var(--sf-sage)}
.sf-map .map-quorum{fill:var(--sf-info)}
.sf-map .map-completed{fill:var(--sf-coral)}
.sf-map .map-expired{fill:var(--sf-muted)}
.map-evidence{fill:var(--sf-teal);opacity:.85;stroke-width:.8}
.sf-map .map-pin:focus-visible{outline:none}
.sf-map .map-pin:focus-visible .map-halo{fill:none;stroke:var(--sf-green-2);stroke-width:2}
.map-legend{display:flex;gap:1rem;flex-wrap:wrap;font-size:.8rem;color:var(--sf-muted);margin-top:.5rem}
.map-legend i{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;margin-right:.3rem}
.map-unlocated{max-width:78.125rem;margin:1rem auto 0;font-size:.8rem;color:var(--sf-muted)}
`;

export function mapLegend(tt: (k: string) => string): string {
  const rows: Array<[string, string]> = [
    ['active', 'map.live'], ['quorum', 'map.quorum'],
    ['completed', 'map.completed'], ['expired', 'map.expired'],
    ['evidence', 'map.evidence'],
  ];
  return `<p class="map-legend">${rows.map(([cls, key]) =>
    `<span><i class="map-dot map-${cls}"></i>${esc(tt(key))}</span>`).join('')}</p>`;
}

export interface MapPageInput {
  lang: Lang;
  markers: MapMarker[];
  evidence?: MapMarker[];
  unlocated: { id: string; title: string; place?: string }[];
}

export function renderMapPage(o: MapPageInput): string {
  const lang = o.lang;
  const tt = (k: string) => t(lang, k);
  const unloc = o.unlocated.map((c) =>
    `<li><a href="/possibilities#${esc(c.id)}">${esc(c.title)}</a>${c.place ? ` — ${esc(c.place)}` : ''}</li>`).join('\n');
  return pageShell({
    title: `${tt('map.h1')} — Springforth`, lang, htmx: false,
    extraCss: MAP_CSS,
  }, `<div class="page">
${pageHeader({
    kicker: tt('map.kicker'),
    title: tt('map.h1'),
    em: tt('map.h1.em'),
    lede: tt('map.lede'),
    back: { href: '/possibilities', label: tt('nav.possibilities') },
  })}
${worldMapSvg(o.markers, o.evidence ?? [], tt)}
${mapLegend(tt)}
${unloc ? `<p class="map-unlocated"><strong>${esc(tt('map.unlocated'))}</strong></p><ul>${unloc}</ul>` : ''}
</div>`);
}
