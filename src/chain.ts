import { createPublicClient, http, keccak256, toBytes, verifyMessage, isAddress, type Chain, type PublicClient, type TransactionReceipt, encodeFunctionData, type Address, encodeAbiParameters, parseAbiParameters, decodeEventLog, parseAbiItem } from 'viem';
import { celo, celoSepolia, sepolia } from 'viem/chains';

// ── index.ts ──────────────────────────────────────────


// ── chains.ts ─────────────────────────────────────────
// Chain configuration — every deployment address below is a PUBLIC
// protocol deployment, verified on-chain via getBytecode + contract
// getters on 2026-10-20. Nothing here custodies user funds.
//
// Verification results:
//   celo          — EAS / SchemaRegistry (getSchemaRegistry() agrees) /
//                   Allo proxy / Registry / QF strategy / HypercertMinter
//                   / cUSD — ALL LIVE (block 80.6M)
//   celo-sepolia  — chain live (block 39.2M), NO protocol deployments
//                   found at known addresses — contracts must be
//                   deployed there before it can prove anything
//   sepolia       — Allo proxy + Registry + QF strategy verified live;
//                   EAS deployment address unresolved (0xC267… exists
//                   but doesn't answer getSchemaRegistry)
//   alfajores     — DECOMMISSIONED: DNS dead, chainlist marks deprecated
//                   (replaced by celo-sepolia after the L2 migration)

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  contracts: {
    // EAS — ethereum-attestation-service/eas-contracts
    eas?: `0x${string}`;
    easSchemaRegistry?: `0x${string}`;
    // HypercertMinter UUPS proxy — hypercerts-org/hypercerts
    // (deployments table; Celo only)
    hypercertMinter?: `0x${string}`;
    // Allo v2 — allo-protocol/allo-v2 (AGPL-3.0)
    allo?: `0x${string}`;
    alloRegistry?: `0x${string}`;
    // QF strategy — DonationVotingMerkleDistributionDirectTransferStrategy
    alloQfStrategy?: `0x${string}`;
  };
  // stable donation currency — cUSD on Celo
  stable?: `0x${string}`;
}

export const CELO: ChainConfig = {
  chainId: 42220, name: 'celo',
  rpcUrl: 'https://forno.celo.org',
  explorer: 'https://celoscan.io',
  contracts: {
    eas: '0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92',
    easSchemaRegistry: '0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34',
    hypercertMinter: '0x16bA53B74c234C870c61EFC04cD418B8f2865959',
    allo: '0x1133eA7Af70876e64665ecD07C0A0476d09465a1',
    alloRegistry: '0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3',
    alloQfStrategy: '0x787eC93Dd71a90563979417879F5a3298389227f',
  },
  stable: '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
};

export const CELO_SEPOLIA: ChainConfig = {
  chainId: 11142220, name: 'celo-sepolia',
  rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org',
  explorer: 'https://celo-sepolia.blockscout.com',
  contracts: {
    // Verified EMPTY at the cross-chain addresses (2026-10-20). The
    // proving ground exists once the public contracts are deployed —
    // same deterministic deployers should reproduce the Celo addresses.
  },
};

export const SEPOLIA: ChainConfig = {
  chainId: 11155111, name: 'sepolia',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  explorer: 'https://sepolia.etherscan.io',
  contracts: {
    // Allo v2 — verified deployed (2026-10-20)
    allo: '0x1133eA7Af70876e64665ecD07C0A0476d09465a1',
    alloRegistry: '0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3',
    alloQfStrategy: '0x787eC93Dd71a90563979417879F5a3298389227f',
  },
};

export type ChainMode = 'celo-sepolia' | 'sepolia' | 'celo';
export function chainFor(mode: ChainMode): ChainConfig {
  return mode === 'celo' ? CELO : mode === 'sepolia' ? SEPOLIA : CELO_SEPOLIA;
}

// ── client.ts ─────────────────────────────────────────
// Read-side client — viem (MIT). The worker only ever reads the chain
// and builds unsigned calldata; signing always happens in the user's
// wallet. rpcUrl override lets the worker point at a paid RPC in prod.

