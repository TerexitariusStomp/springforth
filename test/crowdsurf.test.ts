// Crowd-surfing layer — the mechanics the origin transcript adds on top
// of the card loop: engaged-curiosity questions, the decision matrix,
// referrals, interest intensity, compost, constellation, facilitation,
// the design brief, test cards, and the ecocycle.
import { describe, expect, it } from 'vitest';
import {
  Interest, Question, CouncilDecision, DecisionMode, Referral,
  Possibility, TestCard,
} from '../src/core';
import { renderPossibilitiesPage, type CardConnections } from '../src/portal/possibilities.ts';
import { STRUCTURE_PHASES } from '../src/data/structures.ts';
import { ecocycleStage, ecocycleTraps, ecocycleSvg, ECOCYCLE_STAGES } from '../src/data/ecocycle.ts';
import { enactments, enactmentStats } from '../src/data/knowledge.ts';
import { renderActorProfile } from '../src/portal/actor.ts';
import en from '../src/portal/strings/en.json';

const iso = '2026-10-20T00:00:00Z';
const base = {
  id: 'p1', title: 'Plant mangroves at Mida Creek', description: 'x',
  declarerId: 'aisha', place: 'Mida Creek', deadline: '2026-11-01T00:00:00Z',
  minParticipants: 3, status: 'active' as const, createdAt: iso,
};
const card = (over: Record<string, unknown> = {}) => ({
  ...base, score: 0.5,
  scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
  participantCount: 2, needs: [], bringing: [],
  quorum: { met: false, required: 3, requiredMet: 0 },
  ...over,
});
const conn = (over: Partial<CardConnections> = {}): CardConnections => ({
  overlapCount: 0, rounds: [], committed: {}, pledges: 0, hasReport: false,
  ...over,
});

describe('Interest.level — "how juiced am I" (1–3, optional)', () => {
  it('accepts a plain interest and each intensity level', () => {
    const i = Interest.parse({ id: 'i1', possibilityId: 'p1', actor: 'priya', at: iso });
    expect(i.level).toBeUndefined();
    for (const level of [1, 2, 3])
      expect(Interest.parse({ id: 'i1', possibilityId: 'p1', actor: 'p', level, at: iso }).level).toBe(level);
  });
  it('rejects out-of-range and fractional levels', () => {
    for (const level of [0, 4, 2.5])
      expect(() => Interest.parse({ id: 'i1', possibilityId: 'p1', actor: 'p', level, at: iso })).toThrow();
  });
});

describe('Question — the engaged-curiosity index', () => {
  it('starts open; an answer lands on the record', () => {
    const q = Question.parse({ id: 'q1', possibilityId: 'p1', actor: 'priya',
      text: 'who owns the boat?', at: iso });
    expect(q.state).toBe('open');
    const answered = Question.parse({ ...q, state: 'answered',
      answer: { actor: 'aisha', text: 'the women\'s group', at: iso } });
    expect(answered.answer?.actor).toBe('aisha');
  });
  it('requires text — no empty questions', () => {
    expect(() => Question.parse({ id: 'q1', possibilityId: 'p1', actor: 'p', text: '', at: iso })).toThrow();
  });
});

describe('CouncilDecision — the decision matrix', () => {
  it('admits exactly the four modes from the matrix', () => {
    expect(DecisionMode.options).toEqual(['consent', 'advice', 'duocracy', 'empowered']);
  });
  it('opens with an empty response log; responses are attributed', () => {
    const d = CouncilDecision.parse({ id: 'd1', possibilityId: 'p1',
      title: 'share the boat across tides', mode: 'consent', proposer: 'aisha', createdAt: iso });
    expect(d.state).toBe('open');
    expect(d.responses).toEqual([]);
    const withObj = CouncilDecision.parse({ ...d, responses: [
      { actor: 'priya', kind: 'objection', text: 'tide conflict', at: iso },
    ] });
    expect(withObj.responses[0]?.kind).toBe('objection');
  });
  it('rejects an unknown mode', () => {
    expect(() => CouncilDecision.parse({ id: 'd1', possibilityId: 'p1',
      title: 'x', mode: 'voting', proposer: 'aisha', createdAt: iso })).toThrow();
  });
});

