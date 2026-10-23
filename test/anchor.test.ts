import { describe, expect, it } from 'vitest';
import { anchorEvidence, buildManifest, LocalAnchorClient } from '../src/attest.ts';

describe('evidence-anchor', () => {
  const files = [
    { name: 'report.pdf', bytes: new TextEncoder().encode('report body') },
    { name: 'photos.zip', bytes: new TextEncoder().encode('photo bytes') },
  ];

  it('builds deterministic sorted manifest with sha256', () => {
    const m1 = buildManifest(files);
    const m2 = buildManifest([...files].reverse());
    expect(m1.manifestDigest).toBe(m2.manifestDigest); // order-independent
    expect(m1.entries[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(m1.entries[0]!.name).toBe('photos.zip');
  });

  it('anchors manifest digest and verifies receipt', async () => {
    const client = new LocalAnchorClient();
    const a = await anchorEvidence(files, client);
    expect(a.otsReceipt.startsWith('localots:')).toBe(true);
    expect(await client.verify(a.manifestDigest, a.otsReceipt)).toBe(true);
    expect(await client.verify('0'.repeat(64), a.otsReceipt)).toBe(false);
  });
});
