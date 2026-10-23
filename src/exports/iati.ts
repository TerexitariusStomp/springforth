import type { FundingRound } from '../core';
import type { NodeMatch } from '../funding/index';

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
