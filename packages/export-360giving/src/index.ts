import type { Donation, FundingRound } from '@springforth/core';
import type { NodeMatch } from '@springforth/funding';

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
