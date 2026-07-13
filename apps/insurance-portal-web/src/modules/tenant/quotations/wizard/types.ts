export type QuotationWizardFlow =
  | 'NON_MOTOR'
  | 'MOTOR_SINGLE'
  | 'MOTOR_FLEET';

export type QuotationWizardStepId =
  | 'cover-note'
  | 'policyholder'
  | 'risk-premium'
  | 'addons'
  | 'motor'
  | 'motor-fleet'
  | 'non-motor'
  | 'summary';

export interface QuotationWizardStepDef {
  id: QuotationWizardStepId;
  label: string;
}

const ALL_STEPS: Record<QuotationWizardStepId, QuotationWizardStepDef> = {
  'cover-note': { id: 'cover-note', label: 'Cover Note Setup' },
  policyholder: { id: 'policyholder', label: 'Policyholders' },
  'risk-premium': { id: 'risk-premium', label: 'Risks & Premium' },
  addons: { id: 'addons', label: 'Optional Add-ons' },
  motor: { id: 'motor', label: 'Motor Details' },
  'motor-fleet': { id: 'motor-fleet', label: 'Fleet Vehicles' },
  'non-motor': { id: 'non-motor', label: 'Subject Matters' },
  summary: { id: 'summary', label: 'Review & Submit' },
};

export function resolveWizardFlow(
  quotationFlow: QuotationWizardFlow,
): QuotationWizardFlow {
  return quotationFlow;
}

/** Steps visible for a given flow, in wizard order. */
export function getWizardStepsForFlow(flow: QuotationWizardFlow): QuotationWizardStepDef[] {
  const commonHead: QuotationWizardStepId[] = ['cover-note', 'policyholder', 'risk-premium'];
  const branchSteps: QuotationWizardStepId[] =
    flow === 'NON_MOTOR'
      ? ['non-motor', 'addons']
      : flow === 'MOTOR_SINGLE'
        ? ['motor', 'addons']
        : ['motor-fleet', 'addons'];
  const ids: QuotationWizardStepId[] = [...commonHead, ...branchSteps, 'summary'];
  return ids.map((id) => ALL_STEPS[id]);
}
