export type QuotationWizardFlow = 'NON_MOTOR' | 'MOTOR_SINGLE' | 'MOTOR_FLEET';

export type QuotationWizardStepId =
  | 'cover-note'
  | 'fleet-setup'
  | 'policyholder'
  | 'risk-premium'
  | 'addons'
  | 'motor'
  | 'fleet-vehicles'
  | 'summary';

export interface QuotationWizardStepDef {
  id: QuotationWizardStepId;
  label: string;
  description: string;
}

const ALL_STEPS: Record<QuotationWizardStepId, QuotationWizardStepDef> = {
  'cover-note': {
    id: 'cover-note',
    label: 'Customer & Cover',
    description: 'Select the customer, product, and cover period',
  },
  'fleet-setup': {
    id: 'fleet-setup',
    label: 'Customer & Cover',
    description: 'Select the customer, fleet product, and cover period',
  },
  policyholder: {
    id: 'policyholder',
    label: 'Policyholder',
    description: 'Select an existing customer or capture a new one',
  },
  'risk-premium': {
    id: 'risk-premium',
    label: 'Risk & Premium',
    description: 'Add insured risks and calculate premium',
  },
  addons: {
    id: 'addons',
    label: 'Cover & premium',
    description: 'Review optional covers and the premium calculation',
  },
  motor: {
    id: 'motor',
    label: 'Motor/Risk & Premium',
    description: 'Complete vehicle details and calculate premium',
  },
  'fleet-vehicles': {
    id: 'fleet-vehicles',
    label: 'Fleet risks',
    description: 'Add and validate each vehicle in the fleet',
  },
  summary: {
    id: 'summary',
    label: 'Review & Complete',
    description: 'Check the quotation before completing the draft',
  },
};

export function resolveWizardFlow(
  quotationFlow: QuotationWizardFlow,
): QuotationWizardFlow {
  return quotationFlow;
}

/** Steps visible for a given flow, in wizard order. */
export function getWizardStepsForFlow(
  flow: QuotationWizardFlow,
): QuotationWizardStepDef[] {
  const ids: QuotationWizardStepId[] =
    flow === 'NON_MOTOR'
      ? ['cover-note', 'risk-premium', 'summary']
      : flow === 'MOTOR_SINGLE'
        ? ['cover-note', 'motor', 'summary']
        : ['fleet-setup', 'policyholder', 'fleet-vehicles', 'summary'];
  return ids.map((id) => ALL_STEPS[id]);
}
