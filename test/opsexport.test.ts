import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildOpsExport, pseudonym, OPS_EXPORT_SPEC } from '../src/opsexport.ts';
import type { OpsExportInput } from '../src/opsexport.ts';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const T = '2026-10-20T00:00:00.000Z';

function fixture(): OpsExportInput {
  return {
    possibilities: [
      { id: 'poss-a', title: 'Plant mangroves', declarerId: 'aisha',
        minParticipants: 2, status: 'quorum', quorumAt: '2026-10-22T00:00:00.000Z',
        deadline: '2026-10-25T00:00:00.000Z', place: 'Mida Creek', createdAt: T,
        report: { summary: 'done', evidence: 'ipfs://film1', learnings: '', at: '2026-10-24T00:00:00.000Z' } },
      { id: 'poss-b', title: 'Beach cleanup', declarerId: 'biko',
        minParticipants: 3, status: 'active', createdAt: '2026-10-21T00:00:00.000Z' },
    ] as OpsExportInput['possibilities'],
    participations: [
      { id: 'part-1', possibilityId: 'poss-a', actor: 'biko', at: '2026-10-21T00:00:00.000Z', bringingNodeId: 'node-offer-1' },
      { id: 'part-2', possibilityId: 'poss-a', actor: 'chi', at: '2026-10-21T12:00:00.000Z' },
      { id: 'part-3', possibilityId: 'poss-a', actor: 'duma', at: '2026-10-23T00:00:00.000Z' }, // after quorum — excluded from committed
      { id: 'part-4', possibilityId: 'poss-b', actor: 'aisha', at: '2026-10-22T00:00:00.000Z' },
    ] as OpsExportInput['participations'],
    linkedNodes: [
      { id: 'node-need-1', kind: 'need', label: 'boats', canonical: 'boats', source: 'manual', possibilityId: 'poss-a', required: true, category: 'equipment' },
      { id: 'node-offer-1', kind: 'offer', label: 'transport', canonical: 'transport', source: 'manual', possibilityId: 'poss-a' },
      { id: 'node-free', kind: 'need', label: 'unlinked', canonical: 'unlinked', source: 'manual' },
    ] as OpsExportInput['linkedNodes'],
    appreciations: [
      { id: 'ap-1', fromActor: 'aisha', toActor: 'biko', possibilityId: 'poss-a', at: '2026-10-24T00:00:00.000Z' },
      { id: 'ap-2', fromActor: 'aisha', toActor: 'biko', possibilityId: 'poss-a', at: '2026-10-24T01:00:00.000Z' }, // dup pair — deduped
      { id: 'ap-3', fromActor: 'biko', toActor: 'aisha', possibilityId: 'poss-a', at: '2026-10-24T02:00:00.000Z' },
    ] as OpsExportInput['appreciations'],
    attestations: [
      { id: 'att-1', nodeId: 'node-need-1', attester: 'chi', schemaRef: 'springforth.outcome.v1', payload: '{}', at: '2026-10-24T03:00:00.000Z' },
    ] as OpsExportInput['attestations'],
    checks: [
      { id: 'chk-1', nodeId: 'node-need-1', source: 'field-evidence', domain: 'environmental',
        result: 'match', score: 0.9, detail: 'filmed planting', at: '2026-10-24T04:00:00.000Z' },
    ] as OpsExportInput['checks'],
    forumEvidence: [
      { id: 'fp-1', possibilityId: 'poss-a', actor: 'chi', kind: 'evidence', text: 'photo set', at: '2026-10-24T05:00:00.000Z' },
    ] as OpsExportInput['forumEvidence'],
    claims: [
      { id: 'clm-1', possibilityId: 'poss-a', nodeIds: [], workScope: 'mangrove planting',
        timeframe: {}, contributors: [], oracleCheckIds: [], appreciationIds: [],
        artifactRefs: ['ipfs://artifact-9'], state: 'attested', createdAt: '2026-10-24T06:00:00.000Z' },
    ] as OpsExportInput['claims'],
    pledges: [
      { id: 'plg-1', possibilityId: 'poss-a', pledger: 'duma', amount: 50, currency: 'USD', state: 'bound', stateAt: '2026-10-22T00:00:00.000Z' },
    ] as OpsExportInput['pledges'],
    donations: [
      { id: 'don-1', roundId: 'r-1', needNodeId: 'node-need-1', donor: 'biko', amount: 10, currency: 'USD', settlement: 'settled', settlementRef: 'tx:1', at: '2026-10-23T00:00:00.000Z' },
    ] as OpsExportInput['donations'],
    streams: [
      { id: 'str-1', roundId: 'r-1', supporter: 'aisha', token: '0xabc',
        receiver: '0x' + '0'.repeat(40), flowRate: '100', accruedUnits: '500',
        state: 'active', createdAt: '2026-10-20T00:00:00.000Z' },
    ] as OpsExportInput['streams'],
    yields: [
      { id: 'yld-1', roundId: 'r-1', sponsor: 'duma', holderAddress: '0x' + '1'.repeat(40),
        tokenAddress: '0x' + '2'.repeat(40), yieldAccrued: 12.5, state: 'active',
        createdAt: T, updatedAt: '2026-10-24T00:00:00.000Z' },
    ] as OpsExportInput['yields'],
    rounds: [
      { id: 'r-1', title: 'Kilifi match', description: '', sponsorIds: [],
        matchingFund: { amount: 100, currency: 'USD' }, eligibleNeedIds: [],
        opensAt: T, closesAt: '2026-10-30T00:00:00.000Z', state: 'open',
        matchingMode: 'lr', conviction: false, acceptedTokens: {}, endowment: false },
    ] as OpsExportInput['rounds'],
    head: { seq: 42, hash: 'f'.repeat(64) },
    generatedAt: '2026-10-24T12:00:00.000Z',
  };
}

