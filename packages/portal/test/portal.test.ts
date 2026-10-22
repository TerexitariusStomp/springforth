import { describe, expect, it } from 'vitest';
import { renderLandingPage, tickerLines } from '../src/landing.ts';
import { renderPossibilitiesPage, type CardConnections } from '../src/possibilities.ts';
import { renderCollaboratePage } from '../src/collaborate.ts';
import { renderFundPage } from '../src/fund.ts';
import { renderImpactPage } from '../src/impact.ts';
import { renderCommunityPage } from '../src/community.ts';
import { renderHowItWorksPage } from '../src/howitworks.ts';
import { renderRoundsPage } from '../src/rounds.ts';
import { renderLedgerPage, renderLedgerVerifyPage } from '../src/ledger.ts';
import { renderWhitepaper } from '../src/whitepaper.ts';
import { pageShell } from '../src/theme.ts';
import { displayName } from '../src/ui.ts';
import type { OverlapRecord, PlanNode } from '@springforth/coordination';

const possibility = {
  id: 'p1', title: 'Plant mangroves at Mida Creek', description: 'Community planting day',
  declarerId: 'aisha', place: 'Mida Creek', deadline: '2026-11-01T00:00:00Z',
  minParticipants: 3, status: 'active' as const, createdAt: '2026-10-20T00:00:00Z',
};

const node = (o: Partial<PlanNode> & { id: string; label: string }): PlanNode => ({
  kind: 'action', canonical: o.label.toLowerCase(), source: 'test',
  orgIds: [], tags: [], timeframe: {}, description: '', ...o,
});

const rec = (o: Partial<OverlapRecord> & { id: string }): OverlapRecord => ({
  kind: 'overlap', nodeIds: ['n1', 'n2'], confidence: 0.8,
  evidence: [{ field: 'label', a: 'x', b: 'y', score: 0.8 }],
  reasoning: 'test reasoning', status: 'proposed', validations: [],
  createdAt: '2026-10-20T00:00:00Z', ...o,
});

const emptyCollab = {
  lang: 'en' as const, commitments: [], byCapital: {}, resources: [],
  overlaps: [], nodes: [], plans: [], signals: [],
};

describe('portal renderers', () => {
  it('landing renders how-it-works + cards', () => {
    const html = renderLandingPage({
      cards: [{ possibility, participants: 2 }],
      proposedOverlaps: 1, unmetNeeds: 2, actionNodes: [], planCount: 3,
      ticker: [], participantsTotal: 4, participantInitials: ["D", "A"], placesCount: 2, hoursTotal: 12,
      completedCount: 1, quorumRate: 50,
    });
    expect(html).toContain('Plant mangroves');
    expect(html).toContain('/possibilities');
    expect(html).toContain('/how-it-works');      // walkthrough link, not /docs
    expect(html).toContain('What you can do here'); // door row
  });
  it('possibilities page renders a card', () => {
    const html = renderPossibilitiesPage([
      {
        ...possibility, score: 0.5,
        scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
        participantCount: 2, needs: [], bringing: [],
        quorum: { met: false, required: 3, requiredMet: 0 },
      },
    ] as never);
    expect(html).toContain('Plant mangroves');
  });
  it('collaborate hub renders H1 + every section id on empty input', () => {
    const html = renderCollaboratePage(emptyCollab);
    expect(html).toContain('together, not twice.');
    for (const id of ['id="needs"', 'id="overlaps"', 'id="outcomes"',
      'id="plans"', 'id="commons"', 'id="ask"'])
      expect(html).toContain(id);
  });
  it('fund hub renders H1 + every section id on empty input', () => {
    const html = renderFundPage({
      lang: 'en', rounds: [], donations: [], gates: new Map(),
      pledges: [], retroRounds: [], badgeholders: [],
      streams: [], yieldStreams: [], possibilities: [],
    });
    expect(html).toContain('what works.');
    for (const id of ['id="rounds"', 'id="pledges"', 'id="retro"',
      'id="streams"', 'id="endowment"'])
      expect(html).toContain(id);
  });
  it('impact hub renders H1 + every section id on empty input', () => {
    const html = renderImpactPage({
      lang: 'en', metrics: {}, checks: [], nodes: [], sources: [],
      claims: [], attestations: [], releases: [], slices: {},
      verify: { ok: true, events: 0 }, events: [], possibilities: [],
    });
    expect(html).toContain('actually happened.');
    for (const id of ['id="results"', 'id="value"', 'id="claims"',
      'id="evidence"', 'id="proof"', 'id="data"'])
      expect(html).toContain(id);
  });
  it('community hub renders H1 + every section id on empty input', () => {
    const html = renderCommunityPage({
      lang: 'en', people: [], mutual: [], proposals: [], ballots: [],
      params: [], governable: {}, voters: 0,
    });
    expect(html).toContain('people behind it.');
    for (const id of ['id="people"', 'id="trust"', 'id="decisions"'])
      expect(html).toContain(id);
  });
  it('how-it-works renders the seven stops', () => {
    const html = renderHowItWorksPage('en');
    expect(html).toContain('works, end to end.');
    for (const m of ['/possibilities', '/collaborate#overlaps',
      '/fund', '/impact', '/community#trust'])
      expect(html).toContain(m);
  });
  it('ledger pages render translated chrome', () => {
    const ledger = renderLedgerPage(
      [{ seq: 1, at: '2026-10-20T00:00:00Z', actor: 'demo-a',
        kind: 'possibility.declared', payload: {}, prev_hash: '', hash: 'ab'.repeat(32) }],
      { ok: true, events: 1 });
    expect(ledger).toContain('ledger.');
    expect(ledger).toContain('chain verified');
    const verify = renderLedgerVerifyPage({ ok: false, brokenAt: 7 });
    expect(verify).toContain('broken.');
  });
});

