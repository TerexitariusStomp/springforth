import { describe, expect, it } from 'vitest';
import { fromJson } from '../src/adapters/holons.ts';
import { detectComplements, isNeed } from '../src/coordination';

const EXPORT = {
  holon: { id: 'liminal', name: 'Liminal Village', purpose: 'Regenerative coliving' },
  members: [
    { id: 'roberto', name: 'Roberto', appreciations: 4 },
    { id: 'laura', name: 'Laura' },
  ],
  items: [
    { id: '1', type: 'offer', title: 'Yoga sessions on Tuesday mornings',
      actor: 'laura', terms: 'donation-based', capital: 'experiential',
      createdAt: '2026-10-01T00:00:00Z' },
    { id: '2', type: 'request', title: 'Someone to drive the truck on Friday',
      actor: 'roberto', place: 'Liminal', deadline: '2026-10-24',
      createdAt: '2026-10-10T00:00:00Z' },
    { id: '3', type: 'task', title: 'We need tools for the repair cafe',
      actor: 'roberto', createdAt: '2026-10-12T00:00:00Z' },
    { type: 'appreciation', title: 'thanks', actor: 'roberto', target: 'laura' },
    { id: '5', type: 'expense', title: 'Compost delivery', amount: 120,
      currency: 'EUR', createdAt: '2026-10-11T00:00:00Z' },
  ],
};

describe('holons-adapter', () => {
  const plan = fromJson(EXPORT, 'holons:test');

  it('maps the holon to a framework node (the membrane)', () => {
    const h = plan.nodes.find((n) => n.kind === 'framework');
    expect(h?.label).toBe('Liminal Village');
    expect(h?.tags).toContain('holon');
  });

  it('maps offer → offer node and request → need node with deadline+owner', () => {
    const offer = plan.nodes.find((n) => n.kind === 'offer');
    const need = plan.nodes.find((n) => n.kind === 'need');
    expect(offer?.terms).toBe('donation-based');
    expect(offer?.capital).toBe('experiential'); // 8-forms tracking
    expect(offer?.orgIds).toEqual(['holons-liminal-member-laura']);
    expect(need?.timeframe.to).toBe('2026-10-24');
    expect(need?.orgIds).toEqual(['holons-liminal-member-roberto']);
  });

  it('maps tasks and expenses to action nodes; verb-need is resolver-promoted', () => {
    const actions = plan.nodes.filter((n) => n.kind === 'action');
    expect(actions.length).toBe(2);
    const repairTask = actions.find((a) => a.label.includes('repair cafe'))!;
    expect(isNeed(repairTask)).toBe(true);          // "we need tools…"
    expect(actions.find((a) => a.label === 'Compost delivery')?.budget).toBe(120);
  });

  it('aggregates appreciations onto member nodes', () => {
    const laura = plan.nodes.find((n) => n.id === 'holons-liminal-member-laura')!;
    expect(laura.kind).toBe('organisation');
    expect(laura.tags).toContain('appreciations:1');
    expect(laura.description).toContain('1 appreciations');
    const roberto = plan.nodes.find((n) => n.id === 'holons-liminal-member-roberto')!;
    expect(roberto.tags).toContain('appreciations:4');
  });

  it('holons requests match external offers in detectComplements', () => {
    const otherOffer = {
      id: 'ext-offer-truck', kind: 'offer' as const, label: 'Truck driving volunteer',
      canonical: 'truck driving volunteer driver', source: 'other:src',
      orgIds: [], tags: [], timeframe: {}, placeId: 'liminal',
      description: 'I drive trucks for community moves',
    };
    const recs = detectComplements([...plan.nodes, otherOffer]);
    expect(recs.some((r) => r.nodeIds[0].includes('need-2')
      && r.nodeIds[1] === 'ext-offer-truck')).toBe(true);
  });
});

describe('parseCommand — the bot lane without a bot', () => {
  it('parses /offer with terms and capital sections', async () => {
    const { parseCommand } = await import('../src/adapters/holons.ts');
    const item = parseCommand('/offer Yoga on Tuesdays :: donation-based :: experiential', 'laura')!;
    expect(item.type).toBe('offer');
    expect(item.title).toBe('Yoga on Tuesdays');
    expect(item.terms).toBe('donation-based');
    expect(item.capital).toBe('experiential');
  });
  it('parses /request with @target and deadline', async () => {
    const { parseCommand } = await import('../src/adapters/holons.ts');
    const item = parseCommand('/request Someone to drive the truck by 2026-10-24', 'roberto')!;
    expect(item.type).toBe('request');
    expect(item.deadline).toBe('2026-10-24');
  });
  it('parses /appreciate with a target', async () => {
    const { parseCommand } = await import('../src/adapters/holons.ts');
    const item = parseCommand('/appreciate @laura for organising', 'roberto')!;
    expect(item.type).toBe('appreciation');
    expect(item.target).toBe('laura');
  });
  it('parses /join as a participation declaration', async () => {
    const { parseCommand } = await import('../src/adapters/holons.ts');
    const item = parseCommand('/join poss-x bringing a tent', 'roberto')!;
    expect(item.type).toBe('join');
    expect(item.target).toBe('poss-x');
    expect(item.title).toContain('a tent');
  });
  it('parses /pass as a dismissal', async () => {
    const { parseCommand } = await import('../src/adapters/holons.ts');
    const item = parseCommand('/pass poss-x', 'roberto')!;
    expect(item.type).toBe('pass');
    expect(item.target).toBe('poss-x');
  });
  it('returns null on non-command text', async () => {
    const { parseCommand } = await import('../src/adapters/holons.ts');
    expect(parseCommand('just chatting', 'roberto')).toBeNull();
  });
  it('composite possibility block generates possibilityId-linked nodes', () => {
    const withPoss = fromJson({
      ...EXPORT,
      possibility: {
        title: 'Beach cleanup', declarer: 'roberto',
        deadline: '2026-11-01T00:00:00Z', minParticipants: 4,
        needs: [{ title: 'Gloves', required: true }],
        bringing: [{ title: 'Truck' }],
      },
    }, 'holons:test');
    const needs = withPoss.nodes.filter(
      (n) => n.possibilityId === 'poss-beach-cleanup' && n.kind === 'need');
    expect(needs).toHaveLength(1);
    expect(needs[0].required).toBe(true);
    expect(needs[0].orgIds).toEqual(['holons-liminal-member-roberto']);
    const bringing = withPoss.nodes.filter(
      (n) => n.possibilityId === 'poss-beach-cleanup' && n.kind === 'offer');
    expect(bringing).toHaveLength(1);
  });
});
