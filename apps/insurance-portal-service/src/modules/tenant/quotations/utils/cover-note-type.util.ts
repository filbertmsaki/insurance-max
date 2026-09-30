/** TIRAMIS CoverNoteType codes. */
export const TIRA_COVER_NOTE_TYPE_NEW = 1;
export const TIRA_COVER_NOTE_TYPE_RENEWAL = 2;
export const TIRA_COVER_NOTE_TYPE_ENDORSEMENT = 3;

const TRANSACTION_COVER_NOTE_TYPES: readonly number[] = [
  TIRA_COVER_NOTE_TYPE_RENEWAL,
  TIRA_COVER_NOTE_TYPE_ENDORSEMENT,
];

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Cover-note type to persist for a quotation. The product version's type is
 * only the new-business default: a renewal (2) or endorsement (3) quotation
 * keeps its own type, whether it arrives on the payload or is implied by the
 * policy-transaction context the draft was generated from.
 */
export function resolveQuotationCoverNoteType(params: {
  productCoverNoteType?: number | null;
  payloadCoverNoteType?: number | string | null;
  draftPayload?: Record<string, unknown> | null;
}): number {
  const requested = Number(params.payloadCoverNoteType);

  if (TRANSACTION_COVER_NOTE_TYPES.includes(requested)) {
    return requested;
  }

  const draft = asObject(params.draftPayload);
  const transactionType = String(
    asObject(draft?.['transaction_context'])?.['type'] ?? '',
  ).toUpperCase();

  if (asObject(draft?.['renewal']) || transactionType === 'RENEWAL') {
    return TIRA_COVER_NOTE_TYPE_RENEWAL;
  }

  if (transactionType === 'ENDORSEMENT' || transactionType === 'CANCELLATION') {
    return TIRA_COVER_NOTE_TYPE_ENDORSEMENT;
  }

  return (
    params.productCoverNoteType ??
    (Number.isInteger(requested) && requested > 0
      ? requested
      : TIRA_COVER_NOTE_TYPE_NEW)
  );
}
