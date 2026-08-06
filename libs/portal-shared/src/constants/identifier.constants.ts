export enum IdentifierType {
  QUOTATION = 'QUOTATION',
  COVER_NOTE = 'COVER_NOTE',
  TIRAMIS_REQUEST = 'TIRAMIS_REQUEST',
  PRICING_QUOTE = 'PRICING_QUOTE',
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  PAYMENT_TRANSACTION = 'PAYMENT_TRANSACTION',
  REFUND = 'REFUND',
  COMMISSION_ACCRUAL = 'COMMISSION_ACCRUAL',
  COMMISSION_PAYMENT = 'COMMISSION_PAYMENT',
}

export const IDENTIFIER_CONSTANTS = {
  quotation: 'QTN',
  coverNote: 'CN',
  request: 'REQ',
  invoice: 'INV',
  receipt: 'RCT',
  paymentTransaction: 'PAY',
  refund: 'RFD',
  commissionAccrual: 'CAC',
  commissionPayment: 'CMP',
} as const;

export const IDENTIFIER_SEQUENCE_LENGTHS = {
  // Minimum width — padStart only pads UP to this, so day 1000+ naturally
  // renders as "1000"/"1001" rather than truncating or wrapping.
  quotation: 3,
  coverNote: 4,
  request: 6,
  invoice: 5,
  receipt: 5,
  paymentTransaction: 5,
  refund: 5,
  commissionAccrual: 5,
  commissionPayment: 5,
} as const;

export const IDENTIFIER_DATE_FORMATS = {
  quotation: 'yyMMdd',
  coverNoteDate: 'yyyyMMdd',
  coverNoteTime: 'HHmmss',
  request: 'yyMMdd',
  finance: 'yyMMdd',
} as const;