const VIEM_CHAINS: Record<number, Chain> = {
  [celo.id]: celo, [celoSepolia.id]: celoSepolia, [sepolia.id]: sepolia,
};

export function publicClientFor(cfg: ChainConfig, rpcOverride?: string): PublicClient {
  const chain = VIEM_CHAINS[cfg.chainId];
  if (!chain) throw new Error(`no viem chain def for ${cfg.chainId}`);
  return createPublicClient({
    chain,
    transport: http(rpcOverride ?? cfg.rpcUrl),
  });
}

// Event signature topics — keccak of the canonical event signature.
const ATT_EAS = keccak256(toBytes(
  'Attested(address,address,bytes32,bytes32)'));
const EVT_POOL_CREATED = keccak256(toBytes(
  'PoolCreated(uint256,bytes32,(bytes32,address,address,(uint256,string),bytes32,bytes32))'));

// EAS Attested(recipient indexed, attester indexed, uid, schemaUID
// indexed) — uid is the sole non-indexed field, so log.data IS the uid.
export function parseAttestedUid(
  receipt: TransactionReceipt, easAddress: `0x${string}`,
): `0x${string}` | null {
  const log = receipt.logs.find((l) =>
    l.address.toLowerCase() === easAddress.toLowerCase()
    && l.topics[0] === ATT_EAS);
  return log ? (log.data as `0x${string}`) : null;
}

// EIP-191 wallet↔actor binding: the address owner personal_signs a
// canonical "springforth bind <actor>" message; verification is
// signature recovery, no chain call needed. Works for any EOA wallet;
// ERC-1271 contract wallets (Safes) are out of scope for v1.
export function bindMessage(actor: string): string {
  return `springforth bind actor:${actor}`;
}
export async function verifyWalletBinding(
  actor: string, address: string, signature: string,
): Promise<boolean> {
  if (!isAddress(address)) return false;
  try {
    return await verifyMessage({
      address: address as `0x${string}`,
      message: bindMessage(actor),
      signature: signature as `0x${string}`,
    });
  } catch { return false; }
}

// Allo PoolCreated — poolId is the first indexed arg → topics[1].
export function parsePoolId(
  receipt: TransactionReceipt, alloAddress: `0x${string}`,
): bigint | null {
  const log = receipt.logs.find((l) =>
    l.address.toLowerCase() === alloAddress.toLowerCase()
    && l.topics[0] === EVT_POOL_CREATED);
  const t = log?.topics[1];
  return t ? BigInt(t) : null;
}

// ── allo.ts ───────────────────────────────────────────
// Allo v2 client — allo-protocol/allo-v2 (AGPL-3.0, same addresses on
// every supported network per its README). A funding round maps to an
// Allo "pool": the poolId is stored on FundingRound.chainRef. Custody
// and distribution live entirely in the deployed public strategy
// (DonationVotingMerkleDistributionDirectTransferStrategy) — we never
// write escrow code.

// createPoolWithCustomStrategy(profileId, strategy, initData, token,
// amount, metadata, managers)
const ALLO_ABI = [{
  name: 'createPoolWithCustomStrategy', type: 'function', stateMutability: 'payable',
  inputs: [
    { name: 'profileId', type: 'bytes32' },
    { name: 'strategy', type: 'address' },
    { name: 'initStrategyData', type: 'bytes' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'metadata', type: 'tuple', components: [
      { name: 'protocol', type: 'uint256' }, { name: 'pointer', type: 'string' }] },
    { name: 'managers', type: 'address[]' },
  ],
  outputs: [{ name: 'poolId', type: 'uint256' }],
}] as const;

// allocate(poolId, data) — donation-voting call; the strategy's
// DonationVoting.allocate records a donation+vote for a recipient.
const ALLOCATE_ABI = [{
  name: 'allocate', type: 'function', stateMutability: 'payable',
  inputs: [{ name: 'poolId', type: 'uint256' }, { name: 'data', type: 'bytes' }],
  outputs: [],
}] as const;

