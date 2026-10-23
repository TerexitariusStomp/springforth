import {
  encodeFunctionData, keccak256, toBytes, type TransactionReceipt,
} from 'viem';

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

export function buildUpdateFlowTx(opts: {
  token: `0x${string}`; sender: `0x${string}`; receiver: `0x${string}`;
  flowRate: bigint;
}) { return flow('updateFlow', opts.token, opts.sender, opts.receiver, opts.flowRate); }

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
