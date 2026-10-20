import { createHash } from 'node:crypto';

// FR-22/D3 — evidence integrity: SHA-256 manifest over a milestone's
// evidence bundle + OpenTimestamps anchoring (submit/receipt interface).
// The anchoring client is injectable; production uses an OTS calendar
// endpoint, tests use a deterministic stub. Case-kit custody pattern.

const digest = (b: Uint8Array | string) =>
  createHash('sha256').update(typeof b === 'string' ? Buffer.from(b) : b).digest('hex');

export interface EvidenceFile { name: string; bytes: Uint8Array; }

export function buildManifest(files: EvidenceFile[]) {
  const entries = files
    .map((f) => ({ name: f.name, sha256: digest(f.bytes), bytes: f.bytes.length }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const manifestText = entries.map((e) => `${e.sha256}  ${e.name}  (${e.bytes})`).join('\n');
  return { entries, manifestText, manifestDigest: digest(manifestText) };
}

export interface AnchorClient {
  // Submit a digest for timestamping; returns an OTS receipt blob.
  stamp(digestHex: string): Promise<string>;
  // Verify a receipt against a digest (best-effort; real impl checks chain).
  verify(digestHex: string, receipt: string): Promise<boolean>;
}

export class LocalAnchorClient implements AnchorClient {
  // Dev/stub client: receipt = deterministic commitment to digest+secret.
  // NOT a timestamp proof — exists so the pipeline shape is testable until
  // an OTS calendar endpoint is wired (one-line swap).
  async stamp(digestHex: string) { return `localots:${digest(digestHex + ':localots')}`; }
  async verify(digestHex: string, receipt: string) {
    return receipt === `localots:${digest(digestHex + ':localots')}`;
  }
}

export async function anchorEvidence(files: EvidenceFile[], client: AnchorClient) {
  const m = buildManifest(files);
  return { ...m, otsReceipt: await client.stamp(m.manifestDigest) };
}
