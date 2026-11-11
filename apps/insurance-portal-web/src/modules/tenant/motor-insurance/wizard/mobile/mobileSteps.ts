import type { UnderwriteWizardStep } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';

/*
 * Phone steps (< 768px). The same quotation fields as the desktop wizards,
 * regrouped into Cover & policyholder → Vehicle(s) → Review. Validation runs
 * on the same schema; only which step a field belongs to changes.
 */

const SOURCE_FIELDS = [
  'channel_type',
  'intermediary_company_id',
  'commission_rate',
  'commission_paid',
] as const;

const SINGLE_COVER_FIELDS: UnderwriteWizardStep['fields'] = [
  'customer_id',
  'policyholder',
  'product_id',
  'risks.0.risk_id',
  'currency',
  'exchange_rate',
  'cover_note_type',
  'valid_from',
  'valid_until',
  'cover_note_desc',
  'operative_clause',
  'risks.0.sum_insured',
];

const FLEET_COVER_FIELDS: UnderwriteWizardStep['fields'] = [
  'customer_id',
  'policyholder',
  'fleet.header',
  'category_id',
  'product_id',
  'currency',
  'exchange_rate',
  'cover_note_type',
  'valid_from',
  'valid_until',
];

function singleSteps(ids: [string, string, string]): UnderwriteWizardStep[] {
  return [
    {
      id: ids[0],
      label: 'Cover',
      description: 'Customer and cover',
      fields: SINGLE_COVER_FIELDS,
    },
    {
      id: ids[1],
      label: 'Vehicle',
      description: 'The insured vehicle',
      fields: ['motor'],
    },
    {
      id: ids[2],
      label: 'Review',
      description: 'Premium and summary',
      fields: ['addons', ...SOURCE_FIELDS, 'payment_mode_tira'],
    },
  ];
}

function fleetSteps(ids: [string, string, string]): UnderwriteWizardStep[] {
  return [
    {
      id: ids[0],
      label: 'Cover',
      description: 'Customer and cover',
      fields: FLEET_COVER_FIELDS,
    },
    {
      id: ids[1],
      label: 'Vehicles',
      description: 'The fleet vehicles',
      fields: ['fleet.items'],
    },
    {
      id: ids[2],
      label: 'Review',
      description: 'Premium and summary',
      fields: [...SOURCE_FIELDS, 'payment_mode_tira'],
    },
  ];
}

export const MOBILE_SINGLE_STEPS = singleSteps([
  'm-cover',
  'm-vehicle',
  'm-review',
]);
export const MOBILE_FLEET_STEPS = fleetSteps([
  'm-cover',
  'm-vehicles',
  'm-review',
]);
/** Short-Term keeps its own step IDs so drafts reopen in the same flow. */
export const MOBILE_SHORT_TERM_SINGLE_STEPS = singleSteps([
  'st-cover',
  'st-vehicles',
  'st-review',
]);
export const MOBILE_SHORT_TERM_FLEET_STEPS = fleetSteps([
  'st-cover',
  'st-vehicles',
  'st-review',
]);

/** Desktop Single Motor step IDs → phone steps (and the reverse). */
export const SINGLE_TO_MOBILE: Record<string, string> = {
  details: 'm-cover',
  'product-cover': 'm-cover',
  'customer-vehicle': 'm-cover',
  'premium-source': 'm-cover',
  customer: 'm-cover',
  vehicle: 'm-vehicle',
  cover: 'm-cover',
  premium: 'm-cover',
  source: 'm-review',
  review: 'm-review',
  'review-submit': 'm-review',
};
export const MOBILE_TO_SINGLE: Record<string, string> = {
  'm-cover': 'details',
  'm-vehicle': 'details',
  'm-review': 'review',
};

/** Desktop Fleet step IDs → phone steps (and the reverse). */
export const FLEET_TO_MOBILE: Record<string, string> = {
  customer: 'm-cover',
  fleet: 'm-cover',
  cover: 'm-cover',
  vehicles: 'm-vehicles',
  source: 'm-review',
  premium: 'm-review',
  review: 'm-review',
};
export const MOBILE_TO_FLEET: Record<string, string> = {
  'm-cover': 'customer',
  'm-vehicles': 'vehicles',
  'm-review': 'review',
};
