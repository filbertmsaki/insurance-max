// Starter endorsement types for the Endorsement Wizard. `tira_endorsement_type`
// maps each row onto TIRAMIS's fixed CoverNoteDtl.EndorsementType enum
// (TIRAMIS-API spec, CoverNoteRefReq/MotorCoverNoteRefReq, "if cover is
// endorsement i.e. CoverNoteType = 3"):
//   1 - Increasing Premium Charged
//   2 - Decreasing Premium Charged
//   3 - Cover Details Change
//   4 - Cover Cancellation (not applicable to any row here - see
//       PolicyCancellationConfigService, which hardcodes 4 for cancellations)
// This is a small closed enum defined by the regulator, not a per-company
// code, so the mapping below is fixed by what each endorsement does to
// premium. A company admin can still override an individual row's code via
// the "Endorsement Types" admin page (PATCH /tenant/endorsement-types/:id)
// if their local definition of a type doesn't match these defaults.
export interface EndorsementTypeSeed {
  code: string;
  name: string;
  tira_endorsement_type: number;
  requires_new_cover_note: boolean;
}

export const ENDORSEMENT_TYPES: EndorsementTypeSeed[] = [
  {
    code: 'INCREASE_SUM_INSURED',
    name: 'Increase Sum Insured',
    tira_endorsement_type: 1, // Increasing Premium Charged
    requires_new_cover_note: true,
  },
  {
    code: 'DECREASE_SUM_INSURED',
    name: 'Decrease Sum Insured',
    tira_endorsement_type: 2, // Decreasing Premium Charged
    requires_new_cover_note: true,
  },
  {
    code: 'ADD_BENEFIT',
    name: 'Add Benefit / Additional Cover',
    tira_endorsement_type: 1, // Increasing Premium Charged
    requires_new_cover_note: true,
  },
  {
    code: 'REMOVE_BENEFIT',
    name: 'Remove Benefit / Cover',
    tira_endorsement_type: 2, // Decreasing Premium Charged
    requires_new_cover_note: true,
  },
  {
    code: 'RISK_CORRECTION',
    name: 'Risk / Cover Detail Correction',
    tira_endorsement_type: 3, // Cover Details Change
    requires_new_cover_note: false,
  },
  {
    code: 'CUSTOMER_DETAILS_CORRECTION',
    name: 'Customer Details Correction',
    tira_endorsement_type: 3, // Cover Details Change
    requires_new_cover_note: false,
  },
  // Fleet membership changes (Underwrite > Fleet). An added vehicle is sent
  // as a NEW fleet cover note with FleetHdr.FleetType = 2 ("For addition"),
  // so its endorsement type is informational; a removed vehicle is an
  // endorsement on that vehicle's cover note.
  {
    code: 'FLEET_ADD_VEHICLE',
    name: 'Fleet - Add Vehicle',
    tira_endorsement_type: 1, // Increasing Premium Charged
    requires_new_cover_note: true,
  },
  {
    code: 'FLEET_REMOVE_VEHICLE',
    name: 'Fleet - Remove Vehicle',
    tira_endorsement_type: 2, // Decreasing Premium Charged
    requires_new_cover_note: true,
  },
];