describe('Referral — "do I know a nerd?"', () => {
  it('is attributed both ways with an optional note', () => {
    const r = Referral.parse({ id: 'r1', possibilityId: 'p1',
      fromActor: 'aisha', toActor: 'kalimbo', note: 'has the boat', at: iso });
    expect(r.toActor).toBe('kalimbo');
  });
});

describe('STRUCTURE_PHASES — facilitation picks', () => {
  it('every phase names keys that exist in the english dictionary', () => {
    for (const keys of Object.values(STRUCTURE_PHASES))
      for (const k of keys) {
        expect(en[`struct.${k}.name`], `struct.${k}.name`).toBeTruthy();
        expect(en[`struct.${k}.body`], `struct.${k}.body`).toBeTruthy();
      }
    expect(Object.keys(STRUCTURE_PHASES).sort())
      .toEqual(['building', 'completed', 'quorum']);
  });
});

describe('portal markers — the new overlay blocks', () => {
  it('renders questions + answers with ask/answer forms on a live card', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn({ questions: [
        { id: 'q1', actor: 'priya', text: 'who owns the boat?', state: 'open' },
        { id: 'q2', actor: 'kalimbo', text: 'tide window?', state: 'answered',
          answer: { actor: 'aisha', text: 'neap tide', at: iso } },
      ] }) } });
    for (const m of [
      'Open questions', 'who owns the boat?', 'tide window?', 'neap tide',
      'action="/possibilities/p1/question"',
      'action="/possibilities/p1/answer"',
      'name="questionId" value="q1"',
    ]) expect(html).toContain(m);
  });
  it('renders decisions with respond/resolve + the propose form on quorum', () => {
    const html = renderPossibilitiesPage([card({ status: 'quorum' })] as never, [], undefined,
      { connections: { p1: conn({ decisions: [
        { id: 'd1', title: 'share the boat', mode: 'consent', state: 'open',
          proposer: 'aisha', objections: 1, responses: 2 },
        { id: 'd2', title: 'morning shift', mode: 'advice', state: 'decided',
          outcome: 'aisha decides', rationale: 'she holds the tide log',
          proposer: 'priya', objections: 0, responses: 1 },
      ] }) } });
    for (const m of [
      'Council decisions', 'share the boat', 'consent', 'morning shift',
      'aisha decides', 'she holds the tide log', 'objection(s)',
      'action="/decisions/d1/respond"', 'action="/decisions/d1/resolve"',
      'action="/possibilities/p1/decide"',
    ]) expect(html).toContain(m);
  });
  it('hides the propose form before quorum but keeps the record readable', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn({ decisions: [
        { id: 'd1', title: 'x', mode: 'duocracy', state: 'decided',
          outcome: 'done', rationale: 'why', proposer: 'aisha', objections: 0, responses: 0 },
      ] }) } });
    expect(html).toContain('Council decisions');
    expect(html).not.toContain('action="/possibilities/p1/decide"');
  });
  it('renders trusted-peer suggestions + the refer form', () => {
    const html = renderPossibilitiesPage([card()] as never, [], 'priya',
      { connections: { p1: conn({ referredCount: 2,
        suggest: [{ actor: 'kalimbo', offer: 'fibreglass boat', need: 'transport' }],
        personal: { joined: false, interested: false, recognized: 0, newSince: 0, referred: 'aisha' },
      }) } });
    for (const m of [
      'Know a nerd?', 'fibreglass boat', 'transport',
      '2 referral(s)', 'action="/possibilities/p1/refer"',
      'referred by',
    ]) expect(html).toContain(m);
  });
  it('renders phase picks + heat dots + the interest level select', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn({ interestCount: 4, interestHeat: 10 }) } });
    for (const m of [
      'Play this game', '15% Solutions',
      'aria-label="interest heat 2.5"',
      'name="level"', 'action="/possibilities/p1/interest"',
    ]) expect(html).toContain(m);
    const quorum = renderPossibilitiesPage([card({ status: 'quorum' })] as never);
    expect(quorum).toContain('Purpose-to-Practice');
  });
  it('maps the new ledger kinds onto trail labels', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn({ trail: [
        { seq: 1, at: iso, actor: 'priya', kind: 'possibility.question_asked' },
        { seq: 2, at: iso, actor: 'aisha', kind: 'possibility.referred' },
        { seq: 3, at: iso, actor: 'aisha', kind: 'decision.resolved' },
        { seq: 4, at: iso, actor: 'system', kind: 'constellation.complete' },
      ] }) } });
    for (const m of ['question asked', 'someone referred',
      'council decision event', 'constellation complete'])
      expect(html).toContain(m);
  });
});

