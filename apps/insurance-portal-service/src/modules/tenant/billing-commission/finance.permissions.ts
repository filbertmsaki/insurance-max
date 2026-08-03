export const FinancePermissions = {
  INVOICE_ISSUE: 'billing:invoice-issue',
  INVOICE_VOID: 'billing:invoice-void',
  RECEIPT_POST: 'billing:receipt-post',
  RECEIPT_ALLOCATE: 'billing:receipt-allocate',
  RECEIPT_REVERSE: 'billing:receipt-reverse',
  RECONCILIATION_MANAGE: 'billing:reconciliation-manage',
  CLOSING_CREATE: 'billing:closing-create',
  CLOSING_SUBMIT: 'billing:closing-submit',
  CLOSING_APPROVE: 'billing:closing-approve',
  REMITTANCE_CREATE: 'billing:remittance-create',
  REMITTANCE_SUBMIT: 'billing:remittance-submit',
  REMITTANCE_APPROVE: 'billing:remittance-approve',
  REMITTANCE_PAY: 'billing:remittance-pay',
  COMMISSION_SETTLE: 'commissions:settle',
  COMMISSION_APPROVE: 'commissions:approve',
  COMMISSION_PAY: 'commissions:pay',
} as const;

export type FinancePermission =
  (typeof FinancePermissions)[keyof typeof FinancePermissions];
