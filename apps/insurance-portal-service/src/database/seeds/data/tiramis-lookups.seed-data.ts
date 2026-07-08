export const TIRAMIS_LOOKUPS = [
  { group: 'COVER_NOTE_TYPE', code: '1', label: 'New' },
  { group: 'COVER_NOTE_TYPE', code: '2', label: 'Renew' },
  { group: 'COVER_NOTE_TYPE', code: '3', label: 'Endorsement' },

  { group: 'PAYMENT_MODE', code: '1', label: 'Cash' },
  { group: 'PAYMENT_MODE', code: '2', label: 'Cheque' },
  { group: 'PAYMENT_MODE', code: '3', label: 'EFT' },

  { group: 'POLICY_HOLDER_TYPE', code: '1', label: 'Individual' },
  { group: 'POLICY_HOLDER_TYPE', code: '2', label: 'Corporate' },

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
] as const;
