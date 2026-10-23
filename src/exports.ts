import { Donation, FundingRound } from './core';
import { NodeMatch } from './funding';

// ── 360giving.ts ────────────────────────────────────
// 360Giving JSON export — the open grantmaking standard
// (standard.threesixtygiving.org). Each allocated need becomes a grant
// record: recipient = the node owner, amount = donations + match, with
// round provenance. CoVE-validatable downstream.

export interface G360Grant {
  id: string;
  title: string;
  description: string;
  currency: string;
  amountAwarded: number;
  awardDate: string;
  recipientOrganization: { id: string; name: string };
  fundingOrganization: { id: string; name: string }[];
  grantProgramme: { title: string };
  fromAnOpenCall?: string;
  beneficiaryLocation?: { name: string };
}

export function to360Giving(opts: {
  round: FundingRound;
  allocation: NodeMatch[];
  needLabels: Map<string, string>;
  needOwners?: Map<string, string>;
  needPlaces?: Map<string, string>;
  publisher: { name: string; orgId: string };
  awardDate?: string;
}): { publisher: { name: string; orgId: string }; grants: G360Grant[] } {
  const { round, allocation, needLabels, needOwners, needPlaces, publisher } = opts;
  return {
    publisher,
    grants: allocation.filter((a) => a.total > 0).map((a) => ({
      id: `${round.id}:${a.needNodeId}`,
      title: needLabels.get(a.needNodeId) ?? a.needNodeId,
      description: `Quadratic allocation — ${a.donorCount} donors gave ${a.donations} ${round.matchingFund.currency}; matching fund added ${a.match}.`,
      currency: round.matchingFund.currency,
      amountAwarded: a.total,
      awardDate: (opts.awardDate ?? round.closesAt).slice(0, 10),
      recipientOrganization: {
        id: needOwners?.get(a.needNodeId) ?? a.needNodeId,
        name: needOwners?.get(a.needNodeId) ?? a.needNodeId,
      },
      fundingOrganization: round.sponsorIds.map((s) => ({ id: s, name: s })),
      grantProgramme: { title: round.title },
      fromAnOpenCall: `https://springforth.widespread.workers.dev/rounds/${round.id}`,
      beneficiaryLocation: needPlaces?.has(a.needNodeId)
        ? { name: needPlaces.get(a.needNodeId)! } : undefined,
    })),
  };
}

// Donations as individual giving records — the breadth evidence behind
// each grant. Companion file to the grants export.
export function donations360(round: FundingRound, donations: Donation[]) {
  return donations.filter((d) => d.roundId === round.id).map((d) => ({
    id: d.id, roundId: d.roundId, needNodeId: d.needNodeId,
    donor: d.donor, amount: d.amount, currency: d.currency,
    settlement: d.settlement, at: d.at,
  }));
}

// ── iati.ts ─────────────────────────────────────────
// IATI 2.03 activity export — the open aid/development transparency
// standard (iatistandard.org). Each allocated need becomes an
// <iati-activity> with transactions for donations + matching-fund share.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toIati(opts: {
  round: FundingRound;
  allocation: NodeMatch[];
  needLabels: Map<string, string>;
  needOwners?: Map<string, string>;
  publisherRef: string;   // IATI organisation identifier
}): string {
  const { round, allocation, needLabels, needOwners, publisherRef } = opts;
  const acts = allocation.filter((a) => a.total > 0).map((a) => {
    const id = `${round.id}:${a.needNodeId}`;
    return `  <iati-activity>
    <iati-identifier>${esc(id)}</iati-identifier>
    <reporting-org ref="${esc(publisherRef)}" type="21">Springforth</reporting-org>
    <title><narrative>${esc(needLabels.get(a.needNodeId) ?? a.needNodeId)}</narrative></title>
    <participating-org role="1" ref="${esc(publisherRef)}"><narrative>Springforth</narrative></participating-org>
    <participating-org role="4" ref="${esc(needOwners?.get(a.needNodeId) ?? a.needNodeId)}"><narrative>${esc(needOwners?.get(a.needNodeId) ?? a.needNodeId)}</narrative></participating-org>
    <activity-status code="2"/>
    <transaction>
      <transaction-type code="1"/>
      <transaction-date iso-date="${round.closesAt.slice(0, 10)}"/>
      <value currency="${esc(round.matchingFund.currency)}" value-date="${round.closesAt.slice(0, 10)}">${a.total}</value>
      <description><narrative>Quadratic allocation: ${a.donorCount} donors (${a.donations}) + match (${a.match})</narrative></description>
    </transaction>
  </iati-activity>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<iati-activities version="2.03" generated-datetime="${new Date().toISOString()}">
${acts}
</iati-activities>`;
}
