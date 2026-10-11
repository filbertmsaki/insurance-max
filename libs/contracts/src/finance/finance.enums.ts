export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERPAID: 'OVERPAID',
  VOIDED: 'VOIDED',
  CANCELLED: 'CANCELLED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const InvoiceSourceType = {
  QUOTATION: 'QUOTATION',
  POLICY: 'POLICY',
  ENDORSEMENT: 'ENDORSEMENT',
  CANCELLATION: 'CANCELLATION',
  RENEWAL: 'RENEWAL',
  CLAIM_RECOVERY: 'CLAIM_RECOVERY',
  MANUAL: 'MANUAL',
} as const;

export type InvoiceSourceType =
  (typeof InvoiceSourceType)[keyof typeof InvoiceSourceType];

export const PaymentTransactionStatus = {
  INITIATED: 'INITIATED',
  PENDING: 'PENDING',
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  REVERSED: 'REVERSED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;

export type PaymentTransactionStatus =
  (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  CONTROL_NUMBER: 'CONTROL_NUMBER',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  MOBILE_MONEY: 'MOBILE_MONEY',
  CARD: 'CARD',
  EFT: 'EFT',
  DIRECT_DEBIT: 'DIRECT_DEBIT',
  CREDIT_ACCOUNT: 'CREDIT_ACCOUNT',
  OTHER: 'OTHER',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const ReceiptStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  PARTIALLY_ALLOCATED: 'PARTIALLY_ALLOCATED',
  FULLY_ALLOCATED: 'FULLY_ALLOCATED',
  REVERSED: 'REVERSED',
  VOIDED: 'VOIDED',
} as const;

export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];

export const AllocationStatus = {
  ACTIVE: 'ACTIVE',
  REVERSED: 'REVERSED',
} as const;

export type AllocationStatus =
  (typeof AllocationStatus)[keyof typeof AllocationStatus];

export const RefundStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const ReconciliationBatchStatus = {
  DRAFT: 'DRAFT',
  IMPORTED: 'IMPORTED',
  MATCHING: 'MATCHING',
  PARTIALLY_MATCHED: 'PARTIALLY_MATCHED',
  MATCHED: 'MATCHED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;

export type ReconciliationBatchStatus =
  (typeof ReconciliationBatchStatus)[keyof typeof ReconciliationBatchStatus];

export const ReconciliationItemStatus = {
  UNMATCHED: 'UNMATCHED',
  SUGGESTED: 'SUGGESTED',
  MATCHED: 'MATCHED',
  EXCLUDED: 'EXCLUDED',
  DUPLICATE: 'DUPLICATE',
  DISPUTED: 'DISPUTED',
} as const;

export type ReconciliationItemStatus =
  (typeof ReconciliationItemStatus)[keyof typeof ReconciliationItemStatus];

export const FinanceJournalStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
} as const;

export type FinanceJournalStatus =
  (typeof FinanceJournalStatus)[keyof typeof FinanceJournalStatus];

export const FinanceJournalSourceType = {
  INVOICE: 'INVOICE',
  RECEIPT: 'RECEIPT',
  RECEIPT_REVERSAL: 'RECEIPT_REVERSAL',
  REFUND: 'REFUND',
  WRITE_OFF: 'WRITE_OFF',
  COMMISSION_ACCRUAL: 'COMMISSION_ACCRUAL',
  COMMISSION_PAYMENT: 'COMMISSION_PAYMENT',
} as const;

export type FinanceJournalSourceType =
  (typeof FinanceJournalSourceType)[keyof typeof FinanceJournalSourceType];

export const CommissionAccrualStatus = {
  DRAFT: 'DRAFT',
  ACCRUED: 'ACCRUED',
  APPROVED: 'APPROVED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  REVERSED: 'REVERSED',
  CANCELLED: 'CANCELLED',
} as const;

export type CommissionAccrualStatus =
  (typeof CommissionAccrualStatus)[keyof typeof CommissionAccrualStatus];

export const CommissionPaymentStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
  CANCELLED: 'CANCELLED',
} as const;

export type CommissionPaymentStatus =
  (typeof CommissionPaymentStatus)[keyof typeof CommissionPaymentStatus];