// Overlap queue — the reviewer contract: human-only merging, default
// confidence floor, 12-per-page pagination, node-focus shows everything.
describe('overlap queue', () => {
  const collab = (overlaps: OverlapRecord[], q: Record<string, unknown> = {}) =>
    renderCollaboratePage({
      ...emptyCollab,
      nodes: [node({ id: 'n1', label: 'Plan A' }), node({ id: 'n2', label: 'Plan B' })],
      overlaps,
      ...q,
    });
  it('default hides <0.5 machine flags; ?overlaps=all shows them', () => {
    const low = rec({ id: 'r-low', confidence: 0.2 });
    const high = rec({ id: 'r-high', confidence: 0.9 });
    const def = collab([low, high]);
    // record ids surface in the validate-form action — presence = rendered
    expect(def).toContain('/overlaps/r-high/');
    expect(def).not.toContain('/overlaps/r-low/');
    expect(def).toContain('Show lower-confidence matches (1)');
    const all = collab([low, high], { overlapsAll: true });
    expect(all).toContain('/overlaps/r-low/');
    expect(all).toContain('Hide lower-confidence matches');
  });
  it('confirmed/coordinated records survive the confidence floor', () => {
    const confirmed = rec({ id: 'r-c', confidence: 0.1, status: 'confirmed' });
    const coordinated = rec({ id: 'r-k', confidence: 0.1, status: 'coordinated' });
    const html = collab([confirmed, coordinated]);
    // both are rendered as review cards — the confirm form is absent on
    // coordinated records but the card itself must be present
    expect(html).toContain('confirmed');
    expect(html).toContain('coordinated');
    expect(html).not.toContain('Show lower-confidence');
  });
  it('pages the queue 12 records per page', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      rec({ id: `r-${i}`, confidence: 0.9 }));
    const p1 = collab(many);
    const p2 = collab(many, { page: 2 });
    // ids are not in card output — count cards instead
    const countCards = (h: string) =>
      (h.match(/class="card"/g) ?? []).length;
    expect(countCards(p2)).toBeLessThan(countCards(p1));
    expect(p2).toContain('Page 2');
  });
  it('?node=<id> focuses that node and shows the correction form', () => {
    const low = rec({ id: 'r-low', confidence: 0.1, nodeIds: ['n1', 'n9'] });
    const html = collab([low], { nodeFocus: 'n1' });
    expect(html).toContain('/nodes/n1/correct');
    expect(html).toContain('Showing every record for');
  });
  it('collaborate renders a fixture overlap card', () => {
    const html = collab([rec({ id: 'r1' })]);
    expect(html).toContain('Plan A');
    expect(html).toContain('Plan B');
    expect(html).toContain('/overlaps/r1/validate');
  });
});

