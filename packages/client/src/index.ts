// Typed client for the Springforth API. Thin fetch wrapper — no
// framework deps, works in Node 18+/Workers/browsers. Methods return
// parsed JSON typed against @springforth/core entities; throws on
// non-2xx with the server's error body attached.
import type {
  Appreciation, AssuranceCredit, Attestation, ChainTx,
  DatasetRelease, DataAccessGrant, Donation, FundingRound,
  GovernanceBallot, GovernanceParam, GovernanceProposal, ImpactClaim,
  LedgerEvent, OracleCheck, Participation,
  Possibility, RecurringSupport, RetroBallot, RetroRound,
  RoundApplication, Signal, YieldStream,
} from '@springforth/core';
import type { ExternalPlan, OverlapRecord, PlanNode } from '@springforth/coordination';
export type { ExternalPlan, OverlapRecord, PlanNode };

export interface ClientOptions {
  baseUrl: string;                    // e.g. https://springforth.widespread.workers.dev
  adminToken?: string;                // for admin-gated writes
  fetchImpl?: typeof fetch;           // inject for tests
  actor?: string;                     // sent as x-actor for rate-limit identity
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`springforth api ${status}: ${JSON.stringify(body)}`);
  }
}

export class SpringforthClient {
  constructor(private o: ClientOptions) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const f = this.o.fetchImpl ?? fetch;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.o.adminToken) headers.authorization = `Bearer ${this.o.adminToken}`;
    if (this.o.actor) headers['x-actor'] = this.o.actor;
    const res = await f(`${this.o.baseUrl.replace(/\/$/, '')}${path}`, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, json);
    return json as T;
  }

  get<T>(p: string) { return this.call<T>('GET', p); }
  post<T>(p: string, b?: unknown) { return this.call<T>('POST', p, b); }

  // ── Coordination ────────────────────────────────────────────────
  possibilities = () => this.get<{ possibilities: Possibility[] }>('/possibilities');
  possibility = (id: string) => this.get<Record<string, unknown>>(`/possibilities/${id}`);
  createPossibility = (b: Partial<Possibility>) => this.post<Possibility>('/possibilities', b);
  commit = (b: Partial<Participation>) => this.post<Participation>('/commitments', b);
  plans = () => this.get<{ plans: ExternalPlan[] }>('/plans');
  nodes = () => this.get<{ nodes: PlanNode[] }>('/nodes');
  overlaps = () => this.get<{ records: OverlapRecord[] }>('/overlaps');
  signals = () => this.get<{ signals: Signal[] }>('/signals');
  addSignal = (b: Partial<Signal>) => this.post<Signal>('/signals', b);
  actor = (id: string) => this.get<{
    appreciations: Appreciation[]; credits: AssuranceCredit[];
    trustScore: number; [k: string]: unknown;
  }>(`/actors/${id}`);
  bindWallet = (actor: string, address: string, signature: string) =>
    this.post(`/actors/${encodeURIComponent(actor)}/bind-wallet`, { address, signature });
  trust = () => this.get<Record<string, number>>('/trust');
  appreciations = () => this.get<{ appreciations: Appreciation[] }>('/appreciations')
    .catch(() => this.get<{ appreciations: Appreciation[] }>('/actors'));

  // ── Funding ─────────────────────────────────────────────────────
  rounds = () => this.get<{ rounds: FundingRound[] }>('/rounds');
  round = (id: string) => this.get<Record<string, unknown>>(`/rounds/${id}`);
  createRound = (b: Partial<FundingRound>) => this.post<FundingRound>('/rounds', b);
  apply = (round: string, b: Partial<RoundApplication>) =>
    this.post<RoundApplication>(`/rounds/${round}/apply`, b);
  review = (round: string, appId: string, state: 'approved' | 'rejected') =>
    this.post(`/rounds/${round}/review`, { applicationId: appId, state });
  closeRound = (round: string) => this.post(`/rounds/${round}/close`);
  donate = (round: string, b: Partial<Donation>) => this.post<Donation>(`/rounds/${round}/donate`, b);
  pledge = (round: string, b: unknown) => this.post(`/rounds/${round}/pledge`, b);
  pledges = () => this.get<{ pledges: unknown[] }>('/pledges');
  roundTx = (round: string) => this.get<Record<string, unknown>>(`/rounds/${round}/tx`);
  registerYield = (round: string, b: Partial<YieldStream>) =>
    this.post<YieldStream>(`/rounds/${round}/yield`, b);
  export360 = (round: string) => this.get<unknown>(`/rounds/${round}/export/360giving`);
  exportHypercerts = (round: string) => this.get<unknown>(`/rounds/${round}/export/hypercerts`);

  // ── Claims / attestations / chain ───────────────────────────────
  claims = () => this.get<{ claims: ImpactClaim[] }>('/claims');
  fileClaim = (b: Partial<ImpactClaim>) => this.post<ImpactClaim>('/claims', b);
  claimTx = (claim: string) => this.get(`/claims/${claim}/tx`);
  attestations = () => this.get<{ attestations: Attestation[] }>('/attestations');
  attestationTx = (att: string) => this.get(`/attestations/${att}/tx`);
  chainStatus = () => this.get<Record<string, unknown>>('/chain');
  recordTx = (b: Partial<ChainTx>) => this.post<ChainTx>('/chain/record', b);
  pendingTx = () => this.get<{ pending: ChainTx[] }>('/chain/pending');

  // ── Streams ─────────────────────────────────────────────────────
  streams = () => this.get<{ streams: RecurringSupport[] }>('/streams');
  streamTx = (round: string, q: { sender: string; token: string; receiver: string; flowRate: string; op?: 'create' | 'delete' }) =>
    this.get(`/rounds/${round}/stream/tx?${new URLSearchParams(q as Record<string, string>)}`);
  createStream = (round: string, b: Partial<RecurringSupport>) =>
    this.post<RecurringSupport>(`/rounds/${round}/stream`, b);

  // ── Evidence / oracle ───────────────────────────────────────────
  oracleChecks = () => this.get<{ checks: OracleCheck[] }>('/outcomes');
  report = (possibilityId: string) => this.get(`/possibilities/${possibilityId}/report`);
  runOracle = () => this.post('/oracle/run');
  sources = () => this.get('/sources');
  metrics = () => this.get('/metrics');
  needs = () => this.get<{ nodes: PlanNode[] }>('/nodes');

  // ── Retro / governance ──────────────────────────────────────────
  retro = () => this.get<{ rounds: RetroRound[]; ballots: RetroBallot[] }>('/retro');
  governance = () => this.get<{
    proposals: GovernanceProposal[]; ballots: GovernanceBallot[];
    params: GovernanceParam[]; eligibleVoters: string[];
  }>('/governance');
  propose = (b: { param: string; title: string; proposedValue: string; proposer: string }) =>
    this.post<GovernanceProposal>('/governance/proposals', b);
  vote = (proposal: string, b: { voter: string; points: number; support: boolean }) =>
    this.post<GovernanceBallot>(`/governance/${proposal}/vote`, b);
  tally = (proposal: string) => this.post(`/governance/${proposal}/tally`);

  // ── Datasets ────────────────────────────────────────────────────
  datasets = () => this.get<{ releases: DatasetRelease[]; available: Record<string, string> }>('/datasets');
  releaseDataset = (name: string) => this.post<DatasetRelease>(`/datasets/${name}/release`);
  grantAccess = (dataset: string, b: { grantee: string; paymentRef: string; days?: number }) =>
    this.post<DataAccessGrant>(`/datasets/${dataset}/grants`, b);

  // ── Subscriptions ───────────────────────────────────────────────
  subscriptions = () => this.get<{ subscriptions: unknown[] }>('/subscriptions');
  subscribe = (b: { actor: string; target?: string; events?: string[]; channel?: string; address?: string }) =>
    this.post('/subscriptions', b);

  // ── Ledger ──────────────────────────────────────────────────────
  ledger = () => this.get<{ events: LedgerEvent[] }>('/ledger');
  verifyLedger = () => this.get<{ ok: boolean; length: number }>('/ledger/verify');
  anchorLedger = () => this.post('/ledger/anchor');

  // ── Sync / import (admin) ───────────────────────────────────────
  silviSync = (projectId?: string, apiKey?: string) =>
    this.post('/silvi/sync', projectId ? { projectId, apiKey } : {});
  treegensSync = () => this.post('/treegens/sync');
  soulutionsSync = () => this.post('/soulutions/sync');
  givethSync = (opts?: { mode?: 'backfill' | 'sweep'; maxPages?: number; maxProjects?: number }) =>
    this.post('/giveth/sync', opts ?? {});
  gapSync = () => this.post('/gap/sync');
  restorSync = (phase?: 'enumerate' | 'hydrate') =>
    this.post('/restor/sync', phase ? { phase } : {});
  ocSync = (phase?: 'accounts' | 'orders') =>
    this.post('/oc/sync', phase ? { phase } : {});
  regenSync = () => this.post('/regen/sync');
  bloomSync = (key?: string) =>
    this.post('/bloom/sync', key ? { key } : {});
  importPlan = (format: string, data: unknown, source?: string) => this.post('/plans', { format, data, source });
}
