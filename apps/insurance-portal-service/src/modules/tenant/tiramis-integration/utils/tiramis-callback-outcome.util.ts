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

export type TiramisCallbackOutcome =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'FAILED';

export const TIRAMIS_SUCCESS_CODE = 'TIRA001';
export const TIRAMIS_SUCCESS_DESCRIPTION = TIRAMIS_SUCCESSFUL_RESPONSE_DESC;
export const TIRAMIS_CANCELLATION_DESCRIPTION =
  TIRAMIS_CANCELLATION_RESPONSE_DESC;

export function resolveTiramisCallbackOutcome(
  statusCode?: string | null,
  statusDescription?: string | null,
): TiramisCallbackOutcome {
  const outcome = resolveTiramisSuccessOutcome({
    statusCode,
    statusDescription,
  });

  switch (outcome) {
    case 'CANCELLED':
      return 'CANCELLED';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'OTHER_SUCCESS':
      return 'SUCCESS';
    default:
      return 'FAILED';
  }
}
