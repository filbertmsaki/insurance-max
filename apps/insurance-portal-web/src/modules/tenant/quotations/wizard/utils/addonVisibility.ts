import type { QuotationFormSchemaValues } from '../../schemas';

type RiskLike = {
  premium_rate?: unknown;
  rating_result_metadata?: unknown;
};

/**
 * Add-ons are priced on top of the risk's rate, so they are only offered once
 * the vehicle has a positive premium rate. A zero or not-yet-calculated rate
 * hides the add-on section (add, edit and delete).
 */
export function allowsAddons(premiumRate: unknown): boolean {
  const rate = Number(premiumRate);
  return Number.isFinite(rate) && rate > 0;
}

/**
 * How strictly to judge a risk's add-ons:
 * - `charge`: only a positive rate counts. Used for premium totals, the
 *   summary and final completion — hidden add-ons are never charged.
 * - `draft`: add-ons are dropped only when the risk has been priced and its
 *   final rate is 0. While the rate is cleared for a cover/risk change (not
 *   priced yet) they are kept, so a recalculation never loses them.
 */
export type AddonApplicabilityMode = 'charge' | 'draft';

export function riskKeepsAddons(
  risk: RiskLike | undefined,
  mode: AddonApplicabilityMode,
): boolean {
  if (allowsAddons(risk?.premium_rate)) return true;
  if (mode === 'charge') return false;
  // Draft: unpriced means "recalculating" — keep until a final rate exists.
  return !risk?.rating_result_metadata;
}

/**
 * Motor values with inapplicable add-ons removed (single: the cover note's
 * add-ons; fleet: each vehicle's own add-ons). Non-motor values are returned
 * unchanged. Returns the same object when nothing was removed.
 */
export function withApplicableAddons(
  values: QuotationFormSchemaValues,
  mode: AddonApplicabilityMode,
): QuotationFormSchemaValues {
  if (values.quotation_flow === 'MOTOR_SINGLE') {
    if (!values.addons?.length || riskKeepsAddons(values.risks?.[0], mode)) {
      return values;
    }
    return { ...values, addons: [] };
  }
  if (values.quotation_flow === 'MOTOR_FLEET') {
    const items = values.fleet?.items ?? [];
    let changed = false;
    const next = items.map((item) => {
      if (
        !item.cover_note_addons?.length ||
        riskKeepsAddons(item.risks_covered?.[0], mode)
      ) {
        return item;
      }
      changed = true;
      return { ...item, cover_note_addons: [] };
    });
    return changed
      ? { ...values, fleet: { ...values.fleet, items: next } }
      : values;
  }
  return values;
}