const linesOf = (body: string) => body.split('\n').filter(Boolean)
  .map((l) => JSON.parse(l) as Record<string, unknown>);

describe('ops export', () => {
  it('emits parseable NDJSON with the manifest last', () => {
    const { body } = buildOpsExport(fixture());
    expect(body.endsWith('\n')).toBe(true);
    expect(body).not.toContain('\r');
    const lines = linesOf(body);
    const manifest = lines.at(-1)!;
    expect(manifest.type).toBe('manifest');
    expect(manifest.spec).toBe(OPS_EXPORT_SPEC);
    expect(lines.every((l) => typeof l.type === 'string')).toBe(true);
  });

  it('file_sha256 recomputes over every line before the manifest (sed $d)', () => {
    const { body, manifest } = buildOpsExport(fixture());
    const parts = body.split('\n');           // […records, manifest, '']
    expect(parts.at(-1)).toBe('');            // file ends with a newline
    const payload = parts.slice(0, -2).join('\n') + '\n';  // = sed '$d' body
    expect(sha(payload)).toBe(manifest.file_sha256);
    expect(JSON.parse(parts.at(-2)!)).toEqual(manifest);   // manifest is last line
  });

  it('carries the ledger head at the cut', () => {
    const { manifest } = buildOpsExport(fixture());
    expect(manifest.cut).toEqual({ seq: 42, ledger_head: 'f'.repeat(64) });
  });

  it('pseudonymizes actors — stable, distinct, raw ids absent', () => {
    const { body } = buildOpsExport(fixture());
    for (const raw of ['aisha', 'biko', 'chi', 'duma'])
      expect(body).not.toContain(`"${raw}"`);   // quoted token — 'chi' legitimately sits inside 'matching_fund'
    expect(pseudonym('aisha')).toBe(pseudonym('aisha'));
    expect(pseudonym('aisha')).not.toBe(pseudonym('biko'));
    expect(pseudonym('aisha')).toMatch(/^a_[0-9a-f]{16}$/);
    expect(pseudonym('aisha', 'other-salt')).not.toBe(pseudonym('aisha'));
  });

  it('quorum committed set excludes post-activation joins', () => {
    const lines = linesOf(buildOpsExport(fixture()).body);
    const q = lines.find((l) => l.type === 'quorum')!;
    expect(q.activated_at).toBe('2026-10-22T00:00:00.000Z');
    // declarer + biko + chi joined before quorumAt; duma joined after.
    expect(q.committed).toHaveLength(3);
  });

  it('dedupes attestation edges to one per pair', () => {
    const lines = linesOf(buildOpsExport(fixture()).body);
    const app = lines.filter((l) => l.type === 'attestation_edge' && l.via === 'appreciation');
    expect(app).toHaveLength(2); // aisha→biko (earliest kept) + biko→aisha
    expect(app[0]!.id).toBe('ap-1');
  });

  it('counts in the manifest match emitted lines', () => {
    const { body, manifest } = buildOpsExport(fixture());
    const lines = linesOf(buildOpsExport(fixture()).body);
    expect(manifest.records).toBe(lines.length - 1);
    for (const [type, n] of Object.entries(manifest.counts as Record<string, number>))
      expect(lines.filter((l) => l.type === type)).toHaveLength(n);
    expect(body).toContain('"type":"declaration"');
  });

  it('emits a revshare lane only when settled donations accrue skim', () => {
    const i = fixture();
    const zero = buildOpsExport(i).body;
    expect(zero).not.toContain('"lane":"revshare"');
    i.rounds = [{ ...i.rounds[0], skimBps: 1000 }];
    const lines = buildOpsExport(i).body.split('\n').filter(Boolean).map(JSON.parse);
    const rs = lines.find((l) => l.lane === 'revshare');
    expect(rs).toBeDefined();
    expect(rs.amount).toBe(1); // $10 settled × 1000bps
    const mf = lines.find((l) => l.lane === 'matching_fund');
    expect(mf.skimBps).toBe(1000);
    expect(mf.upstreamSplitBps).toBe(0);
  });

  it('is deterministic — same cut, same file_sha256', () => {
    const a = buildOpsExport(fixture());
    const b = buildOpsExport(fixture());
    expect(a.manifest.file_sha256).toBe(b.manifest.file_sha256);
    expect(a.body).toBe(b.body);
  });
});
