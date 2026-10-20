// Chain configuration — Celo mainnet + Alfajores testnet. Every
// deployment address below is a PUBLIC protocol deployment, cited to
// its upstream repo. Nothing here custodies user funds.

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  contracts: {
    // EAS v1.3.0 — ethereum-attestation-service/eas-contracts
    // deployments/celo + deployments/celo-alfajores
    eas: `0x${string}`;
    easSchemaRegistry: `0x${string}`;
    // HypercertMinter UUPS proxy — hypercerts-org/hypercerts
    // (deployments table; Celo only, no Alfajores)
    hypercertMinter?: `0x${string}`;
    // Allo v2 — allo-protocol/allo-v2 (AGPL-3.0)
    allo: `0x${string}`;
    alloRegistry: `0x${string}`;
    // QF strategy — DonationVotingMerkleDistributionDirectTransferStrategy
    alloQfStrategy: `0x${string}`;
  };
  // cUSD stable — gas/donation currency on Celo
  stable: `0x${string}`;
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

export const ALFAJORES: ChainConfig = {
  chainId: 44787, name: 'alfajores',
  rpcUrl: 'https://alfajores-forno.celo-testnet.org',
  explorer: 'https://alfajores.celoscan.io',
  contracts: {
    // EAS v1.3.0 — deployments/celo-alfajores
    eas: '0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92',
    easSchemaRegistry: '0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34',
    // Allo v2 same addresses across supported networks (per allo-v2 README)
    allo: '0x1133eA7Af70876e64665ecD07C0A0476d09465a1',
    alloRegistry: '0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3',
    alloQfStrategy: '0x787eC93Dd71a90563979417879F5a3298389227f',
  },
  stable: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', // Alfajores cUSD
};

export type ChainMode = 'alfajores' | 'celo';
export function chainFor(mode: ChainMode): ChainConfig {
  return mode === 'celo' ? CELO : ALFAJORES;
}
