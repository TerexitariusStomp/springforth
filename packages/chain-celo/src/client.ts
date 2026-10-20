import {
  createPublicClient, http, keccak256, toBytes,
  type Chain, type PublicClient, type TransactionReceipt,
} from 'viem';
import { celo, celoSepolia, sepolia } from 'viem/chains';
import type { ChainConfig } from './chains.ts';

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
