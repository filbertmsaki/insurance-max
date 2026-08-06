import type {
  InvoiceStatus,
  PaymentMethod,
  PaymentTransactionStatus,
  ReceiptStatus,
} from './finance.enums';

export interface InvoiceBalanceSnapshot {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currencyCode: string;
  totalAmount: string;
  allocatedAmount: string;
  refundedAmount: string;
  writtenOffAmount: string;
  balanceAmount: string;
  revision: number;
  balanceHash: string;
  calculatedAt: string;
}

export interface ReceiptAllocationSnapshot {
  allocationId: string;
  receiptId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  allocatedAmount: string;
  currencyCode: string;
  allocationStatus: string;
  allocatedAt: string;
}

export interface PostedReceiptSnapshot {
  receiptId: string;
  receiptNumber: string;
  paymentTransactionId: string | null;
  payerCustomerId: string | null;
  payerName: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  providerReference: string | null;
  currencyCode: string;
  exchangeRate: string;
  receiptAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  status: ReceiptStatus;
  postedAt: string;
  postedBy: string;
  receiptHash: string;
}

export interface PaymentTransactionSnapshot {
  paymentTransactionId: string;
  transactionNumber: string;
  providerCode: string;
  providerTransactionId: string | null;
  status: PaymentTransactionStatus;
  paymentMethod: PaymentMethod;
  customerId: string | null;
  amount: string;
  currencyCode: string;
  providerAmount: string | null;
  providerCurrencyCode: string | null;
  receivedAt: string | null;
  settledAt: string | null;
  transactionHash: string;
}

export interface QuotationFinanceEvent {
  eventId: string;
  companyId: string;
  quotationId: string;
  workflowRevision: number;
  invoiceId: string;
  eventType:
    | 'PAYMENT_PROCESSING'
    | 'PAYMENT_POSTED'
    | 'PAYMENT_REVERSED'
    | 'PAYMENT_FAILED'
    | 'PAYMENT_REFUNDED';
  allocatedAmount: string;
  totalAllocatedAmount: string;
  currencyCode: string;
  receiptId: string | null;
  refundId: string | null;
  occurredAt: string;
}

export interface ServiceFinanceContext {
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  requiredAmount: string;
  allocatedAmount: string;
  balanceAmount: string;
  currencyCode: string;
  latestReceiptId: string | null;
  latestReceiptNumber: string | null;
  paymentGateHash: string;
  commissionRate: string | null;
  commissionAmount: string | null;
  commissionAccrualId: string | null;
}
