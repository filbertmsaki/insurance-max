import type { UnderwriteLine } from '@insurance-max/contracts';
import {
  buildQuotationDraftPayload,
  quotationRecordToFormValues,
} from '@/modules/tenant/quotations/schemas';
import type {
  QuotationDetailRecord,
  QuotationDraftRecordPayload,
} from '@/modules/tenant/quotations/types';
import { computeCoverNoteDateRange } from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import { defaultValuesForLine } from '@/modules/tenant/underwrite/wizard/defaults';

/** First wizard step of each line: the copy opens at the start. */
const FIRST_STEP: Partial<Record<UnderwriteLine, string>> = {
  MOTOR: 'details',
  FLEET: 'customer',
};

/**
 * Draft request for "Duplicate quotation" (decision D2). Uses the same
 * record-to-form mapping as the edit wizard, keeps the customer, product,
 * vehicles and covers, and starts a fresh one-year cover period from today.
 * The server strips identifiers (cover note numbers, Fleet ID, pricing
 * quotes) and the copy is repriced when it is finalized.
 */
export function buildDuplicateDraft(
  record: QuotationDetailRecord,
  line: UnderwriteLine,
): QuotationDraftRecordPayload {
  const meta = getUnderwriteLineMeta(line);
  const defaults = defaultValuesForLine(meta);
  const draft =
    record.draft_payload && typeof record.draft_payload === 'object'
      ? record.draft_payload
      : {};
  const dates = computeCoverNoteDateRange(365);

  const values = {
    ...defaults,
    ...quotationRecordToFormValues(record),
    ...draft,
    quotation_flow: defaults.quotation_flow,
    quotation_type: defaults.quotation_type,
    is_fleet: defaults.is_fleet,
    status: defaults.status,
    valid_from: dates.validFrom,
    valid_until: dates.validUntil,
  } as typeof defaults;

  return buildQuotationDraftPayload(values, FIRST_STEP[line] ?? null);
}
