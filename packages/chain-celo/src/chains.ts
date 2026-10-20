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
