import type {
  ClaimApproval,
  ClaimClaimant,
  ClaimDetail,
  ClaimRegulatoryOperation,
  ClaimRegulatoryOperationType,
} from './types';

/**
 * The claimant fields TIRAMIS needs at intimation (§10.1), mirroring
 * ClaimsService.assertClaimantsComplete so gaps show before submitting.
 */
export function claimantMissingFields(claimant: ClaimClaimant): string[] {
  return [
    !claimant.full_name && 'name',
    !claimant.claimant_category && 'category',
    !claimant.party_type && 'type',
    !claimant.id_type && 'ID type',
    !claimant.identification_number && 'ID number',
    !claimant.country_code && 'country',
    !claimant.district && 'district',
    !claimant.phone && 'phone number',
    claimant.party_type === 1 && !claimant.gender && 'gender',
  ].filter((field): field is string => !!field);
}

export function activeClaimants(claim: ClaimDetail) {
  return (claim.claimants ?? []).filter(
    (claimant) => claimant.status !== 'REMOVED',
  );
}

const IN_FLIGHT = new Set(['ACCEPTED', 'QUEUED', 'PROCESSING', 'ACKNOWLEDGED']);

/**
 * Claimants are fixed once an intimation is with or accepted by TIRA
 * (ClaimsService.assertClaimantsEditable).
 */
export function claimantsLocked(claim: ClaimDetail) {
  return (
    ['CLOSED', 'CANCELLED'].includes(claim.status) ||
    (claim.regulatory_operations ?? []).some(
      (operation) =>
        operation.operation_type === 'INTIMATION' &&
        IN_FLIGHT.has(operation.status),
    )
  );
}

/** The latest TIRAMIS submission of one record, if any. */
export function operationFor(
  claim: ClaimDetail,
  type: ClaimRegulatoryOperationType,
  sourceRecordId: string,
): ClaimRegulatoryOperation | undefined {
  return [...(claim.regulatory_operations ?? [])]
    .reverse()
    .find(
      (operation) =>
        operation.operation_type === type &&
        operation.source_record_id === sourceRecordId,
    );
}

/** The approval level currently waiting for a decision on a record. */
export function pendingApproval(
  claim: ClaimDetail,
  subjectId: string,
): ClaimApproval | undefined {
  return (claim.approvals ?? [])
    .filter(
      (approval) =>
        approval.subject_id === subjectId && approval.status === 'PENDING',
    )
    .sort((a, b) => b.round - a.round || a.level - b.level)[0];
}

export function userName(claim: ClaimDetail, id?: string | null) {
  if (!id) return '-';
  return claim.user_names?.[id] ?? 'Unknown user';
}
