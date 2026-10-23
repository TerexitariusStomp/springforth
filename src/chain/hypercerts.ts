import { encodeFunctionData } from 'viem';
import type { ChainConfig } from './chains.ts';

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
