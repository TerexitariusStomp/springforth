import { describe, expect, it } from 'vitest';
import { Transaction, Networks, Claimant } from '@stellar/stellar-sdk';
import {
  STELLAR_PUBLIC, STELLAR_TESTNET, stellarNetFor, isStellarId,
  buildStellarPledgeTx, buildStellarPaymentTx, buildStellarUnlockTx,
} from '../src/chain.ts';

// Published StrKey addresses — Stellar's own documented examples + the
// Stellar Development Foundation's public distribution accounts.
const SRC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
const DST = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';

describe('stellar nets', () => {
  it('maps modes to passphrase + horizon', () => {
    expect(stellarNetFor('stellar').passphrase).toBe(Networks.PUBLIC);
    expect(stellarNetFor('stellar-testnet').passphrase).toBe(Networks.TESTNET);
    expect(stellarNetFor('anything-else').name).toBe('stellar-testnet');
    expect(STELLAR_PUBLIC.horizon).toContain('horizon.stellar.org');
    expect(STELLAR_TESTNET.horizon).toContain('testnet');
  });
  it('validates G… strkey shape', () => {
    expect(isStellarId(SRC)).toBe(true);
    expect(isStellarId('GBAD')).toBe(false);
    expect(isStellarId('0x' + 'ab'.repeat(20))).toBe(false);
    expect(isStellarId('')).toBe(false);
  });
});

describe('stellar tx builders', () => {
  it('pledge builds an unsigned envelope with both claimants + flip predicates', () => {
    const { xdr, networkPassphrase } = buildStellarPledgeTx({
      net: STELLAR_TESTNET, source: SRC, sequence: '12345',
      claimant: DST, amount: '25.5', deadlineSec: 1893456000,
      memo: 'pos-midacreek',
    });
    expect(networkPassphrase).toBe(Networks.TESTNET);
    const tx = new Transaction(xdr, Networks.TESTNET);
    expect(tx.signatures.length).toBe(0);               // unsigned handoff
    expect(tx.operations.length).toBe(1);
    const op = tx.operations[0];
    expect(op.type).toBe('createClaimableBalance');
    if (op.type === 'createClaimableBalance') {
      expect(op.amount).toBe('25.5000000');
      expect(op.asset.isNative()).toBe(true);
      expect(op.claimants.length).toBe(2);
      // destination claims BEFORE deadline; source claims NOT(before
      // deadline) — the trustless refund path. Dominant assurance.
      const [dest, src] = op.claimants;
      expect(dest.destination).toBe(DST);
      expect(dest.predicate).toEqual(
        Claimant.predicateBeforeAbsoluteTime('1893456000'));
      expect(src.destination).toBe(SRC);
      expect(src.predicate).toEqual(Claimant.predicateNot(
        Claimant.predicateBeforeAbsoluteTime('1893456000')));
    }
  });

  it('payment builds a native transfer envelope', () => {
    const { xdr } = buildStellarPaymentTx({
      net: STELLAR_PUBLIC, source: SRC, sequence: '999',
      destination: DST, amount: '0.1',
    });
    const tx = new Transaction(xdr, Networks.PUBLIC);
    const op = tx.operations[0];
    expect(op.type).toBe('payment');
    if (op.type === 'payment') {
      expect(op.destination).toBe(DST);
      expect(op.asset.isNative()).toBe(true);
    }
  });

  it('unlock gates the claim on at/after the timestamp', () => {
    const { xdr } = buildStellarUnlockTx({
      net: STELLAR_TESTNET, source: SRC, sequence: '1',
      claimant: DST, amount: '5', unlockSec: 2000000000,
    });
    const tx = new Transaction(xdr, Networks.TESTNET);
    const op = tx.operations[0];
    if (op.type === 'createClaimableBalance') {
      const [only] = op.claimants;
      expect(only.destination).toBe(DST);
      expect(only.predicate).toEqual(Claimant.predicateNot(
        Claimant.predicateBeforeAbsoluteTime('2000000000')));
    } else expect.unreachable('expected claimable balance op');
  });

  it('rejects non-stellar account ids', () => {
    expect(() => buildStellarPaymentTx({
      net: STELLAR_TESTNET, source: 'not-an-account', sequence: '1',
      destination: DST, amount: '1',
    })).toThrow();
  });

  it('issued-asset pledge carries code + issuer', () => {
    const { xdr } = buildStellarPledgeTx({
      net: STELLAR_TESTNET, source: SRC, sequence: '7',
      claimant: DST, amount: '100', assetCode: 'USDC',
      assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      deadlineSec: 1893456000,
    });
    const tx = new Transaction(xdr, Networks.TESTNET);
    const op = tx.operations[0];
    if (op.type === 'createClaimableBalance') {
      expect(op.asset.getCode()).toBe('USDC');
      expect(op.asset.getIssuer()).toBe(
        'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    } else expect.unreachable('expected claimable balance op');
  });
});
