import { describe, expect, it } from 'vitest';
import { PlanNode } from '../src/coordination';
import { pushNodesWith } from '../src/adapters/oneplanet/mcp.ts';

const node = (id: string, kind: string, label = `L ${id}`) =>
  PlanNode.parse({ id, kind: kind as never, label, canonical: label.toLowerCase(), source: 'test' });

const fakeMcp = (result: unknown = { uuid: 'oai-123' }) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    async callTool(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (result instanceof Error) throw result;
      return result;
    },
  };
};

describe('pushNodesWith', () => {
  it('maps kinds to create_* tools and records returned uuids', async () => {
    const m = fakeMcp({ uuid: 'u-1' });
    const r = await pushNodesWith(m, 'plan-uuid', [
      node('n1', 'outcome'), node('n2', 'need'), node('n3', 'offer'),
      node('n4', 'indicator'), node('n5', 'framework'),
    ]);
    expect(m.calls.map((c) => c.name)).toEqual([
      'create_outcome', 'create_action', 'create_action',
      'create_indicator', 'create_outcome',
    ]);
    expect(r.every((x) => x.oaiUuid === 'u-1')).toBe(true);
    expect(m.calls[0]!.args.plan_uuid).toBe('plan-uuid');
    expect(String(m.calls[1]!.args.description)).toContain('[springforth need]');
    expect(String(m.calls[1]!.args.description)).toContain('node: n2');
  });
  it('skips kinds with no OAI counterpart', async () => {
    const m = fakeMcp();
    const r = await pushNodesWith(m, 'p', [node('o1', 'organisation'), node('p1', 'place')]);
    expect(m.calls).toHaveLength(0);
    expect(r.map((x) => x.skipped)).toBeTruthy();
    expect(r[0]!.skipped).toContain('organisation');
  });
  it('captures tool errors per node without aborting the batch', async () => {
    const m = fakeMcp(new Error('mcp tool error: nope'));
    const r = await pushNodesWith(m, 'p', [node('a', 'action'), node('b', 'outcome')]);
    expect(r.map((x) => x.error)).toHaveLength(2);
    expect(r[0]!.tool).toBe('create_action');
  });
  it('truncates description to the 800-char API cap', async () => {
    const m = fakeMcp();
    const n = PlanNode.parse({ id: 'x', kind: 'action', label: 'L',
      canonical: 'l', source: 't', description: 'd'.repeat(2000) });
    await pushNodesWith(m, 'p', [n]);
    expect(String(m.calls[0]!.args.description).length).toBeLessThanOrEqual(800);
  });
});
