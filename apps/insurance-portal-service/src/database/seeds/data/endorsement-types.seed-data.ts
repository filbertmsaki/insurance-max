// Starter endorsement types for the Endorsement Wizard. `tira_endorsement_type`
// is intentionally left `null` for every row here - no authoritative TIRA
// numeric endorsement-type code list exists in this repository. Before an
// endorsement of a given type can be submitted to TIRAMIS, a company admin
// must set its real regulator-issued code via the "Endorsement Types" admin
// page (PATCH /tenant/endorsement-types/:id).
export interface EndorsementTypeSeed {
  code: string;
  name: string;
  requires_new_cover_note: boolean;
}

export const ENDORSEMENT_TYPES: EndorsementTypeSeed[] = [
  {
    code: 'INCREASE_SUM_INSURED',
    name: 'Increase Sum Insured',
    requires_new_cover_note: true,
  },
  {
    code: 'DECREASE_SUM_INSURED',
    name: 'Decrease Sum Insured',
    requires_new_cover_note: true,
  },
  {
    code: 'ADD_BENEFIT',
    name: 'Add Benefit / Additional Cover',
    requires_new_cover_note: true,
  },
  {
    code: 'REMOVE_BENEFIT',
    name: 'Remove Benefit / Cover',
    requires_new_cover_note: true,
  },
  {
    code: 'RISK_CORRECTION',
    name: 'Risk / Cover Detail Correction',
    requires_new_cover_note: false,
  },
  {
    code: 'CUSTOMER_DETAILS_CORRECTION',
    name: 'Customer Details Correction',
    requires_new_cover_note: false,
  },
];