describe('Possibility.brief — the structured design brief', () => {
  it('every narrative field carries its own attribution', () => {
    const p = Possibility.parse({
      ...base,
      brief: {
        problem: { text: 'mangroves are being cut', by: 'aisha', at: iso },
        purpose: { text: 'restore the creek edge', by: 'priya', at: iso },
      },
    });
    expect(p.brief?.problem?.by).toBe('aisha');
    expect(p.brief?.purpose?.text).toContain('restore');
    expect(p.brief?.boundaries).toBeUndefined();
  });
  it('is optional — a bare declaration parses without it', () => {
    expect(Possibility.parse(base).brief).toBeUndefined();
  });
});

describe('TestCard — belief/action/measure/failure', () => {
  it('starts proposed; the four fields are required', () => {
    const t = TestCard.parse({ id: 't1', possibilityId: 'p1', actor: 'priya',
      belief: 'the women\'s group will lend the boat', action: 'ask at Tuesday market',
      measure: 'a yes or no by Friday', at: iso });
    expect(t.state).toBe('proposed');
    expect(t.failState).toBe('');
    for (const f of ['belief', 'action', 'measure'])
      expect(() => TestCard.parse({ id: 't1', possibilityId: 'p1', actor: 'p',
        belief: 'b', action: 'a', measure: 'm', [f]: '', at: iso })).toThrow();
  });
  it('links to the question it tests and carries the inference on resolve', () => {
    const t = TestCard.parse({ id: 't1', possibilityId: 'p1', questionId: 'q1',
      actor: 'priya', belief: 'b', action: 'a', measure: 'm',
      state: 'passed', runner: 'kalimbo',
      result: { actor: 'aisha', text: 'boat confirmed', at: iso },
      at: iso, resolvedAt: iso });
    expect(t.questionId).toBe('q1');
    expect(t.result?.text).toBe('boat confirmed');
  });
  it('admits only the four lifecycle states', () => {
    expect(() => TestCard.parse({ id: 't1', possibilityId: 'p1', actor: 'p',
      belief: 'b', action: 'a', measure: 'm', state: 'abandoned', at: iso })).toThrow();
  });
});

describe('ecocycle — stage + trap derivation', () => {
  it('maps every status onto its stage; compost covers both endings', () => {
    expect(ecocycleStage('draft')).toBe('seed');
    expect(ecocycleStage('active')).toBe('sprout');
    expect(ecocycleStage('quorum')).toBe('maturity');
    expect(ecocycleStage('completed')).toBe('compost');
    expect(ecocycleStage('expired')).toBe('compost');
  });
  it('scarcity: deadline closing without quorum — and only then', () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString(); // 1d out
    const later = new Date(Date.now() + 30 * 86_400_000).toISOString();
    expect(ecocycleTraps({ status: 'active', quorumMet: false, deadline: soon, hasReport: false }).scarcity).toBe(true);
    expect(ecocycleTraps({ status: 'active', quorumMet: false, deadline: later, hasReport: false }).scarcity).toBe(false);
    expect(ecocycleTraps({ status: 'quorum', quorumMet: true, deadline: soon, hasReport: false }).scarcity).toBe(false);
    expect(ecocycleTraps({ status: 'active', quorumMet: false, hasReport: false }).scarcity).toBe(false);
  });
  it('rigidity: completed with no report filed', () => {
    expect(ecocycleTraps({ status: 'completed', quorumMet: true, hasReport: false }).rigidity).toBe(true);
    expect(ecocycleTraps({ status: 'completed', quorumMet: true, hasReport: true }).rigidity).toBe(false);
    expect(ecocycleTraps({ status: 'active', quorumMet: false, hasReport: false }).rigidity).toBe(false);
  });
  it('svg: accessible, no client JS, highlights only the current stage', () => {
    const labels = { title: en['eco.title'], seed: en['eco.seed'], sprout: en['eco.sprout'],
      maturity: en['eco.maturity'], compost: en['eco.compost'],
      trapScarcity: en['eco.trap.scarcity'], trapRigidity: en['eco.trap.rigidity'] };
    const svg = ecocycleSvg({ stage: 'sprout', scarcity: true, rigidity: false, labels });
    expect(svg).toContain('<svg');
    expect(svg).toContain('aria-label="ecocycle: sprout"');
    expect(svg).toContain('<title>');
    for (const s of ECOCYCLE_STAGES) expect(svg).toContain(`>${en[`eco.${s}` as keyof typeof en]}<`);
    expect(svg).not.toContain('<script');
    // aggregate/portfolio variant — no stage highlighted, counts render
    const port = ecocycleSvg({ scarcity: false, rigidity: false, labels,
      variant: 'portfolio', counts: { seed: 2, compost: 1, scarcity: 1 } });
    expect(port).toContain('aria-label="ecocycle"');
    expect(port).toContain('(2)');
    expect(port).toContain(`${en['eco.trap.scarcity']} (1)`);
  });
});

