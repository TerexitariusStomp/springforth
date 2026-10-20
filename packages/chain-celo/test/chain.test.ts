import { describe, expect, it } from 'vitest';
import {
  ALFAJORES, CELO, chainFor, encodeSchemaData, buildAttestTx,
  buildCreateProfileTx, buildCreateRoundTx, buildAllocateTx, buildMintClaimTx,
} from '../src/index.ts';

describe('chain config', () => {
  it('both nets carry the public deployments', () => {
    expect(CELO.chainId).toBe(42220);
    expect(ALFAJORES.chainId).toBe(44787);
    expect(CELO.contracts.hypercertMinter).toBeDefined();
    expect(ALFAJORES.contracts.hypercertMinter).toBeUndefined();
    expect(chainFor('alfajores').contracts.eas).toBe(ALFAJORES.contracts.eas);
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
      cfg: ALFAJORES,
      schemaUid: `0x${'22'.repeat(32)}`,
      schema,
      values: { nodeRef: `0x${'11'.repeat(32)}`, score: 80, sourceURI: 'u' },
    });
    expect(tx.to).toBe(ALFAJORES.contracts.eas);
    expect(tx.data).toMatch(/^0x[0-9a-f]+$/);
  });
});

describe('Allo tx building', () => {
  it('createProfile targets the registry', () => {
    const tx = buildCreateProfileTx({
      cfg: ALFAJORES, nonce: 1n, name: 'springforth',
      owner: '0x0000000000000000000000000000000000000001', metadataPointer: 'ipfs://x',
    });
    expect(tx.to).toBe(ALFAJORES.contracts.alloRegistry);
  });
  it('createRound targets Allo with the QF strategy', () => {
    const tx = buildCreateRoundTx({
      cfg: ALFAJORES, profileId: `0x${'33'.repeat(32)}`,
      initStrategyData: '0x', matchingAmount: 1000000n,
      metadataPointer: 'ipfs://round',
    });
    expect(tx.to).toBe(ALFAJORES.contracts.allo);
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
  it('refuses on Alfajores — minter not deployed there', () => {
    expect(() => buildMintClaimTx({
      cfg: ALFAJORES, account: '0x0000000000000000000000000000000000000001',
      metadataUri: 'x',
    })).toThrow();
  });
});
