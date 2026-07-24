export type TiramisCallbackOutcome =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'FAILED';

export const TIRAMIS_SUCCESS_CODE = 'TIRA001';
export const TIRAMIS_SUCCESS_DESCRIPTION = 'successful';
export const TIRAMIS_CANCELLATION_DESCRIPTION =
  'transaction successfully cancelled';

export function resolveTiramisCallbackOutcome(
  statusCode?: string | null,
  statusDescription?: string | null,
): TiramisCallbackOutcome {
  const code = String(statusCode || '').trim().toUpperCase();
  const description = String(statusDescription || '').trim().toLowerCase();

  if (code !== TIRAMIS_SUCCESS_CODE) {
    return 'FAILED';
  }

  if (description === TIRAMIS_CANCELLATION_DESCRIPTION) {
    return 'CANCELLED';
  }

  if (description === TIRAMIS_SUCCESS_DESCRIPTION) {
    return 'COMPLETED';
  }

  // Preserve the existing success behavior for an unrecognized successful
  // description, while keeping cancellation explicitly description-based.
  return 'SUCCESS';
}
