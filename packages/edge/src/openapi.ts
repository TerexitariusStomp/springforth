// Self-documenting OpenAPI 3.1 spec for the Springforth API.
// Served at GET /docs (JSON) — kept hand-maintained next to the routes
// rather than generated, since the Worker has no framework to reflect on.
export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Springforth API',
    version: '0.4.0',
    description:
      'Coordination + funding protocol: possibility graphs, quorum-based ' +
      'commitment, trust-aware quadratic funding, evidence oracles, ' +
      'EigenTrust-gated governance, and signed dataset releases. ' +
      'Non-custodial: chain endpoints return unsigned calldata for wallet signing.',
    license: { name: 'MIT' },
  },
  servers: [{ url: 'https://springforth.widespread.workers.dev' }],
  paths: {
    '/': { get: { summary: 'Triage landing (HTML) or stats (JSON with ?format=json)' } },
    '/possibilities': {
      get: { summary: 'List possibilities' },
      post: { summary: 'Create a possibility ("I want to…" declaration)' },
    },
    '/possibilities/{id}': {
      get: { summary: 'Possibility detail + quorum state', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/plans': { get: { summary: 'List external plan graphs (imports: treegens, silvi, …)' } },
    '/nodes': { get: { summary: 'List plan nodes (actions, needs, offers, outcomes)' } },
    '/overlaps': {
      get: { summary: 'Overlap/complement records across plans' },
      post: { summary: 'Admin: confirm/reject an overlap record' },
    },
    '/signals': {
      get: { summary: 'List signals (interest / support / field-report)' },
      post: { summary: 'Add a signal — field-reports earn measure-to-earn credit' },
    },
    '/commitments': { post: { summary: 'Commit resources to a possibility (quorum input)' } },
    '/actors/{id}': {
      get: { summary: 'Actor profile: activity, recognition, assurance credits, EigenTrust score', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/actors/{id}/bind-wallet': {
      post: { summary: 'Bind an EVM wallet via EIP-191 signature', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/trust': { get: { summary: 'EigenTrust scores over the appreciation graph' } },
    '/rounds': {
      get: { summary: 'List funding rounds' },
      post: { summary: 'Create a round (admin). Supports matchingMode=standard|pairwise, conviction, acceptedTokens' },
    },
    '/rounds/{id}': {
      get: { summary: 'Round detail + live allocation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/rounds/{id}/apply': { post: { summary: 'Submit a round application' } },
    '/rounds/{id}/review': { post: { summary: 'Admin: approve/reject applications' } },
    '/rounds/{id}/close': { post: { summary: 'Admin: freeze allocations → payout intents' } },
    '/rounds/{id}/donate': { post: { summary: 'Record a donation intent' } },
    '/rounds/{id}/pledge': { post: { summary: 'Dominant-assurance pledge (refund if threshold unmet)' } },
    '/rounds/{id}/tx': { get: { summary: 'Unsigned Allo createPool/allocate calldata' } },
    '/rounds/{id}/yield': { post: { summary: 'Admin: register sponsor Aave yield stream' } },
    '/rounds/{id}/export/360giving': { get: { summary: '360Giving JSON export' } },
    '/rounds/{id}/export/iati': { get: { summary: 'IATI activity XML export' } },
    '/rounds/{id}/export/hypercerts': { get: { summary: 'Hypercerts lexicon export' } },
    '/donate': { post: { summary: 'Donate to a need node outside rounds' } },
    '/pledges': { get: { summary: 'List pledges' } },
    '/claims': {
      get: { summary: 'Impact claims (hypercert-shaped)' },
      post: { summary: 'File an impact claim' },
    },
    '/claims/{id}/tx': { get: { summary: 'Unsigned mintClaim calldata' } },
    '/claims/{id}/metadata': { get: { summary: 'Claim metadata document (mint URI)' } },
    '/claims/{id}/artifacts': { post: { summary: 'Link artifact URIs to a claim' } },
    '/attestations': { get: { summary: 'EAS attestation records' } },
    '/attestations/{id}/tx': { get: { summary: 'Unsigned EAS attest() calldata' } },
    '/chain': { get: { summary: 'Chain mode, contract addresses, no-custody flow' } },
    '/chain/record': { post: { summary: 'Record a submitted tx hash — cron confirms + applies side effects' } },
    '/chain/pending': { get: { summary: 'Unconfirmed submitted transactions' } },
    '/retro': { get: { summary: 'Retroactive rounds + EigenTrust badgeholder ballots' } },
    '/governance': {
      get: { summary: 'Proposals, ballots, params, eligible voters (HTML or JSON)' },
    },
    '/governance/proposals': { post: { summary: 'Propose a parameter change (EigenTrust standing required)' } },
    '/governance/{id}/vote': { post: { summary: 'Quadratic ballot on a proposal' } },
    '/governance/{id}/tally': { post: { summary: 'Admin: close + apply param if passed' } },
    '/datasets': { get: { summary: 'Signed dataset release registry' } },
    '/datasets/{name}/release': { post: { summary: 'Admin: freeze slice → JSONL + manifest + OTS + IPFS pin' } },
    '/datasets/{name}/grants': {
      get: { summary: 'List access grants' },
      post: { summary: 'Payment-verified premium access grant' },
    },
    '/oracle/run': { post: { summary: 'Admin: run oracle collection cycle' } },
    '/sources': { get: { summary: 'Registered evidence sources' } },
    '/outcomes': { get: { summary: 'Outcome nodes + evidence trajectories' } },
    '/report/{id}': { get: { summary: 'Composed field report for a node' } },
    '/metrics': { get: { summary: 'Network health/funnel metrics' } },
    '/agent': { post: { summary: 'Deterministic cited natural-language query' } },
    '/import': { post: { summary: 'Admin: import external plans (treegens|silvi|holons|oneplanet|artizen|opencollective|valueflows)' } },
    '/silvi/sync': { post: { summary: 'Admin: sync a Silvi project (per-project apiKey or SILVI_* env pair)' } },
    '/treegens/sync': { post: { summary: 'Admin: sync Treegens plantings' } },
    '/streams': { get: { summary: 'Superfluid recurring-support streams' } },
    '/streams/tx': { post: { summary: 'Unsigned CFA create/deleteFlow calldata' } },
    '/evidence/anchor': { post: { summary: 'Admin: sha256 manifest → ledger' } },
    '/ledger': { get: { summary: 'Hash-chained event ledger' } },
    '/ledger/verify': { get: { summary: 'Verify ledger hash chain integrity' } },
    '/ledger/anchor': { post: { summary: 'Admin: OTS-anchor the ledger head to Bitcoin calendars' } },
    '/coordination': { get: { summary: 'Coordination graph summary' } },
    '/resources': { get: { summary: 'Commons resource library' } },
    '/portfolio': { get: { summary: 'Portfolio view across rounds/possibilities' } },
    '/tg': { post: { summary: 'Telegram webhook (secret-token validated)' } },
    '/verify': { get: { summary: 'Deployment self-check' } },
  },
  components: {
    securitySchemes: {
      admin: { type: 'http', scheme: 'bearer', description: 'ADMIN_TOKEN for writes marked admin' },
    },
  },
} as const;