describe('portal markers — brief / tests / ecocycle', () => {
  it('renders the brief with per-field attribution + the edit form', () => {
    const html = renderPossibilitiesPage([card({
      brief: {
        problem: { text: 'mangroves are being cut', by: 'aisha', at: iso },
        purpose: { text: 'restore the creek edge', by: 'priya', at: iso },
      },
    })] as never, [], undefined, { connections: { p1: conn() } });
    for (const m of [
      'Design brief', 'mangroves are being cut', 'restore the creek edge',
      'Mida Creek', 'place / context', 'participants',
      'action="/possibilities/p1/brief"', 'name="problem"', 'name="resources"',
    ]) expect(html).toContain(m);
  });
  it('renders test cards with run/resolve controls + the propose form', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn({
        questions: [{ id: 'q1', actor: 'priya', text: 'boat?', state: 'open' }],
        tests: [
          { id: 't1', actor: 'priya', belief: 'boat available', action: 'ask Tuesday',
            measure: 'yes/no by Friday', failState: 'no answer', state: 'proposed',
            questionId: 'q1' },
          { id: 't2', actor: 'aisha', belief: 'tide allows', action: 'check tables',
            measure: 'window > 2h', failState: '', state: 'passed',
            result: { actor: 'aisha', text: '3h window', at: iso } },
          { id: 't3', actor: 'priya', belief: 'cart fits', action: 'load it',
            measure: 'under 5 min', failState: '', state: 'running', runner: 'kalimbo' },
        ],
      }) } });
    for (const m of [
      'Test cards', 'boat available', 'ask Tuesday', 'yes/no by Friday',
      'fails if', 'no answer', 'run by', 'inference', '3h window',
      'action="/tests/t1/run"', 'action="/tests/t1/resolve"',
      'action="/tests/t3/resolve"',
      'action="/possibilities/p1/test"', 'name="questionId"',
    ]) expect(html).toContain(m);
    // resolved tests lose the controls; running loses "run"
    expect(html).not.toContain('action="/tests/t2/run"');
    expect(html).not.toContain('action="/tests/t2/resolve"');
    expect(html).not.toContain('action="/tests/t3/run"');
  });
  it('renders the ecocycle ribbon with the card\u2019s stage + trap copy', () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString();
    const html = renderPossibilitiesPage([card({ deadline: soon })] as never, [], undefined,
      { connections: { p1: conn() } });
    for (const m of ['<svg', 'ecocycle: sprout', 'scarcity trap',
      'in the scarcity trap']) expect(html).toContain(m);
    const rig = renderPossibilitiesPage([card({ status: 'completed' })] as never, [], undefined,
      { connections: { p1: conn({ hasReport: false }) } });
    expect(rig).toContain('rigidity trap');
  });
  it('declare modal carries the four brief fields', () => {
    const html = renderPossibilitiesPage([card()] as never);
    for (const m of ['name="problem"', 'name="purpose"',
      'name="boundaries"', 'name="resources"', 'design brief'])
      expect(html).toContain(m);
  });
  it('maps brief + test ledger kinds onto trail labels', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn({ trail: [
        { seq: 1, at: iso, actor: 'aisha', kind: 'possibility.brief' },
        { seq: 2, at: iso, actor: 'priya', kind: 'test.proposed' },
        { seq: 3, at: iso, actor: 'aisha', kind: 'test.resolved' },
      ] }) } });
    for (const m of ['brief updated', 'test card event']) expect(html).toContain(m);
  });
});

