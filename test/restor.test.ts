import { describe, expect, it } from 'vitest';
import {
  parseRestorSitemap, extractRestorSite, extractRestorCarbon,
  restorCentroid, fromRestorSites, fetchRestorSite, fetchRestorSitemap,
  restorLastError, type RestorSite,
} from '../src/adapters/restor.ts';
import { readFileSync } from 'node:fs';

const SITEMAP = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://restor.eco/sites/b9131179-80d5-4d46-a3d6-dbcfbad7d56a/</loc><lastmod>2026-03-20T14:35:49.818Z</lastmod><xhtml:link rel="alternate" hreflang="id"/></url>
<url><loc>https://restor.eco/sites/b98c0795-4d35-4511-b917-fa7c1e0bbf88/</loc><lastmod>2025-06-10T10:21:39.802Z</lastmod></url>
</urlset>`;

const site: RestorSite = {
  id: 'b9131179-80d5-4d46-a3d6-dbcfbad7d56a',
  name: 'INAB_2025_487_JALAPA', description: 'Sustainable land management in JALAPA',
  polygon: { type: 'MultiPolygon', coordinates: [[[[-90.04, 14.73], [-90.05, 14.74], [-90.05, 14.73]]]] },
  boundingBox: { top: 14.74, right: -90.04, bottom: 14.73, left: -90.05 },
  siteType: 'SUSTAINABLE_LAND_MANAGEMENT', siteVisibility: 'PUBLIC',
  surfaceAreaKm2: 0.0248, countryCode: 'GT', interventionStartYear: 2025,
  stage: 'ONGOING', goals: ['PROVIDING_EMPLOYMENT'],
  supportSought: ['FUNDING', 'MONITORING'],
  website: null, certificates: [],
  createdAt: '2026-03-20T00:00:00Z', updatedAt: '2026-03-20T00:00:00Z',
};

const RSC_PAGE = `<html><script>self.__next_f.push([1,"32:[\\"$\\",\\"$L27\\",null,{\\"state\\":{\\"data\\":{\\"id\\":\\"b9131179-80d5-4d46-a3d6-dbcfbad7d56a\\",\\"name\\":\\"INAB_2025_487\\",\\"boundingBox\\":{\\"top\\":14.74,\\"right\\":-90.04,\\"bottom\\":14.73,\\"left\\":-90.05},\\"siteType\\":\\"SLM\\",\\"supportSought\\":[\\"FUNDING\\"]},\\"queryKey\\":[\\"site\\",\\"b9131179-80d5-4d46-a3d6-dbcfbad7d56a\\"]}"])\\n" ])</script>
<script>self.__next_f.push([1,"{\\"carbon\\":{\\"current\\":{\\"data\\":{\\"value\\":845.2,\\"unitOfMeasure\\":\\"TONNES\\"}}}}"])</script></html>`;

const fetchText = (body: string, ok = true) =>
  (() => Promise.resolve({ ok, status: ok ? 200 : 500,
    text: () => Promise.resolve(body) })) as unknown as typeof fetch;

describe('parseRestorSitemap', () => {
  it('extracts site ids + lastmod from sitemap XML', () => {
    const rows = parseRestorSitemap(SITEMAP);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe('b9131179-80d5-4d46-a3d6-dbcfbad7d56a');
    expect(rows[0]!.lastmod).toContain('2026-03-20');
  });
});

describe('extractRestorSite', () => {
  it('parses the RSC-embedded site object', () => {
    const s = extractRestorSite(RSC_PAGE, 'b9131179-80d5-4d46-a3d6-dbcfbad7d56a');
    expect(s?.name).toBe('INAB_2025_487');
    expect(s?.boundingBox?.top).toBe(14.74);
  });
  it('returns null when the site query is absent', () => {
    expect(extractRestorSite('<html>no data</html>', 'x')).toBeNull();
  });
  it('extractRestorCarbon reads the carbon query', () => {
    expect(extractRestorCarbon(RSC_PAGE)?.current?.data?.value).toBe(845.2);
  });
});

describe('restorCentroid', () => {
  it('prefers boundingBox center', () => {
    const c = restorCentroid(site)!;
    expect(c.lat).toBeCloseTo(14.735); expect(c.lng).toBeCloseTo(-90.045);
  });
  it('falls back to polygon ring average', () => {
    const c = restorCentroid({ ...site, boundingBox: null })!;
    expect(c.lat).toBeCloseTo(14.733, 2);
  });
});

describe('fromRestorSites', () => {
  it('site → action node w/ h3 + stage/goal tags; supportSought → need nodes', () => {
    const plan = fromRestorSites([site]);
    const action = plan.nodes.find((n) => n.id.endsWith('-site'))!;
    expect(action.h3).toMatch(/^[0-9a-f]{15}$/);
    expect(action.tags).toContain('stage:ONGOING');
    expect(action.tags).toContain('country:GT');
    const needs = plan.nodes.filter((n) => n.kind === 'need');
    expect(needs).toHaveLength(2);
    expect(needs.find((n) => n.capital === 'financial')!.id).toContain('funding');
    expect(needs.find((n) => n.capital === 'intellectual')!.id).toContain('monitoring');
  });
});

describe('fetchers', () => {
  it('fetchRestorSite extracts site+carbon', async () => {
    const r = await fetchRestorSite('b9131179-80d5-4d46-a3d6-dbcfbad7d56a', fetchText(RSC_PAGE));
    expect(r?.site.id).toBe('b9131179-80d5-4d46-a3d6-dbcfbad7d56a');
    expect(r?.carbon?.current?.data?.value).toBe(845.2);
  });
  it('fetchRestorSitemap parses entries; 404 → []', async () => {
    const rows = await fetchRestorSitemap(0, fetchText(SITEMAP));
    expect(rows).toHaveLength(2);
    const gone = await fetchRestorSitemap(999,
      (() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })) as unknown as typeof fetch);
    expect(gone).toEqual([]);
  });
  it('http error → null + lastError', async () => {
    expect(await fetchRestorSite('x', fetchText('', false))).toBeNull();
    expect(restorLastError()).toContain('http');
  });
});