// createProfile(nonce, name, metadata, owner, members) → profileId —
// an Allo registry profile is required before pool creation.
const REGISTRY_ABI = [{
  name: 'createProfile', type: 'function', stateMutability: 'nonpayable',
  inputs: [
    { name: 'nonce', type: 'uint256' },
    { name: 'name', type: 'string' },
    { name: 'metadata', type: 'tuple', components: [
      { name: 'protocol', type: 'uint256' }, { name: 'pointer', type: 'string' }] },
    { name: 'owner', type: 'address' },
    { name: 'members', type: 'address[]' },
  ],
  outputs: [{ name: '', type: 'bytes32' }],
}] as const;

export function buildCreateProfileTx(opts: {
  cfg: ChainConfig; nonce: bigint; name: string; owner: Address;
  metadataPointer: string;
}): { to: `0x${string}`; data: `0x${string}` } {
  if (!opts.cfg.contracts.alloRegistry)
    throw new Error(`Allo registry not deployed on ${opts.cfg.name}`);
  return {
    to: opts.cfg.contracts.alloRegistry,
    data: encodeFunctionData({
      abi: REGISTRY_ABI, functionName: 'createProfile',
      args: [opts.nonce, opts.name,
        { protocol: 1n, pointer: opts.metadataPointer },
        opts.owner, []],
    }),
  };
}

// Matching-fund round → Allo pool. `token` is the donation/matching
// currency (cUSD on Celo); `amount` pre-funds the matching side.
export function buildCreateRoundTx(opts: {
  cfg: ChainConfig; profileId: `0x${string}`; initStrategyData: `0x${string}`;
  matchingAmount: bigint; metadataPointer: string; managers?: Address[];
}): { to: `0x${string}`; data: `0x${string}` } {
  if (!opts.cfg.contracts.allo || !opts.cfg.contracts.alloQfStrategy
    || !opts.cfg.stable)
    throw new Error(`Allo/strategy/stable not fully deployed on ${opts.cfg.name}`);
  return {
    to: opts.cfg.contracts.allo,
    data: encodeFunctionData({
      abi: ALLO_ABI, functionName: 'createPoolWithCustomStrategy',
      args: [opts.profileId, opts.cfg.contracts.alloQfStrategy,
        opts.initStrategyData, opts.cfg.stable, opts.matchingAmount,
        { protocol: 1n, pointer: opts.metadataPointer },
        opts.managers ?? []],
    }),
  };
}

// A donation on-chain → allocate(poolId, strategy-encoded data). The
// strategy defines the inner encoding (recipientId, token, amount,
// permit/sig) — this lane ships the outer call and leaves the inner
// blob to the signer-side SDK.
export function buildAllocateTx(opts: {
  cfg: ChainConfig; poolId: bigint; strategyData: `0x${string}`;
}): { to: `0x${string}`; data: `0x${string}` } {
  if (!opts.cfg.contracts.allo)
    throw new Error(`Allo not deployed on ${opts.cfg.name}`);
  return {
    to: opts.cfg.contracts.allo,
    data: encodeFunctionData({
      abi: ALLOCATE_ABI, functionName: 'allocate',
      args: [opts.poolId, opts.strategyData],
    }),
  };
}

// ── eas.ts ────────────────────────────────────────────
// EAS write — Ethereum Attestation Service (open protocol; deployments
// cited in chains.ts). We build raw calldata with viem so any signer
// (WalletConnect, Safe, portal connect) can submit — no heavy SDK in
// the worker.

const EAS_ABI = [{
  name: 'attest', type: 'function', stateMutability: 'payable',
  inputs: [{
    name: 'request', type: 'tuple',
    components: [
      { name: 'schema', type: 'bytes32' },
      {
        name: 'data', type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'revocable', type: 'bool' },
          { name: 'refUID', type: 'bytes32' },
          { name: 'data', type: 'bytes' },
          { name: 'value', type: 'uint256' },
        ],
      },
    ],
  }],
  outputs: [{ name: '', type: 'bytes32' }],
}] as const;

const ZERO_UID = `0x${'0'.repeat(64)}` as `0x${string}`;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address;

