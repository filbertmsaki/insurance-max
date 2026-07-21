export type QuotationWizardFlow =
  | 'NON_MOTOR'
  | 'MOTOR_SINGLE'
  | 'MOTOR_FLEET';

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
}

const ALL_STEPS: Record<QuotationWizardStepId, QuotationWizardStepDef> = {
  'cover-note': { id: 'cover-note', label: 'Cover Note Setup' },
  'fleet-setup': { id: 'fleet-setup', label: 'Fleet & Cover Note Setup' },
  policyholder: { id: 'policyholder', label: 'Policyholders' },
  'risk-premium': { id: 'risk-premium', label: 'Risks & Premium' },
  addons: { id: 'addons', label: 'Optional Add-ons' },
  motor: { id: 'motor', label: 'Motor Details' },
  'fleet-vehicles': { id: 'fleet-vehicles', label: 'Fleet Vehicles' },
  summary: { id: 'summary', label: 'Review & Submit' },
};

export function resolveWizardFlow(
  quotationFlow: QuotationWizardFlow,
): QuotationWizardFlow {
  return quotationFlow;
}

/** Steps visible for a given flow, in wizard order. */
export function getWizardStepsForFlow(flow: QuotationWizardFlow): QuotationWizardStepDef[] {
  const ids: QuotationWizardStepId[] =
    flow === 'NON_MOTOR'
      ? ['cover-note', 'policyholder', 'risk-premium', 'addons', 'summary']
      : flow === 'MOTOR_SINGLE'
        ? ['cover-note', 'policyholder', 'risk-premium', 'addons', 'motor', 'summary']
        : [
            'fleet-setup',
            'policyholder',
            'fleet-vehicles',
            'summary',
          ];
  return ids.map((id) => ALL_STEPS[id]);
}
