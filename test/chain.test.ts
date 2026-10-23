import { describe, expect, it } from 'vitest';
import {
  CELO, CELO_SEPOLIA, SEPOLIA, chainFor, encodeSchemaData, buildAttestTx,
  buildCreateProfileTx, buildCreateRoundTx, buildAllocateTx, buildMintClaimTx,
} from '../src/chain.ts';

describe('chain config', () => {
  it('both nets carry the public deployments', () => {
    expect(CELO.chainId).toBe(42220);
    expect(CELO_SEPOLIA.chainId).toBe(11142220);
    expect(SEPOLIA.chainId).toBe(11155111);
    expect(CELO.contracts.hypercertMinter).toBeDefined();
    expect(CELO_SEPOLIA.contracts.hypercertMinter).toBeUndefined();
    expect(CELO_SEPOLIA.contracts.eas).toBeUndefined();
    expect(SEPOLIA.contracts.allo).toBe(SEPOLIA.contracts.allo);
    expect(chainFor('celo-sepolia').chainId).toBe(11142220);
    expect(chainFor('celo').contracts.eas).toBe(CELO.contracts.eas);
  });
});

describe('EAS tx building', () => {
  const schema = 'bytes32 nodeRef, uint8 score, string sourceURI';
  it('encodes schema values in declared order', () => {
    const data = encodeSchemaData(schema, {
      nodeRef: `0x${'11'.repeat(32)}`, score: 50,
      sourceURI: 'https://example.test/n1',
    });
    expect(data).toMatch(/^0x[0-9a-f]+$/);
    expect(data.length).toBeGreaterThan(200);
  });
  it('builds attest calldata to the deployed EAS contract', () => {
    const tx = buildAttestTx({
      cfg: CELO,
      schemaUid: `0x${'22'.repeat(32)}`,
      schema,
      values: { nodeRef: `0x${'11'.repeat(32)}`, score: 80, sourceURI: 'u' },
    });
    expect(tx.to).toBe(CELO.contracts.eas);
    expect(tx.data).toMatch(/^0x[0-9a-f]+$/);
  });
});

describe('Allo tx building', () => {
  it('createProfile targets the registry', () => {
    const tx = buildCreateProfileTx({
      cfg: CELO, nonce: 1n, name: 'springforth',
      owner: '0x0000000000000000000000000000000000000001', metadataPointer: 'ipfs://x',
    });
    expect(tx.to).toBe(CELO.contracts.alloRegistry);
  });
  it('createRound targets Allo with the QF strategy', () => {
    const tx = buildCreateRoundTx({
      cfg: CELO, profileId: `0x${'33'.repeat(32)}`,
      initStrategyData: '0x', matchingAmount: 1000000n,
      metadataPointer: 'ipfs://round',
    });
    expect(tx.to).toBe(CELO.contracts.allo);
    expect(tx.data).toMatch(/^0x[0-9a-f]+$/);
  });
  it('allocate targets Allo', () => {
    const tx = buildAllocateTx({ cfg: CELO, poolId: 7n, strategyData: '0x1234' });
    expect(tx.to).toBe(CELO.contracts.allo);
  });
});

describe('hypercert mint', () => {
  it('builds mint calldata on Celo', () => {
    const tx = buildMintClaimTx({
      cfg: CELO, account: '0x0000000000000000000000000000000000000001',
      metadataUri: 'ipfs://claim',
    });
    expect(tx.to).toBe(CELO.contracts.hypercertMinter);
  });
  it('refuses on celo-sepolia — minter not deployed there', () => {
    expect(() => buildMintClaimTx({
      cfg: CELO_SEPOLIA, account: '0x0000000000000000000000000000000000000001',
      metadataUri: 'x',
    })).toThrow();
  });
});

// ── receipt parsing + yield math ─────────────────────────────────────
import { yieldDeltaUnits, unitsToStable, parsePoolId, parseAttestedUid } from '../src/chain.ts';
import { keccak256, toBytes, type TransactionReceipt } from 'viem';

describe('yield delta', () => {
  it('first read establishes principal, no accrual', () => {
    const r = yieldDeltaUnits(undefined, 1000n);
    expect(r.newPrincipal).toBe(true);
    expect(r.delta).toBe(0n);
  });
  it('growth between reads is the accrued delta', () => {
    const r = yieldDeltaUnits(1000n, 1042n);
    expect(r.delta).toBe(42n);
    expect(unitsToStable(42n, 18)).toBeCloseTo(4.2e-17);
    expect(unitsToStable(42000000n, 6)).toBeCloseTo(42);
  });
  it('withdrawal (shrink) clamps to zero', () => {
    expect(yieldDeltaUnits(1000n, 900n).delta).toBe(0n);
  });
});