// Encode schema-declared values (schema string like
// 'bytes32 nodeRef, uint8 score, string sourceURI') → `bytes data`.
export function encodeSchemaData(
  schema: string, values: Record<string, unknown>,
): `0x${string}` {
  const fields = schema.split(',').map((s) => {
    const parts = s.trim().split(/\s+/);
    return { type: parts[0]!, name: parts[1]! };
  });
  return encodeAbiParameters(
    parseAbiParameters(fields.map((f) => `${f.type} ${f.name}`).join(',')),
    fields.map((f) => {
      const v = values[f.name];
      if (f.type.startsWith('uint')) return BigInt(v as number);
      if (f.type === 'bool') return Boolean(v);
      if (f.type === 'string') return String(v);
      return v as `0x${string}` | Address;
    }) as never[]);
}

// Build the attest() calldata — caller hands `to`/`data` to any signer.
export function buildAttestTx(opts: {
  cfg: ChainConfig; schemaUid: `0x${string}`;
  schema: string; values: Record<string, unknown>;
  recipient?: Address; refUID?: `0x${string}`;
}): { to: `0x${string}`; data: `0x${string}` } {
  if (!opts.cfg.contracts.eas)
    throw new Error(`EAS not deployed on ${opts.cfg.name}`);
  return {
    to: opts.cfg.contracts.eas,
    data: encodeFunctionData({
      abi: EAS_ABI, functionName: 'attest',
      args: [{
        schema: opts.schemaUid,
        data: {
          recipient: opts.recipient ?? ZERO_ADDR,
          expirationTime: 0n,
          revocable: true,
          refUID: opts.refUID ?? ZERO_UID,
          data: encodeSchemaData(opts.schema, opts.values),
          value: 0n,
        },
      }],
    }),
  };
}

// ── hypercerts.ts ─────────────────────────────────────
// Hypercert mint lane — HypercertMinter UUPS proxy on Celo
// (hypercerts-org, deployed address in chains.ts). A Springforth
// ImpactClaim mints as a single-unit claim: work scope + timeframe +
// contributor allowlist — evaluated via EAS, never traded.

// mintClaim(account, units, uri, restrictions)
const MINTER_ABI = [{
  name: 'mintClaim', type: 'function', stateMutability: 'nonpayable',
  inputs: [
    { name: 'account', type: 'address' },
    { name: 'units', type: 'uint256' },
    { name: 'uri', type: 'string' },
    { name: 'restrictions', type: 'uint8' },
  ],
  outputs: [],
}] as const;

export function buildMintClaimTx(opts: {
  cfg: ChainConfig; account: `0x${string}`;
  metadataUri: string;           // IPFS/worker URL serving claim metadata JSON
  restrictions?: 0 | 1 | 2;      // 0 AllowAll · 1 DisallowAll · 2 FromCreatorOnly
}): { to: `0x${string}`; data: `0x${string}` } {
  if (!opts.cfg.contracts.hypercertMinter)
    throw new Error('hypercert minter not deployed on this chain');
  return {
    to: opts.cfg.contracts.hypercertMinter,
    data: encodeFunctionData({
      abi: MINTER_ABI, functionName: 'mintClaim',
      args: [opts.account, 1n, opts.metadataUri, opts.restrictions ?? 2],
    }),
  };
}

// ── silvi.ts ──────────────────────────────────────────
// Silvi sponsorship rail — SilviProtocol/silvi contracts (MIT):
// ResearchSponsorshipPayment collects exactly 3 USDC per species and
// emits SponsorshipReceived; their backend then triggers research and
// mints a ContreebutionNFT to the sender. A Springforth donation can
// settle on this rail: the donation's settlementRef becomes the
// sponsorship tx hash via the normal POST /chain/record flow.
//
// Contract addresses are NOT public in their repo (env-configured
// upstream) — callers pass them explicitly via env.

// sponsorSpecies(string taxon_id) — pulls 3 USDC via transferFrom, so
// the signer must approve(spender, 3e6) first (buildErc20ApproveTx).
const SPONSOR_ABI = [{
  name: 'sponsorSpecies', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'taxon_id', type: 'string' }],
  outputs: [],
}] as const;

const ERC20_APPROVE_ABI = [{
  name: 'approve', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

// SponsorshipReceived(address indexed sender, string taxon_id,
// uint256 amount, string transaction_hash) — non-indexed args in data.
const SPONSORED_EVENT = parseAbiItem(
  'event SponsorshipReceived(address indexed sender, string taxon_id, uint256 amount, string transaction_hash)');
const EVT_SPONSORED = keccak256(toBytes(
  'SponsorshipReceived(address,string,uint256,string)'));

export function buildErc20ApproveTx(opts: {
  token: `0x${string}`; spender: `0x${string}`; amount: bigint;
}): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: opts.token,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI, functionName: 'approve',
      args: [opts.spender, opts.amount],
    }),
  };
}

