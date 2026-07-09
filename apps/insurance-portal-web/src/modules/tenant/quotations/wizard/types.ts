import type { QuotationType } from '../types';

/**
 * The three quotation flows the wizard supports. Motor Fleet is not a distinct
 * backend `quotation_type` (the enum only has MOTOR/NON_MOTOR) — it's
 * `quotation_type: 'MOTOR'` plus the client-only `is_fleet` flag, mirroring
 * `CreateMotorCoverNoteDto.isFleet` on the TIRA side.
 */
export type QuotationWizardFlow = 'MOTOR' | 'MOTOR_FLEET' | 'NON_MOTOR';

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

export function resolveWizardFlow(quotationType: QuotationType, isFleet: boolean): QuotationWizardFlow {
  if (quotationType === 'MOTOR') return isFleet ? 'MOTOR_FLEET' : 'MOTOR';
  return 'NON_MOTOR';
}

/** Steps visible for a given flow, in wizard order. */
export function getWizardStepsForFlow(flow: QuotationWizardFlow): QuotationWizardStepDef[] {
  const commonHead: QuotationWizardStepId[] = ['cover-note', 'policyholder', 'risk-premium', 'addons'];
  const branch: QuotationWizardStepId =
    flow === 'MOTOR' ? 'motor' : flow === 'MOTOR_FLEET' ? 'motor-fleet' : 'non-motor';
  const ids: QuotationWizardStepId[] = [...commonHead, branch, 'summary'];
  return ids.map((id) => ALL_STEPS[id]);
}
