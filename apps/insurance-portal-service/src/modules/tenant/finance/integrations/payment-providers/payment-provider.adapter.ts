import {
  PaymentTransactionStatus,
  RefundStatus,
} from '@insurance-max/contracts';

export interface PaymentProviderEvent {
  providerCode: string;
  eventId: string;
  eventType: string;
  providerTransactionId: string;
  status: PaymentTransactionStatus;
  amount: string;
  currencyCode: string;
  payerName: string | null;
  payerPhone: string | null;
  payerEmail: string | null;
  paymentReference: string | null;
  receivedAt: Date | null;
  settledAt: Date | null;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  readonly providerCode: string;

  verifySignature(
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<boolean>;

  parseEvent(
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<PaymentProviderEvent>;

  initiateRefund?(request: {
    providerTransactionId: string;
    amount: string;
    currencyCode: string;
    idempotencyKey: string;
  }): Promise<{
    providerRefundId: string;
    status: RefundStatus;
  }>;
}
