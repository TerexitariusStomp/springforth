import type { OracleCheck } from '@springforth/core';

// Evidence trajectory — forecasting-lite, deliberately not actuarial.
// Replaces the removed projection engine with the simplest honest view:
// readings over time against the node's baseline, a linear trend, and a
// naive crossing estimate. Display math for review, not a model of the
// world — humans still verify.

export interface Trajectory {
  nodeId: string;
  points: { at: string; score: number; result: string; source: string }[];
  // least-squares slope of score over days (positive = improving)
  slopePerDay: number;
  firstScore: number;
  lastScore: number;
  // naive: days until trend crosses the `threshold` — null if the trend
  // isn't heading that way or there's nothing to project from.
  daysToThreshold: number | null;
  readings: number;
}

export function trajectory(
  nodeId: string, checks: (OracleCheck & { nodeId?: string })[],
  threshold = 0.5,
): Trajectory {
  const pts = checks
    .filter((c) => c.nodeId === nodeId)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((c) => ({ at: c.at, score: c.score, result: c.result, source: c.source }));
  const n = pts.length;
  if (n < 2) {
    return {
      nodeId, points: pts, slopePerDay: 0,
      firstScore: pts[0]?.score ?? 0, lastScore: pts.at(-1)?.score ?? 0,
      daysToThreshold: null, readings: n,
    };
  }
  const t0 = Date.parse(pts[0]!.at);
  const xs = pts.map((p) => (Date.parse(p.at) - t0) / 86_400_000);
  const ys = pts.map((p) => p.score);
  const mx = xs.reduce((a, x) => a + x, 0) / n, my = ys.reduce((a, y) => a + y, 0) / n;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const slope = num / den;
  const last = ys[n - 1]!;
  const daysToThreshold = slope > 1e-9 && last < threshold
    ? Math.round((threshold - last) / slope * 10) / 10
    : slope < -1e-9 && last > threshold
      ? Math.round((threshold - last) / slope * 10) / 10
      : null;
  return {
    nodeId, points: pts, slopePerDay: Math.round(slope * 10000) / 10000,
    firstScore: ys[0]!, lastScore: last, daysToThreshold, readings: n,
  };
}

// Evidence-weighted allocation — the funding flywheel nobody else has:
// a need whose trajectory is corroborated by open evidence earns a
// modestly higher match weight; declining evidence modestly lowers it.
// Deliberately narrow (0.8–1.2) — evidence nudges allocation, never
// overrides donor breadth. No readings → neutral 1.0.
export function evidenceBoost(
  nodeId: string, checks: (OracleCheck & { nodeId?: string })[],
): number {
  const t = trajectory(nodeId, checks);
  if (t.readings === 0) return 1;
  const base = 0.8 + 0.4 * Math.min(1, Math.max(0, t.lastScore));
  const trend = Math.max(-0.05, Math.min(0.05, t.slopePerDay * 30));
  return Math.round(Math.min(1.2, Math.max(0.8, base + trend)) * 1000) / 1000;
}