// Card → hub connections
describe('card connections', () => {
  const card = () => ({
    ...possibility, score: 0.5,
    scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
    participantCount: 2, needs: [], bringing: [],
    quorum: { met: false, required: 3, requiredMet: 0 },
  });
  const conn: CardConnections = {
    overlapCount: 2, focusNodeId: 'n1',
    rounds: [{ id: 'r1', title: 'Spring round' }],
    committed: { GBP: 45 }, pledges: 3,
    claimId: 'claim-9', hasReport: true,
  };
  it('renders overlap, round, funding, claim and report links', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: conn } });
    for (const m of [
      'Connected',
      '/collaborate?node=n1#overlaps',
      '/rounds/r1', 'Spring round',
      '/fund#pledges', '45',
      '/claims/claim-9',
      '/possibilities/p1/report',
    ]) expect(html).toContain(m);
  });
  it('renders no Connected block when empty', () => {
    const html = renderPossibilitiesPage([card()] as never, [], undefined,
      { connections: { p1: { overlapCount: 0, rounds: [], committed: {}, pledges: 0, hasReport: false } } });
    expect(html).not.toContain('>Connected<');
  });
});

// Render smoke tests — markers a regression can't silently drop: the
// shared chrome, the judge-critical blocks, and the live-data surfaces.
describe('shell + markers', () => {
  const landing = () => renderLandingPage({
    cards: [{ possibility, participants: 2 }],
    proposedOverlaps: 0, unmetNeeds: 0, actionNodes: [], planCount: 0,
    ticker: ['demo joined “x”'], participantsTotal: 4, participantInitials: ['D'], placesCount: 2,
    hoursTotal: 12, completedCount: 1, quorumRate: 50,
  });
  it('pageShell emits topbar, footer, meta + vendored assets', () => {
    const html = pageShell({ title: 't', htmx: false }, '<p>x</p>');
    for (const m of ['class="topbar"', '<footer', 'og:title', '/vendor/pico.css',
      'skip-link', 'nav-toggle'])
      expect(html).toContain(m);
  });
  it('landing emits hero, orbit card, ticker, deck, steps, impact, cta', () => {
    const html = landing();
    for (const m of ['class="hero"', 'orbit-card', 'ticker-track',
      'card-grid', 'class="step"', 'impact-panel', 'class="cta',
      'hx-get="/partials/ticker"', 'id="doors"'])
      expect(html).toContain(m);
  });
  it('landing invents no stats — real numbers only', () => {
    const html = landing();
    expect(html).not.toContain('2,847');
    expect(html).not.toContain('12,408');
    expect(html).toContain('>4<'); // participantsTotal
  });
  it('deck emits grid, overlays, declare modal, filters, search', () => {
    const html = renderPossibilitiesPage([
      {
        ...possibility, score: 0.5,
        scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
        participantCount: 2, needs: [], bringing: [],
        quorum: { met: false, required: 3, requiredMet: 0 },
      },
    ] as never);
    for (const m of ['card-grid', 'card-overlay', 'detail-panel',
      'id="declare"', 'modal-submit', 'deck-search', 'class="filters"',
      'data-search'])
      expect(html).toContain(m);
  });
  it('deck keeps judge-critical detail in overlays', () => {
    const html = renderPossibilitiesPage([
      {
        ...possibility, score: 0.5,
        scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
        participantCount: 2,
        needs: [{ id: 'n1', label: 'a venue', met: false }],
        bringing: [], quorum: { met: false, required: 1, requiredMet: 0 },
      },
    ] as never);
    for (const m of ['/join', '/need', '/pass', 'Declared by'])
      expect(html).toContain(m);
  });
  it('rounds page keeps gate badges + endowment card', () => {
    const html = renderRoundsPage(
      [{ id: 'r1', title: 'Test round', description: '', sponsorIds: ['s'],
        matchingFund: { amount: 500, currency: 'GBP' }, eligibleNeedIds: ['n1'],
        opensAt: '2026-10-15T00:00:00Z', closesAt: '2026-11-15T00:00:00Z',
        state: 'open', matchingMode: 'lr', conviction: false,
        acceptedTokens: {}, endowment: false, pledgeGoal: 100, minBackers: 2 }],
      [],
      new Map([['r1', { gated: true, active: false, goal: 100,
        pledged: 40, backers: ['a'], minBackers: 2 }]]),
      { accrued: { GBP: 0.68 }, principal: { GBP: 250 } },
    );
    for (const m of ['matching locked', 'Permanent endowment',
      'Locked principal'])
      expect(html).toContain(m);
  });
  it('fund hub renders pledge plain-state labels', () => {
    const html = renderFundPage({
      lang: 'en', rounds: [], donations: [], gates: new Map(),
      pledges: [
        { id: 'pl1', possibilityId: 'p1', pledger: 'demo-ada', amount: 10,
          currency: 'GBP', state: 'pending', stateAt: '2026-10-20T00:00:00Z' },
      ] as never,
      retroRounds: [], badgeholders: [], streams: [], yieldStreams: [],
      possibilities: [{ id: 'p1', title: 'Plant mangroves at Mida Creek' }],
    });
    expect(html).toContain('waiting for enough backers');
    expect(html).toContain('Ada'); // displayName
    expect(html).toContain('Plant mangroves');
  });
  it('ticker humanizes ledger events', () => {
    const lines = tickerLines([
      { seq: 1, at: '', actor: 'demo-a', kind: 'possibility.quorum',
        payload: { id: 'p1' } },
      { seq: 2, at: '', actor: 'demo-b', kind: 'donation.recorded',
        payload: { amount: 20, currency: 'GBP' } },
      { seq: 3, at: '', actor: 'cron', kind: 'oracle.check', payload: {} },
    ], new Map([['p1', possibility as never]]));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('20 GBP committed');
    expect(lines[1]).toContain('reached quorum');
  });
});