// The 3-USDC species sponsorship call. Signer = sponsor (donor).
export function buildSponsorSpeciesTx(opts: {
  contract: `0x${string}`; taxonId: string;
}): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: opts.contract,
    data: encodeFunctionData({
      abi: SPONSOR_ABI, functionName: 'sponsorSpecies',
      args: [opts.taxonId],
    }),
  };
}

export interface SilviSponsorship {
  sender: `0x${string}`; taxonId: string; amount: bigint;
}

// Decode the SponsorshipReceived log from a receipt — confirms both the
// payment and which species it funded.
export function parseSilviSponsorship(
  receipt: TransactionReceipt, contract: `0x${string}`,
): SilviSponsorship | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
    if (log.topics[0] !== EVT_SPONSORED) continue;
    try {
      const d = decodeEventLog({
        abi: [SPONSORED_EVENT], data: log.data, topics: log.topics,
      });
      const a = d.args as { sender?: `0x${string}`; taxon_id?: string; amount?: bigint };
      if (a.sender && a.taxon_id !== undefined && a.amount !== undefined)
        return { sender: a.sender, taxonId: a.taxon_id, amount: a.amount };
    } catch { /* not this event */ }
  }
  return null;
}

// ── aave.ts ───────────────────────────────────────────
// Yield-bearing position reader — Aave-v3-style aTokens are rebasing
// ERC20s: balanceOf grows as yield accrues. Reading the delta between
// two reads yields the accrued amount in raw units. Aave v3 runs on
// Celo (app.aave.com markets list) — the sponsor's own address holds
// the position, nothing custodies.

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

export async function readTokenBalance(
  client: PublicClient,
  token: `0x${string}`, holder: `0x${string}`,
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [holder],
  }) as Promise<bigint>;
}

// Pure delta — raw units of accrual between two reads. Exported for
// tests; a negative delta (partial withdrawal) clamps to zero, the
// stream owner reconciles withdrawals off-band.
export function yieldDeltaUnits(last: bigint | undefined, current: bigint): {
  delta: bigint; newPrincipal: boolean;
} {
  if (last === undefined) return { delta: 0n, newPrincipal: true };
  return { delta: current > last ? current - last : 0n, newPrincipal: false };
}

export function unitsToStable(delta: bigint, decimals: number): number {
  return Number(delta) / 10 ** decimals;
}

// ── superfluid.ts ─────────────────────────────────────
// Superfluid CFA (Constant Flow Agreement) — continuous per-second
// streams. On Celo the canonical entry point is CFAv1Forwarder
// (0xcfA132E353cB4E398080B9700609bb008eceB125 — same address across
// Superfluid networks). We build unsigned calldata for the supporter's
// wallet; the worker never holds the flow.
//
// Protocol: Apache-2.0 (superfluid-finance/protocol-monorepo).
// Docs: docs.superfluid.org — createFlow(token, sender, receiver,
// flowRate:int96, userData:bytes).

export const CFA_FORWARDER =
  '0xcfA132E353cB4E398080B9700609bb008eceB125' as const;

const CFA_ABI = [
  {
    name: 'createFlow',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'flowRate', type: 'int96' },
      { name: 'userData', type: 'bytes' },
    ],
  },
  {
    name: 'updateFlow',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'newRate', type: 'int96' },
      { name: 'userData', type: 'bytes' },
    ],
  },
  {
    name: 'deleteFlow',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'userData', type: 'bytes' },
    ],
  },
] as const;

const flow = (
  fn: 'createFlow' | 'updateFlow' | 'deleteFlow',
  token: `0x${string}`, sender: `0x${string}`, receiver: `0x${string}`,
  rate?: bigint,
) => ({
  to: CFA_FORWARDER as `0x${string}`,
  data: encodeFunctionData({
    abi: CFA_ABI, functionName: fn,
    args: fn === 'deleteFlow'
      ? [token, sender, receiver, '0x' as `0x${string}`]
      : [token, sender, receiver, rate ?? 0n, '0x' as `0x${string}`],
  }),
});

