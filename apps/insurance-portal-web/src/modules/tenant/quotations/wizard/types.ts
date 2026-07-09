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
  policyholder: { id: 'policyholder', label: 'Policyholder' },
  'risk-premium': { id: 'risk-premium', label: 'Risk & Premium' },
  addons: { id: 'addons', label: 'Add-ons' },
  motor: { id: 'motor', label: 'Motor Details' },
  'motor-fleet': { id: 'motor-fleet', label: 'Fleet Details' },
  'non-motor': { id: 'non-motor', label: 'Non-Motor Details' },
  summary: { id: 'summary', label: 'Summary & Review' },
};

export function resolveWizardFlow(
  quotationFlow: QuotationWizardFlow,
): QuotationWizardFlow {
  return quotationFlow;
}

/** Steps visible for a given flow, in wizard order. */
export function getWizardStepsForFlow(flow: QuotationWizardFlow): QuotationWizardStepDef[] {
  const commonHead: QuotationWizardStepId[] = ['cover-note', 'policyholder', 'risk-premium', 'addons'];
  const branch: QuotationWizardStepId =
    flow === 'MOTOR_SINGLE'
      ? 'motor'
      : flow === 'MOTOR_FLEET'
        ? 'motor-fleet'
        : 'non-motor';
  const ids: QuotationWizardStepId[] = [...commonHead, branch, 'summary'];
  return ids.map((id) => ALL_STEPS[id]);
}
