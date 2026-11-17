// Commitment-pool id conventions. The D1-native exchange math that used to
// live here was removed when the pooling lane moved onto CLC rails
// (docs/CLC-INTEGRATION.md): pools settle on Gnosis SwapPool contracts,
// CLC entities are projections written by src/adapters/clc.ts, and the
// CLC sim repo covers pre-deployment rehearsal.

export const holdingId = (holder: string, voucherId: string) =>
  `hold-${holder}-${voucherId}`;

export const poolHolder = (poolId: string) => `pool:${poolId}`;
export const protocolHolder = (sink: string) => `protocol:${sink}`;