export function buildCreateFlowTx(opts: {
  token: `0x${string}`; sender: `0x${string}`; receiver: `0x${string}`;
  flowRate: bigint;
}) { return flow('createFlow', opts.token, opts.sender, opts.receiver, opts.flowRate); }

export function buildDeleteFlowTx(opts: {
  token: `0x${string}`; sender: `0x${string}`; receiver: `0x${string}`;
}) { return flow('deleteFlow', opts.token, opts.sender, opts.receiver); }

// FlowUpdated(address indexed token, address indexed sender,
// address indexed receiver, int96 flowRate, int96 totalSenderFlowRate,
// int96 totalReceiverFlowRate, bytes userData)
const EVT_FLOW_UPDATED = keccak256(toBytes(
  'FlowUpdated(address,address,address,int96,int96,int96,bytes)'));

// Parse a receipt for the FlowUpdated event at the forwarder — returns
// the per-second flow rate once the tx confirms.
export function parseFlowRate(
  receipt: TransactionReceipt, forwarder = CFA_FORWARDER,
): { flowRate: bigint } | null {
  const log = receipt.logs.find((l) =>
    l.address.toLowerCase() === forwarder.toLowerCase()
    && l.topics[0] === EVT_FLOW_UPDATED);
  if (!log) return null;
  // flowRate is the first non-indexed field → first 32 bytes of data.
  const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
  const rate = BigInt(`0x${data.slice(0, 64)}`);
  return { flowRate: rate };
}

// Accrual math: elapsed seconds × rate, bigint-safe.
export function streamAccrual(
  flowRate: bigint, fromMs: number, toMs: number,
): bigint {
  if (toMs <= fromMs) return 0n;
  return flowRate * BigInt(Math.floor((toMs - fromMs) / 1000));
}

// ── stellar.ts ────────────────────────────────────────
// Stellar lane — @stellar/stellar-sdk (Apache-2.0, official SDF SDK).
// Claimable balances are Stellar's native dominant-assurance primitive
// (Tabarrok 1998): a pledge locks funds claimable by the destination
// only while its predicate holds — below we gate the destination's
// claim on an absolute deadline and give the source the NOT of that
// predicate, so when the window lapses the pledge sweeps back to the
// pledger. Match-locked funding with a trustless refund path, no
// contract deployment or audit surface. Same non-custodial shape as
// the EVM lanes: builders emit UNSIGNED XDR; the signer's wallet
// (Freighter et al.) signs + submits; the hash posts back through
// /chain/stellar/record for ledger attribution.
//
// Sequence numbers live on the account and move between reads, so the
// endpoint fetches them from Horizon at build time — builders take
// `sequence` explicitly to stay pure/testable.

import {
  Account, Asset, Claimant, Memo, Networks, Operation,
  TransactionBuilder, xdr,
} from '@stellar/stellar-sdk';

export interface StellarNet {
  name: 'stellar' | 'stellar-testnet';
  horizon: string;
  passphrase: string;
}

export const STELLAR_PUBLIC: StellarNet = {
  name: 'stellar',
  horizon: 'https://horizon.stellar.org',
  passphrase: Networks.PUBLIC,
};
export const STELLAR_TESTNET: StellarNet = {
  name: 'stellar-testnet',
  horizon: 'https://horizon-testnet.stellar.org',
  passphrase: Networks.TESTNET,
};

export function stellarNetFor(mode: string): StellarNet {
  return mode === 'stellar' ? STELLAR_PUBLIC : STELLAR_TESTNET;
}

// Stellar "G…" addresses are strkey-ed25519 — 56 chars, G prefix.
export const isStellarId = (s: string) => /^G[A-Z2-7]{55}$/.test(s);

// Horizon REST — sequence numbers live on the account record. Workers-
// safe: plain fetch, no SDK server plumbing.
export async function fetchSequence(
  net: StellarNet, source: string,
): Promise<string> {
  const r = await fetch(`${net.horizon}/accounts/${source}`);
  if (!r.ok) throw new Error(`horizon account lookup failed: ${r.status}`);
  const a = await r.json() as { sequence: string };
  return a.sequence;
}

