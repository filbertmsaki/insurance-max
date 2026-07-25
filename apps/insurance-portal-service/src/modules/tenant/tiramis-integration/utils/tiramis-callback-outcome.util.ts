import { isTiraSuccessCode } from '../../../tiramis/utils/tiramis-response-normalizer.util';

export const TIRAMIS_SUCCESSFUL_RESPONSE_DESC = 'successful';
export const TIRAMIS_CANCELLATION_RESPONSE_DESC =
  'transaction successfully cancelled';

export type TiramisSuccessOutcome =
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OTHER_SUCCESS'
  | 'NOT_SUCCESS';

export function normalizeTiramisResponseDescription(
  description?: string | null,
): string | null {
  if (description === undefined || description === null) {
    return null;
  }

  const normalized = String(description).trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export function resolveTiramisSuccessOutcome(params: {
  statusCode?: string | null;
  statusDescription?: string | null;
}): TiramisSuccessOutcome {
  if (!isTiraSuccessCode(params.statusCode)) {
    return 'NOT_SUCCESS';
  }

  const normalizedDescription = normalizeTiramisResponseDescription(
    params.statusDescription,
  );

  if (normalizedDescription === TIRAMIS_CANCELLATION_RESPONSE_DESC) {
    return 'CANCELLED';
  }

  if (normalizedDescription === TIRAMIS_SUCCESSFUL_RESPONSE_DESC) {
    return 'COMPLETED';
  }

  return 'OTHER_SUCCESS';
}
