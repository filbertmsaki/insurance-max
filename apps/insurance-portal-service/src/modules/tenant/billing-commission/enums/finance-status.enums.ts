export enum InvoiceLifecycleStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  VOID = 'VOID',
  REVERSED = 'REVERSED',
}

export enum ReceiptLifecycleStatus {
  RECEIVED = 'RECEIVED',
  POSTED = 'POSTED',
  PARTIALLY_ALLOCATED = 'PARTIALLY_ALLOCATED',
  ALLOCATED = 'ALLOCATED',
  REVERSED = 'REVERSED',
}

export enum ReceiptAllocationStatus {
  ACTIVE = 'ACTIVE',
  REVERSED = 'REVERSED',
}

export enum ReconciliationStatus {
  UNMATCHED = 'UNMATCHED',
  MATCHED = 'MATCHED',
  EXCEPTION = 'EXCEPTION',
  REVERSED = 'REVERSED',
}

export enum FinancialApprovalStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  RECONCILED = 'RECONCILED',
  CANCELLED = 'CANCELLED',
}

export enum SalesPointClosingStatus {
  OPEN = 'OPEN',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum BankStatementStatus {
  DRAFT = 'DRAFT',
  IMPORTED = 'IMPORTED',
  RECONCILED = 'RECONCILED',
  CLOSED = 'CLOSED',
}
