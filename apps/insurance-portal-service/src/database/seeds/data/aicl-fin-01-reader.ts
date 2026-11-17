import proposal from './aicl-fin-01-demonstration.json';

/** Data only: importing this file never seeds or activates a company. */
export function readAiclFin01Demonstration() {
  if (
    proposal.purpose !== 'DEMONSTRATION_ONLY' ||
    proposal.status !== 'PROPOSED_NOT_IMPORTED' ||
    proposal.livePosting !== false ||
    proposal.entity.demonstrationIdentifiers.verified !== false ||
    proposal.openingProposal.amountsAreSynthetic !== true
  ) {
    throw new Error('The AICL FIN-01 proposal must remain demonstration-only.');
  }
  return structuredClone(proposal);
}