describe('Phase A chrome + ui kit', () => {
  it('topbar nav is exactly five hubs + Learn + CTA', () => {
    const html = pageShell({ title: 't', htmx: false }, '<p>x</p>');
    const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)![0];
    // hub links are direct anchors; the Learn dropdown hangs off .nav-more
    const top = nav.slice(0, nav.indexOf('class="nav-more"'));
    const links = [...top.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)]
      .map((m) => m[1]);
    expect(links).toEqual(
      ['/possibilities', '/collaborate', '/fund', '/impact', '/community']);
    expect(nav).toContain('aria-haspopup="true"');
    expect(nav).toContain('Learn');
    expect(html).toContain('Start a possibility');
    // and nothing else — no leftover backend-surface links in primary nav
    for (const gone of ['/rounds', '/outcomes', '/coordination', '/docs'])
      expect(top).not.toContain(`href="${gone}"`);
  });
  it('language switcher renders EN/SW/FR with aria-current', () => {
    const html = pageShell({ title: 't', htmx: false }, '<p>x</p>');
    expect(html).toContain('href="?lang=sw"');
    expect(html).toContain('href="?lang=fr"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('aria-label="Language"');
  });
  it('swahili locale renders swahili chrome', () => {
    const html = pageShell({ title: 't', htmx: false, lang: 'sw' }, '<p>x</p>');
    expect(html).toContain('lang="sw"');
    expect(html).toContain('Shirikiana');       // nav.collaborate
    expect(html).toContain('Ruka hadi maudhui'); // skip link
  });
  it('every english key exists non-empty in sw + fr', async () => {
    const en = (await import('../src/strings/en.ts')).default;
    const sw = (await import('../src/strings/sw.ts')).default;
    const fr = (await import('../src/strings/fr.ts')).default;
    for (const k of Object.keys(en)) {
      expect(sw[k], `sw.${k}`).toBeTruthy();
      expect(fr[k], `fr.${k}`).toBeTruthy();
    }
  });
});

