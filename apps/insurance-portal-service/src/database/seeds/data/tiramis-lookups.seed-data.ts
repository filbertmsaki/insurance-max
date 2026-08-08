export const TIRAMIS_LOOKUPS = [
  { group: 'COVER_NOTE_TYPE', code: '1', label: 'New' },
  { group: 'COVER_NOTE_TYPE', code: '2', label: 'Renew' },
  { group: 'COVER_NOTE_TYPE', code: '3', label: 'Endorsement' },

  { group: 'PAYMENT_MODE', code: '1', label: 'Cash' },
  { group: 'PAYMENT_MODE', code: '2', label: 'Cheque' },
  { group: 'PAYMENT_MODE', code: '3', label: 'EFT' },

  { group: 'POLICY_HOLDER_TYPE', code: '1', label: 'Individual' },
  { group: 'POLICY_HOLDER_TYPE', code: '2', label: 'Corporate' },

  { group: 'IDENTITY_TYPE', code: '1', label: 'National ID' },
  { group: 'IDENTITY_TYPE', code: '2', label: 'Voter ID' },
  { group: 'IDENTITY_TYPE', code: '3', label: 'Passport' },
  { group: 'IDENTITY_TYPE', code: '4', label: 'Driving License' },
  { group: 'IDENTITY_TYPE', code: '5', label: 'Tax Identification Number' },

  { group: 'GENDER', code: 'M', label: 'Male' },
  { group: 'GENDER', code: 'F', label: 'Female' },

  { group: 'MOTOR_CATEGORY', code: '1', label: 'Motor Vehicle' },
  { group: 'MOTOR_CATEGORY', code: '2', label: 'Motor Cycle' },

  { group: 'MOTOR_TYPE', code: '1', label: 'Registered' },
  { group: 'MOTOR_TYPE', code: '2', label: 'In Transit' },

  { group: 'MOTOR_USAGE', code: '1', label: 'Private' },
  { group: 'MOTOR_USAGE', code: '2', label: 'Commercial' },

  { group: 'OWNER_CATEGORY', code: '1', label: 'Sole Proprietor' },
  { group: 'OWNER_CATEGORY', code: '2', label: 'Corporate' },

  { group: 'TAX_CODE', code: 'VAT-MAINLAND', label: 'VAT Mainland' },
  { group: 'TAX_CODE', code: 'WITHHOLDING', label: 'Withholding Tax' },

  { group: 'REINSURANCE_CATEGORY', code: '1', label: 'Facultative' },
  { group: 'REINSURANCE_CATEGORY', code: '2', label: 'Treaty' },
  { group: 'PARTICIPANT_TYPE', code: '1', label: 'Lead Reinsurer' },
  { group: 'PARTICIPANT_TYPE', code: '2', label: 'Following Reinsurer' },
  { group: 'REINSURANCE_FORM', code: '1', label: 'Proportional' },
  { group: 'REINSURANCE_FORM', code: '2', label: 'Non-Proportional' },
  { group: 'REINSURANCE_TYPE', code: '1', label: 'Quota Share' },
  { group: 'REINSURANCE_TYPE', code: '2', label: 'Surplus' },
  { group: 'LOSS_ASSESSMENT_OPTION', code: '1', label: 'Internal Assessor' },
  { group: 'LOSS_ASSESSMENT_OPTION', code: '2', label: 'External Assessor' },
] as const;
