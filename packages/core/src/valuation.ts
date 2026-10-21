// Monetary valuation of coordinated effort — derived, never recorded.
// Mentor guidance (treasury lane): environmental/climate units only land
// with funders when expressed as risk, cost, or value creation in money.
// Every figure this module produces is one of three things:
//   1. ledger-derived  — donations / match allocations on record
//   2. declared        — participant hours, node budgets (self-reported)
//   3. cited estimate  — external benchmarks passed in with their source
// Nothing is invented: uncited inputs are simply absent from the output.
// Multi-currency by design: totals are kept per ISO currency and never
// converted — conversion would require an FX source we don't carry.

export interface Money { amount: number; currency: string }

export interface Benchmark {
  // e.g. { key: 'GB', hourRate: 14.43, currency: 'GBP',
  //        source: 'ONS Household Satellite Accounts (2017)',
  //        riskPerHome: 30000, riskSource: 'Environment Agency / ABI (2025)' }
  key: string;
  hourRate: number;
  currency: string;
  source: string;
  riskPerHome?: number;                  // cited avg loss per flooded home
  riskSource?: string;                   // provenance for riskPerHome
}

export interface ValuationInput {
  hours: number[];                       // participant-declared hours
  donations: Money[];                    // pledged toward this card's needs
  matched: Money[];                      // matching-fund allocation
  inKind: Money[];                       // declared budgets on offer nodes
  needsCost: Money[];                    // declared budgets on need nodes (cost of the ask)
  householdsProtected?: number;          // declared homes the action protects
  benchmark?: Benchmark;                 // volunteer-hour rate for the place
}

export interface CurrencyValue {
  committed: number;                     // donations on record
  matched: number;                       // match allocated
  inKind: number;                        // declared in-kind budgets
  volunteerTime: number;                 // declared hours × cited rate
  total: number;
  asked: number;                         // declared cost of open needs — outside total
  riskAvoided: number;                   // homes × cited per-home damage — outside total
}

export interface Valuation {
  byCurrency: Record<string, CurrencyValue>;
  hoursTotal: number;
  method: string[];                      // provenance line per component
}

const bump = (acc: Record<string, CurrencyValue>, cur: string) =>
  (acc[cur] ??= { committed: 0, matched: 0, inKind: 0, volunteerTime: 0, total: 0, asked: 0, riskAvoided: 0 });

const r2 = (n: number) => Math.round(n * 100) / 100;

export function valueCoordinated(i: ValuationInput): Valuation {
  const by: Record<string, CurrencyValue> = {};
  for (const d of i.donations) bump(by, d.currency).committed += d.amount;
  for (const m of i.matched) bump(by, m.currency).matched += m.amount;
  for (const k of i.inKind) bump(by, k.currency).inKind += k.amount;
  for (const n of i.needsCost) bump(by, n.currency).asked += n.amount;

  const hoursTotal = r2(i.hours.reduce((a, b) => a + b, 0));
  const method: string[] = [];
  if (i.donations.length) method.push('committed — donations on the ledger');
  if (i.matched.length) method.push('matched — matching-fund allocation');
  if (i.inKind.length) method.push('in-kind — declared offer budgets');
  if (i.needsCost.length) method.push('asked — declared need budgets (cost, not yet covered)');
  if (hoursTotal > 0 && i.benchmark) {
    const v = bump(by, i.benchmark.currency);
    v.volunteerTime = r2(hoursTotal * i.benchmark.hourRate);
    method.push(`volunteer time — ${r2(hoursTotal)}h declared × ` +
      `${i.benchmark.currency} ${i.benchmark.hourRate}/h (${i.benchmark.source})`);
  } else if (hoursTotal > 0) {
    method.push(`${r2(hoursTotal)}h declared — no cited local rate available`);
  }
  // Risk frame — declarer-stated households × cited per-home damage avg.
  // An estimate of losses the action mitigates, never part of `total`.
  if (i.householdsProtected && i.benchmark?.riskPerHome) {
    const v = bump(by, i.benchmark.currency);
    v.riskAvoided = r2(i.householdsProtected * i.benchmark.riskPerHome);
    method.push(`risk mitigated — ${i.householdsProtected} homes declared × ` +
      `${i.benchmark.currency} ${i.benchmark.riskPerHome}/home (${i.benchmark.riskSource})`);
  } else if (i.householdsProtected) {
    method.push(`${i.householdsProtected} homes declared protected — no cited damage rate available`);
  }
  for (const v of Object.values(by))
    v.total = r2(v.committed + v.matched + v.inKind + v.volunteerTime);
  return { byCurrency: by, hoursTotal, method };
}
