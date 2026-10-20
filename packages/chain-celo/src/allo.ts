import { encodeFunctionData, type Address } from 'viem';
import type { ChainConfig } from './chains.ts';

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
  return {
    to: opts.cfg.contracts.allo,
    data: encodeFunctionData({
      abi: ALLOCATE_ABI, functionName: 'allocate',
      args: [opts.poolId, opts.strategyData],
    }),
  };
}
