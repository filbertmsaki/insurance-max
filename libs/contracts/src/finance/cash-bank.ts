export const CASH_BANK_GROUPS = {
  'Bank and till setup': {
    BANK: 'Register bank or branch',
    OFFICE: 'Create cash office',
    AMEND_BANK: 'Amend bank or operator',
    AMEND_OFFICE: 'Amend cash office',
    CLOSE_MASTER: 'Close bank or cash office',
    ACCOUNT: 'Register bank account, wallet or till',
    CASHIER: 'Assign cashier',
    REVOKE_CASHIER: 'End cashier assignment',
    AMEND_ACCOUNT: 'Amend account or till policy',
    DEACTIVATE: 'Close account',
  },
  'Cash desk': {
    OPEN: 'Open cashier shift',
    RECEIPT: 'General cash receipt',
    PAYMENT: 'Cash payment',
    COUNT: 'Record physical count',
    SHORTAGE: 'Post cash shortage',
    OVERAGE: 'Post cash overage',
    CLOSE: 'Close cashier shift',
  },
  'Bank movements': {
    DEPOSIT: 'Deposit cash',
    WITHDRAW: 'Withdraw cash',
    REPLENISH: 'Replenish petty cash',
    TRANSFER: 'Transfer between accounts',
    RECEIVE: 'Confirm transfer arrival',
    FX_SETTLE: 'Clear transfer exchange difference',
    REVERSE: 'Reverse cash or bank voucher',
  },
  'Payment channels': {
    CHEQUEBOOK: 'Register cheque book',
    CHEQUE: 'Issue cheque',
    PRESENT: 'Present cheque',
    STOP: 'Stop cheque',
    VOID: 'Cancel cheque',
    DISHONOUR: 'Record dishonoured cheque',
    EFT: 'Prepare EFT instruction',
    EFT_SETTLE: 'Confirm EFT settlement',
    EFT_CANCEL: 'Cancel unexecuted EFT',
    EFT_LINK: 'Settle EFT against an existing payment',
    WALLET_SETTLE: 'Settle mobile wallet into bank',
  },
  'Statements and reconciliation': {
    STATEMENT: 'Import bank statement',
    MATCH: 'Match statement line',
    AUTO_MATCH: 'Match exact references',
    TIMING: 'Document outstanding item',
    UNMATCH: 'Remove incorrect match',
    BANK_RULE: 'Configure charge or interest rule',
    END_RULE: 'Retire charge or interest rule',
    FEE: 'Post bank charge',
    INTEREST: 'Post bank interest',
    SIGNOFF: 'Sign off statement',
  },
  'Treasury and forecasts': {
    PLAN: 'Plan cash inflow or outflow',
    CANCEL_PLAN: 'Cancel planned movement',
  },
} as const;
type Groups = typeof CASH_BANK_GROUPS;
export type CashBankKind = {
  [K in keyof Groups]: keyof Groups[K];
}[keyof Groups];
export type CashBankInput = {
  requestKey: string;
  kind: CashBankKind;
  reference: string;
  date: string;
  fields: Record<string, string>;
  dimensions?: Record<string, string>;
  evidence?: { id: string; documentId: string; hash: string };
};
export const CASH_BANK_MODULES = [
  ['01', 'Bank master data', 'Bank and till setup', 'BANK'],
  ['02', 'Bank account management', 'Bank and till setup', 'ACCOUNT'],
  ['03', 'Cash offices', 'Bank and till setup', 'OFFICE'],
  ['04', 'Cashier management', 'Bank and till setup', 'CASHIER'],
  ['05', 'Petty cash', 'Bank movements', 'REPLENISH'],
  ['06', 'Cash receipts', 'Cash desk', 'RECEIPT'],
  ['07', 'Cash payments', 'Cash desk', 'PAYMENT'],
  ['08', 'Bank deposits', 'Bank movements', 'DEPOSIT'],
  ['09', 'Bank withdrawals', 'Bank movements', 'WITHDRAW'],
  ['10', 'Bank transfers', 'Bank movements', 'TRANSFER'],
  ['11', 'Cheque management', 'Payment channels', 'CHEQUEBOOK'],
  ['12', 'Electronic funds transfer', 'Payment channels', 'EFT'],
  ['13', 'Mobile money collections', 'Payment channels', 'WALLET_SETTLE'],
  ['14', 'Bank statement import', 'Statements and reconciliation', 'STATEMENT'],
  ['15', 'Bank reconciliation', 'Statements and reconciliation', 'SIGNOFF'],
  ['16', 'Cash reconciliation', 'Cash desk', 'COUNT'],
  ['17', 'Cashier opening and closing', 'Cash desk', 'OPEN'],
  ['18', 'Cash flow forecasting', 'Treasury and forecasts', 'PLAN'],
  ['19', 'Treasury management', 'Treasury and forecasts', ''],
  ['20', 'Bank charges and interest', 'Statements and reconciliation', 'FEE'],
] as const;