// Step 6/7 — neutral wording (mechanism jargon lives inside how-note
// disclosures only) + the accessibility markers every page must emit.
describe('wording + a11y markers', () => {
  const deckCardFixture = [{
    ...possibility, score: 0.5,
    scoring: { score: 0.5, trust: 0, urgency: 0.5, cover: 0.5 },
    participantCount: 2, needs: [], bringing: [],
    quorum: { met: false, required: 3, requiredMet: 0 },
  }];
  const pages: Array<[string, () => string]> = [
    ['landing', () => renderLandingPage({
      cards: [{ possibility, participants: 2 }],
      proposedOverlaps: 0, unmetNeeds: 0, actionNodes: [], planCount: 0,
      ticker: [], participantsTotal: 4, participantInitials: ['D'],
      placesCount: 2, hoursTotal: 12, completedCount: 1, quorumRate: 50,
    })],
    ['possibilities', () => renderPossibilitiesPage(deckCardFixture as never)],
    ['collaborate', () => renderCollaboratePage(emptyCollab)],
    ['fund', () => renderFundPage({
      lang: 'en', rounds: [], donations: [], gates: new Map(),
      pledges: [], retroRounds: [], badgeholders: [],
      streams: [], yieldStreams: [], possibilities: [],
    })],
    ['impact', () => renderImpactPage({
      lang: 'en', metrics: {}, checks: [], nodes: [], sources: [],
      claims: [], attestations: [], releases: [], slices: {},
      verify: { ok: true, events: 0 }, events: [], possibilities: [],
    })],
    ['community', () => renderCommunityPage({
      lang: 'en', people: [], mutual: [], proposals: [], ballots: [],
      params: [], governable: {}, voters: 0,
    })],
    ['how-it-works', () => renderHowItWorksPage('en')],
    ['whitepaper', () => renderWhitepaper('en')],
  ];
  // how-note disclosures legitimately hold mechanism names + JSON links;
  // strip them before scanning for banned surface copy.
  const stripDisclosures = (html: string) =>
    html.replace(/<details class="how-note"[\s\S]*?<\/details>/g, '');
  it.each(pages)('%s: no Judge/PS1/Team Two/jargon outside disclosures', (_, render) => {
    const html = stripDisclosures(render());
    for (const banned of ['Judge', 'PS1', 'Team Two',
      'EigenTrust', 'Liberal Radicalism', '?format=json'])
      expect(html).not.toContain(banned);
  });
  it.each(pages)('%s: exactly one <h1>, html lang, skip-link', (_, render) => {
    const html = render();
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('class="skip-link"');
  });
  it.each(pages)('%s: every nav landmark carries an aria-label', (_, render) => {
    const html = render();
    const navs = html.match(/<nav[^>]*>/g) ?? [];
    expect(navs.length).toBeGreaterThan(0);
    for (const n of navs) expect(n).toContain('aria-label');
  });
  it.each(pages)('%s: every form input is labelled', (_, render) => {
    const html = render();
    // positions wrapped by <label>…</label> are implicitly associated
    const labelRanges: Array<[number, number]> = [];
    for (const lm of html.matchAll(/<label\b[\s\S]*?<\/label>/g))
      labelRanges.push([lm.index, lm.index + lm[0].length]);
    for (const m of html.matchAll(/<input\b[^>]*>/g)) {
      const tag = m[0];
      if (tag.includes('type="hidden"') || tag.includes('aria-hidden')) continue;
      const wrapped = labelRanges.some(([a, b]) => m.index > a && m.index < b);
      const id = tag.match(/\bid="([^"]+)"/)?.[1];
      const labelled = wrapped || tag.includes('aria-label')
        || tag.includes('aria-labelledby')
        || tag.includes('title=')
        || (id ? html.includes(`for="${id}"`) : false);
      expect(!!labelled, tag).toBe(true);
    }
  });
  it('hub pages emit collapsible sections: details open + 1-based index + script', () => {
    const html = renderCommunityPage({
      lang: 'en', people: [], mutual: [], proposals: [], ballots: [],
      params: [], governable: {}, voters: 0,
    });
    expect(html).toMatch(/<details class="hub-sec" id="people" open data-hub-index="1">/);
    expect(html).toContain('data-hub-index="3"');
    expect(html).toContain('matchMedia'); // hubScript mobile collapse
  });
});

describe('displayName', () => {
  it.each([
    ['tg:jane', /@jane/, 'telegram handle becomes @user'],
    ['0x1234567890abcdef1234567890abcdef12345678', /0x1234…5678/, 'wallet shortens'],
    ['demo-amina', />Amina</, 'demo- prefix dropped + title-cased'],
    ['coast-collective', />Coast Collective</, 'hyphens become spaces, title-cased'],
    ['green_earth_org', />Green Earth Org</, 'underscores become spaces'],
  ])('%s → %s', (id, re) => {
    expect(displayName(id)).toMatch(re);
  });
  it('keeps the raw id in title=""', () => {
    expect(displayName('demo-amina')).toContain('title="demo-amina"');
  });
});