describe('parsePoolId', () => {
  const ALLO = '0x1133eA7Af70876e64665ecD07C0A0476d09465a1';
  const POOL_TOPIC = keccak256(toBytes(
    'PoolCreated(uint256,bytes32,(bytes32,address,address,(uint256,string),bytes32,bytes32))'));
  const poolLog = (addr: string, poolId: bigint) => ({
    address: addr, data: `0x${'00'.repeat(32)}` as `0x${string}`,
    topics: [POOL_TOPIC,
      `0x${poolId.toString(16).padStart(64, '0')}` as `0x${string}`],
  });
  it('returns null for a receipt with no Allo log', () => {
    const receipt = { logs: [] } as unknown as TransactionReceipt;
    expect(parsePoolId(receipt, ALLO)).toBeNull();
  });
  it('ignores logs from other addresses', () => {
    const receipt = {
      logs: [poolLog('0x0000000000000000000000000000000000000001', 7n)],
    } as unknown as TransactionReceipt;
    expect(parsePoolId(receipt, ALLO)).toBeNull();
  });
  it('decodes the indexed poolId from topics[1]', () => {
    const receipt = { logs: [poolLog(ALLO, 42n)] } as unknown as TransactionReceipt;
    expect(parsePoolId(receipt, ALLO)).toBe(42n);
  });
});

describe('parseAttestedUid', () => {
  const EAS = '0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92';
  const ATT_TOPIC = keccak256(toBytes('Attested(address,address,bytes32,bytes32)'));
  const uid = `0x${'ab'.repeat(32)}` as `0x${string}`;
  it('returns log.data as the uid on an EAS Attested log', () => {
    const receipt = { logs: [{ address: EAS, data: uid,
      topics: [ATT_TOPIC, `0x${'00'.repeat(32)}`, `0x${'11'.repeat(32)}`,
        `0x${'22'.repeat(32)}`] }] } as unknown as TransactionReceipt;
    expect(parseAttestedUid(receipt, EAS)).toBe(uid);
  });
  it('returns null when no matching log exists', () => {
    const receipt = { logs: [{ address: EAS, data: uid,
      topics: [`0x${'ff'.repeat(32)}`] }] } as unknown as TransactionReceipt;
    expect(parseAttestedUid(receipt, EAS)).toBeNull();
  });
});

// ── Silvi sponsorship rail ───────────────────────────────────────────
import { buildSponsorSpeciesTx, buildErc20ApproveTx, parseSilviSponsorship } from '../src/chain.ts';
import { encodeAbiParameters, parseAbiParameters } from 'viem';

describe('silvi sponsorship', () => {
  const CONTRACT = '0x0000000000000000000000000000000000000511' as `0x${string}`;
  it('builds approve + sponsorSpecies calldata', () => {
    const approve = buildErc20ApproveTx({
      token: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
      spender: CONTRACT, amount: 3000000n,
    });
    expect(approve.data.startsWith('0x095ea7b3')).toBe(true); // approve(
    const tx = buildSponsorSpeciesTx({ contract: CONTRACT, taxonId: 'x' });
    expect(tx.to).toBe(CONTRACT);
    expect(tx.data).toMatch(/^0x[0-9a-f]+$/);
  });
  it('parses SponsorshipReceived from a receipt', () => {
    const c = '0x0000000000000000000000000000000000000abc' as `0x${string}`;
    const sender = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;
    const topic = keccak256(toBytes('SponsorshipReceived(address,string,uint256,string)'));
    const data = encodeAbiParameters(
      parseAbiParameters('string taxon_id, uint256 amount, string transaction_hash'),
      ['taxon-123', 3000000n, '0xabc']);
    const receipt = { logs: [{ address: c, data,
      topics: [topic,
        `0x${'0'.repeat(24)}${sender.slice(2)}` as `0x${string}`] }] } as unknown as TransactionReceipt;
    const r = parseSilviSponsorship(receipt, c);
    expect(r!.taxonId).toBe('taxon-123');
    expect(r!.amount).toBe(3000000n);
    expect(r!.sender.toLowerCase()).toBe(sender.toLowerCase());
  });
});
