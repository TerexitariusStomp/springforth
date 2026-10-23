import { cellToLatLng, isValidCell, latLngToCell } from 'h3-js';
import type { PlanNode } from './graph.ts';

// Place → coordinates. The gazetteer is a small typed table of places
// that appear in real cards and seeded plans — coordinates from public
// place data (OpenStreetMap Nominatim / gazetteer entries, rounded to
// ~1 km). Extensible: add a row when a new canonical place shows up.
// `resolvePlace` falls back to an h3 cell on the card's own plannodes,
// then to null (the card renders its text place only).

export interface GeoPoint { lat: number; lon: number; h3?: string }

// name (lowercase, punctuation-stripped) → {lat, lon}
const GAZETTEER: Record<string, { lat: number; lon: number }> = {
  // Kenya coast — the seeded possibility places + plan placeIds.
  'kwale': { lat: -4.1816, lon: 39.4606 },
  'mida creek': { lat: -3.3581, lon: 39.9800 },
  'kisiwani mida creek': { lat: -3.3581, lon: 39.9800 },
  'kilifi': { lat: -3.5107, lon: 39.9093 },
  'kilifi north ken': { lat: -3.5107, lon: 39.9093 },
  'gasi mangroves kinondo': { lat: -4.4167, lon: 39.5500 },
  'kinondo': { lat: -4.4167, lon: 39.5500 },
  'majoreni': { lat: -4.3500, lon: 39.5833 },
  'dadaab': { lat: 0.0523, lon: 40.3129 },
  'dadaab garissa': { lat: 0.0523, lon: 40.3129 },
  'kakamega': { lat: 0.2827, lon: 34.7519 },
  'kakamega kenya': { lat: 0.2827, lon: 34.7519 },
  'dar es salaam': { lat: -6.7924, lon: 39.2083 },
  'dar es salaam coast plots': { lat: -6.7924, lon: 39.2083 },
  'kunduchi kawe kinondoni municipal dar es salaam coastal zone 14130 tanzania': { lat: -6.6667, lon: 39.2167 },
  'kibugumo coast plots dar es salaam': { lat: -6.7000, lon: 39.2500 },
  'gongoni gongoni ward magarini kilifi county kenya': { lat: -3.2333, lon: 39.9667 },
  'chete': { lat: -3.3000, lon: 40.0000 },
  'kiwegu majoreni pongwe kikoneni ward lunga lunga kwale kenya': { lat: -4.5833, lon: 39.2167 },
  // UK — the flood-action cards.
  'hebden bridge': { lat: 53.7419, lon: -2.0130 },
  'shrewsbury': { lat: 52.7077, lon: -2.7553 },
  'thorntree': { lat: 54.5500, lon: -1.2080 },
  'thorntree middlesbrough': { lat: 54.5500, lon: -1.2080 },
  'middlesbrough': { lat: 54.5742, lon: -1.2350 },
  // Latin America — OnePlanet/Tulum imports.
  'tulum': { lat: 20.2114, lon: -87.4654 },
  'avenida cob tulum quintana roo 77760 mexico': { lat: 20.2114, lon: -87.4654 },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Longest-prefix matching: 'mida creek, kilifi' resolves via 'mida creek'.
export function gazetteerLookup(place: string): { lat: number; lon: number } | null {
  const n = norm(place);
  if (!n) return null;
  if (GAZETTEER[n]) return GAZETTEER[n]!;
  // try progressively shorter prefixes of the query, then any gazetteer
  // key that is a prefix/substring — keeps 'kwale county' → kwale.
  const words = n.split(' ');
  for (let len = words.length - 1; len > 0; len--) {
    const hit = GAZETTEER[words.slice(0, len).join(' ')];
    if (hit) return hit;
  }
  for (const key of Object.keys(GAZETTEER).sort((a, b) => b.length - a.length))
    if (n.includes(key)) return GAZETTEER[key]!;
  return null;
}

// Card → coordinates: explicit h3 on the possibility wins, then the
// gazetteer on the free-text place, then the first valid h3 on the
// card's plannodes. Returns null when nothing resolves.
export function resolvePlace(
  p: { id?: string; place?: string; h3?: string },
  nodes: PlanNode[] = [],
): GeoPoint | null {
  if (p.h3 && isValidCell(p.h3)) {
    const [lat, lon] = cellToLatLng(p.h3);
    return { lat, lon, h3: p.h3 };
  }
  if (p.place) {
    const g = gazetteerLookup(p.place);
    if (g) return { ...g, h3: latLngToCell(g.lat, g.lon, 5) };
  }
  const mine = nodes.filter((n) => n.possibilityId === p.id && n.h3);
  const cell = mine.find((n) => n.h3 && isValidCell(n.h3))?.h3;
  if (cell) {
    const [lat, lon] = cellToLatLng(cell);
    return { lat, lon, h3: cell };
  }
  return null;
}
