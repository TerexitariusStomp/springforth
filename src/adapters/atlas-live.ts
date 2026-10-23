// Live integration with the public envhealth-atlas deployment
// (envhealth-atlas.pages.dev — static per-date res-3 value files +
// prebuilt intervention-priority rows; no auth, CC/Apache data).
// fetch is injectable so tests and non-Worker runtimes can substitute.

export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface AtlasLiveClient {
  /** Date-keyed hazard props for the res-3 parent of `h3`: [score, ehf, heat_streak, smoke_episode_days, pm_dose_30d]. */
  hazard(h3: string): Promise<{ date: string; cell: string; score: number; ehf: number; heatStreak: number; smokeDays: number; pmDose30d: number } | null>;
  /** Top intervention-opportunity rows, optionally filtered by country (ISO-2) or res-3 cell. */
  priorities(filter?: { country?: string; h3?: string; limit?: number }): Promise<AtlasPriority[]>;
}

export interface AtlasPriority {
  intervention_id: string; name: string; country: string; h3: string;
  pop: number; benefit_per_1000usd: number; benefit_rate: number;
  evidence_grade: string; mission_kind: string;
}

// H3 index → res-r parent: resolution lives in bits 52–55; child digits
// occupy 3 bits each (digit d at bits 3*(15-d)); unused digits are 0b111.
export function h3Parent(h3: string, res: number): string {
  let i = BigInt(`0x${h3}`);
  i = (i & ~(0xfn << 52n)) | (BigInt(res) << 52n);
  for (let d = res + 1; d <= 15; d++) {
    const s = BigInt(3 * (15 - d));
    i = (i & ~(0x7n << s)) | (0x7n << s);
  }
  return i.toString(16);
}

export function liveAtlas(
  baseUrl = 'https://envhealth-atlas.pages.dev',
  fetchImpl: FetchFn = fetch as unknown as FetchFn,
): AtlasLiveClient {
  const memo = new Map<string, Promise<unknown>>();
  const j = (path: string) => {
    if (!memo.has(path)) memo.set(path, fetchImpl(`${baseUrl}/${path}`).then((r) => (r.ok ? r.json() : null)));
    return memo.get(path)!;
  };
  const dates = async () => {
    const m = await j('data/tiles/manifest.json') as { animated?: Record<string, { dates?: string[] }> } | null;
    return m?.animated?.['hazard__score']?.dates ?? [];
  };
  return {
    async hazard(h3) {
      const cell = h3Parent(h3, 3);
      for (const d of (await dates()).slice(-5).reverse()) {
        const v = await j(`data/values/hazard_${d}.json`) as Record<string, number[]> | null;
        const row = v?.[cell];
        if (row) {
          const [score = 0, ehf = 0, heatStreak = 0, smokeDays = 0, pmDose30d = 0] = row;
          return { date: d, cell, score, ehf, heatStreak, smokeDays, pmDose30d };
        }
      }
      return null;
    },
    async priorities(filter = {}) {
      const d = await j('data/api/org/priorities.json') as { rows?: AtlasPriority[] } | null;
      const res3 = filter.h3 ? h3Parent(filter.h3, 3) : undefined;
      return (d?.rows ?? [])
        .filter((r) => (!filter.country || r.country === filter.country) && (!res3 || h3Parent(r.h3, 3) === res3))
        .slice(0, filter.limit ?? 50);
    },
  };
}