describe('participatory knowledge — knows by having done', () => {
  const poss = [
    { id: 'p1', title: 'Mangrove planting', declarerId: 'aisha',
      status: 'completed', quorumAt: iso, createdAt: iso,
      report: { at: '2026-10-25T00:00:00Z' } },
    { id: 'p2', title: 'Beach cleanup', declarerId: 'priya',
      status: 'quorum', quorumAt: '2026-10-24T00:00:00Z', createdAt: iso },
    { id: 'p3', title: 'Never flew', declarerId: 'aisha',
      status: 'expired', createdAt: iso },
    { id: 'p4', title: 'Still gathering', declarerId: 'aisha',
      status: 'active', createdAt: iso },
  ];
  const ctx = {
    possibilities: poss,
    parts: [
      { possibilityId: 'p1', actor: 'kalimbo' },
      { possibilityId: 'p1', actor: 'aisha' },
      { possibilityId: 'p3', actor: 'priya' },  // joined but it expired
    ],
    seats: [{ possibilityId: 'p1', actor: 'kalimbo', role: 'participant' }],
    tests: [
      { possibilityId: 'p1', runner: 'kalimbo',
        result: { actor: 'aisha', text: 'x', at: iso } },
      { possibilityId: 'p4', runner: 'priya' },  // ran on a live card
    ],
  };
  it('confers role-scoped enactments on quorum+ cards only', () => {
    const aisha = enactments('aisha', ctx);
    expect(aisha).toHaveLength(1);
    expect(aisha[0]!.possibilityId).toBe('p1');
    expect(aisha[0]!.roles).toEqual(['declared', 'joined', 'test-resolved']);
    expect(aisha[0]!.at).toBe('2026-10-25T00:00:00Z'); // report date wins
    const kal = enactments('kalimbo', ctx);
    expect(kal[0]!.roles).toEqual(['joined', 'council', 'test-ran']);
    // priya declared p2 (quorum) and joined p3 (expired — no enactment)
    // and ran a test on p4 (active — no enactment yet)
    const priya = enactments('priya', ctx);
    expect(priya).toHaveLength(1);
    expect(priya[0]!.possibilityId).toBe('p2');
    expect(priya[0]!.roles).toEqual(['declared']);
    expect(enactments('nobody', ctx)).toHaveLength(0);
  });
  it('portfolio stats count entries + distinct actors', () => {
    const s = enactmentStats({ ...ctx, actors: ['aisha', 'kalimbo', 'priya', 'ghost'] });
    expect(s.total).toBe(3);
    expect(s.actorsEnacted).toBe(3);
  });
  it('actor profile renders the "knows by doing" block with roles', () => {
    const html = renderActorProfile({
      actor: 'aisha', created: 1, joined: 1,
      appreciatedBy: 0, appreciated: 0, earned: 0, assuranceCredits: 0,
      trustScore: 1, wallets: [], donations: [],
      participatory: enactments('aisha', ctx),
    });
    for (const m of ['Knows by doing', 'Mangrove planting',
      'convened', 'committed', 'closed a test', 'report filed',
      'href="/possibilities#p1"']) expect(html).toContain(m);
    // no block when there's nothing enacted
    expect(renderActorProfile({
      actor: 'ghost', created: 0, joined: 0, appreciatedBy: 0,
      appreciated: 0, earned: 0, assuranceCredits: 0,
      trustScore: 0, wallets: [], donations: [], participatory: [],
    })).not.toContain('Knows by doing');
  });
});