const assetFor = (code?: string, issuer?: string): Asset =>
  !code || code === 'XLM' ? Asset.native() : new Asset(code, issuer ?? '');

export interface StellarUnsigned {
  xdr: string;                    // unsigned envelope — hand to a wallet
  networkPassphrase: string;      // wallet must sign for this network
}

function buildEnvelope(opts: {
  net: StellarNet; source: string; sequence: string;
  ops: xdr.Operation[];
  memo?: string;
}): StellarUnsigned {
  if (!isStellarId(opts.source)) throw new Error('source must be a G… account id');
  const account = new Account(opts.source, opts.sequence);
  const b = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: opts.net.passphrase,
  });
  for (const op of opts.ops) b.addOperation(op);
  if (opts.memo) b.addMemo(Memo.text(opts.memo.slice(0, 28)));
  // setTimeout(0) → maxTime 0 → envelope never expires — it stays valid
  // until signed; signing latency is the user's, not the chain's.
  b.setTimeout(0);
  return { xdr: b.build().toXDR(), networkPassphrase: opts.net.passphrase };
}

// Dominant-assurance pledge → createClaimableBalance. The destination
// can claim while now < deadlineSec (quorum reached inside the window);
// once the window lapses the predicate flips and the SOURCE reclaims.
// Exactly Tabarrok: commit only binds if the collective condition met.
export function buildStellarPledgeTx(opts: {
  net: StellarNet; source: string; sequence: string;
  claimant: string; amount: string;
  assetCode?: string; assetIssuer?: string;
  deadlineSec: number; memo?: string;
}): StellarUnsigned {
  if (!isStellarId(opts.claimant)) throw new Error('claimant must be a G… account id');
  const deadline = String(Math.floor(opts.deadlineSec));
  return buildEnvelope({
    net: opts.net, source: opts.source, sequence: opts.sequence,
    memo: opts.memo,
    ops: [Operation.createClaimableBalance({
      asset: assetFor(opts.assetCode, opts.assetIssuer),
      amount: opts.amount,
      claimants: [
        new Claimant(opts.claimant, Claimant.predicateBeforeAbsoluteTime(deadline)),
        new Claimant(opts.source, Claimant.predicateNot(
          Claimant.predicateBeforeAbsoluteTime(deadline))),
      ],
    })],
  });
}

// Plain payment — the settle leg once a bound pledge releases.
export function buildStellarPaymentTx(opts: {
  net: StellarNet; source: string; sequence: string;
  destination: string; amount: string;
  assetCode?: string; assetIssuer?: string; memo?: string;
}): StellarUnsigned {
  if (!isStellarId(opts.destination)) throw new Error('destination must be a G… account id');
  return buildEnvelope({
    net: opts.net, source: opts.source, sequence: opts.sequence,
    memo: opts.memo,
    ops: [Operation.payment({
      destination: opts.destination,
      asset: assetFor(opts.assetCode, opts.assetIssuer),
      amount: opts.amount,
    })],
  });
}

// Scheduled disbursement — claimable balance the destination can only
// claim AT/AFTER unlockSec (predicate = NOT before unlock). Milestone-
// gated release without a contract: claim fails until the timestamp
// and the ledger holds the funds in the meantime.
export function buildStellarUnlockTx(opts: {
  net: StellarNet; source: string; sequence: string;
  claimant: string; amount: string;
  assetCode?: string; assetIssuer?: string;
  unlockSec: number; memo?: string;
}): StellarUnsigned {
  if (!isStellarId(opts.claimant)) throw new Error('claimant must be a G… account id');
  const unlock = String(Math.floor(opts.unlockSec));
  return buildEnvelope({
    net: opts.net, source: opts.source, sequence: opts.sequence,
    memo: opts.memo,
    ops: [Operation.createClaimableBalance({
      asset: assetFor(opts.assetCode, opts.assetIssuer),
      amount: opts.amount,
      claimants: [
        new Claimant(opts.claimant, Claimant.predicateNot(
          Claimant.predicateBeforeAbsoluteTime(unlock))),
      ],
    })],
  });
}
