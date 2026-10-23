import type { PublicClient } from 'viem';

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
