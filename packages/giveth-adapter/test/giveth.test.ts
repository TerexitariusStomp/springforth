import { describe, expect, it } from 'vitest';
import {
  fetchGivethProjects, fetchGivethQfRounds, fetchGivethDonations,
  fromGivethProjects, toFundingRounds, toDonations, givethLastError,
  type GivethProject, type GivethQfRound, type GivethDonation,
} from '../src/index.ts';

const brightid: GivethProject = {
  id: '1384', title: 'BrightID Proof of Uniqueness',
  slug: 'brightid-proof-of-uniqueness',
  descriptionSummary: 'Decentralized uniqueness verification',
  verified: true, verificationStatus: 'verified',
  coOrdinates: null, impactLocation: null,
  website: 'https://brightid.org',
  creationDate: '2021-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  totalRaised: 12000, totalDonations: 376, totalDonated: 12000,
  totalDistributed: 0, qualityScore: 80,
  walletAddress: '0xabc0000000000000000000000000000000000001', chainId: 1,
  organization: { name: 'BrightID', label: 'brightid' },
  categories: [{ name: 'technology' }, { name: 'public-goods' }],
  projectQfRoundRelations: [{ qfRoundId: '20', sumDonationValueUsd: 9000, countUniqueDonors: 200 }],
};

const geo: GivethProject = {
  ...brightid, id: '9', title: 'Geo Project', slug: 'geo',
  coOrdinates: '-1.2921,36.8219', verified: false,
  projectQfRoundRelations: null,
};

const nairobiText: GivethProject = {
  ...brightid, id: '10', title: 'Text geo', slug: 'txt',
  coOrdinates: null, impactLocation: 'Kilifi, Kenya', verified: false,
  projectQfRoundRelations: null,
};

const round: GivethQfRound = {
  id: '20', slug: 'gg24dti', name: 'GG24: Dev Tooling', title: 'Dev Tooling',
  isActive: false, allocatedFund: null, allocatedFundUSD: 200000,
  allocatedTokenSymbol: 'USDC', allocatedTokenChainId: 1,
  minimumValidUsdValue: 1, eligibleNetworks: [1, 42220],
  beginDate: '2025-10-14T14:00:00Z', endDate: '2025-10-29T06:59:00Z',
};

const donation: GivethDonation = {
  id: '584616', valueUsd: 1.7961, amount: 0.0005, currency: 'ETH',
  createdAt: '2026-05-29T21:11:52Z', status: 'verified',
  transactionId: '0xdead', transactionNetworkId: 1, anonymous: false,
  qfRoundId: '20', user: { walletAddress: '0xf8ab' },
};

const fetchJson = (body: unknown, ok = true) =>
  (() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
const gqlOk = (data: unknown) => fetchJson({ data });

describe('fromGivethProjects', () => {
  it('maps project → action + need (verified = fundraising surface)', () => {
    const plan = fromGivethProjects([brightid]);
    const action = plan.nodes.find((n) => n.id === 'giveth-1384-project')!;
    expect(action.kind).toBe('action');
    expect(action.tags).toContain('verified:giveth');
    const need = plan.nodes.find((n) => n.id === 'giveth-1384-need')!;
    expect(need.capital).toBe('financial');
  });
  it('unverified non-round project gets action only', () => {
    const plan = fromGivethProjects([{ ...geo, verified: false }]);
    expect(plan.nodes.filter((n) => n.kind === 'need')).toHaveLength(0);
  });
  it('non-verified project in an ACTIVE qf round still gets a need node', () => {
    const plan = fromGivethProjects([{ ...geo, verified: false,
      projectQfRoundRelations: [{ qfRoundId: '20' }] }], new Set(['20']));
    expect(plan.nodes.some((n) => n.kind === 'need' && n.tags.includes('qf-round'))).toBe(true);
  });
  it('resolves coOrdinates and impactLocation to h3', () => {
    const plan = fromGivethProjects([geo, nairobiText]);
    expect(plan.nodes[0]!.h3).toMatch(/^[0-9a-f]{15}$/);
    // unverified projects get no need node → nairobiText action is index 1
    expect(plan.nodes[1]!.h3).toMatch(/^[0-9a-f]{15}$/); // gazetteer: kikambala
  });
});

describe('toFundingRounds', () => {
  it('imports round as allocated FundingRound with matching fund + eligible needs', () => {
    const fr = toFundingRounds([round], new Map([['20', ['giveth-1384-need']]]))[0]!;
    expect(fr.id).toBe('round-giveth-qf-20');
    expect(fr.state).toBe('allocated');
    expect(fr.matchingFund.amount).toBe(200000);
    expect(fr.eligibleNeedIds).toContain('giveth-1384-need');
    expect(fr.chainRef).toBe('giveth-qf:20');
  });
});

describe('toDonations', () => {
  it('verified donation → settled with tx ref; donor is wallet', () => {
    const d = toDonations([donation], '1384')[0]!;
    expect(d.settlement).toBe('settled');
    expect(d.settlementRef).toBe('0xdead:net-1');
    expect(d.donor).toBe('giveth:0xf8ab');
    expect(d.roundId).toBe('round-giveth-qf-20');
    expect(d.needNodeId).toBe('giveth-1384-need');
  });
  it('pending donation stays pledged; anonymous donor anonymized', () => {
    const d = toDonations([{ ...donation, status: 'pending', anonymous: true }], '1384')[0]!;
    expect(d.settlement).toBe('pledged');
    expect(d.donor).toBe('giveth:anon-584616');
  });
});

describe('fetchers', () => {
  it('fetchGivethProjects parses allProjects page', async () => {
    const f = gqlOk({ allProjects: { totalCount: 7830, projects: [brightid] } });
    const r = await fetchGivethProjects({ take: 50 }, f);
    expect(r?.totalCount).toBe(7830);
    expect(r?.projects[0]!.id).toBe('1384');
  });
  it('fetchGivethQfRounds parses rounds', async () => {
    const f = gqlOk({ qfRounds: [round] });
    expect((await fetchGivethQfRounds(f))?.[0]?.id).toBe('20');
  });
  it('fetchGivethDonations parses paginated donations', async () => {
    const f = gqlOk({ donationsByProjectId: { totalCount: 376, donations: [donation] } });
    const r = await fetchGivethDonations(1384, {}, f);
    expect(r?.donations[0]!.transactionId).toBe('0xdead');
  });
  it('graphql errors → null + lastError', async () => {
    const f = fetchJson({ errors: [{ message: 'nope' }] });
    expect(await fetchGivethProjects({}, f)).toBeNull();
    expect(givethLastError()).toContain('gql:');
  });
  it('http failure → null', async () => {
    expect(await fetchGivethProjects({}, fetchJson({}, false))).toBeNull();
  });
});
