import {
  encodeAbiParameters, encodeFunctionData, parseAbiParameters,
  type Address,
} from 'viem';
import type { ChainConfig } from './chains.ts';

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
