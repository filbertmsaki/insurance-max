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

/** Payments that still draw on the approved amount (ClaimPaymentService). */
const COMMITTED_PAYMENTS = new Set([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PROCESSING',
  'PAID',
]);

export function acceptedVoucher(claim: ClaimDetail) {
  return [...(claim.discharge_vouchers ?? [])]
    .filter((voucher) => voucher.status === 'ACCEPTED')
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
}

/**
 * What a new payment may still draw: the smaller of the approved amount and
 * the accepted voucher (reconciled amount if any), less committed payments.
 * Mirrors ClaimPaymentService.availableAmount; the server re-checks.
 */
export function payableAmount(claim: ClaimDetail): number {
  const voucher = acceptedVoucher(claim);
  if (!voucher) return 0;
  const voucherAmount = Number(
    voucher.reconciled_amount ?? voucher.claim_offer_amount ?? 0,
  );
  const ceiling = Math.min(voucherAmount, Number(claim.approved_amount ?? 0));
  const committed = (claim.payments ?? [])
    .filter((payment) => COMMITTED_PAYMENTS.has(payment.status))
    .reduce((sum, payment) => sum + Number(payment.paid_amount ?? 0), 0);
  return Math.max(Math.round((ceiling - committed) * 100) / 100, 0);
}

export function userName(claim: ClaimDetail, id?: string | null) {
  if (!id) return '-';
  return claim.user_names?.[id] ?? 'Unknown user';
}
