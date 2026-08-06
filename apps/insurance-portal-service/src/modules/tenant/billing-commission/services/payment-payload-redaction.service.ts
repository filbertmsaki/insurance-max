import { Injectable } from '@nestjs/common';

const REDACTED = '[REDACTED]';
const SENSITIVE_FIELD_TOKENS = [
  'authorization',
  'password',
  'secret',
  'signature',
  'token',
  'cvv',
  'pan',
  'card',
  'account',
  'iban',
  'msisdn',
];
const PARTIAL_MASK_FIELD_TOKENS = ['phone', 'mobile', 'email', 'payer', 'name'];

@Injectable()
export class PaymentPayloadRedactionService {
  redactPaymentPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.redactValue(payload, '') as Record<string, unknown>;
  }

  private redactValue(value: unknown, key: string): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item, key));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(
          ([entryKey, entryValue]) => [
            entryKey,
            this.redactValue(entryValue, entryKey),
          ],
        ),
      );
    }

    const normalizedKey = key.trim().toLowerCase();

    if (
      normalizedKey &&
      SENSITIVE_FIELD_TOKENS.some((token) => normalizedKey.includes(token))
    ) {
      return REDACTED;
    }

    if (
      typeof value === 'string' &&
      normalizedKey &&
      PARTIAL_MASK_FIELD_TOKENS.some((token) => normalizedKey.includes(token))
    ) {
      return this.maskString(value);
    }

    return value;
  }

  private maskString(value: string): string {
    const trimmed = value.trim();

    if (trimmed.length <= 4) {
      return REDACTED;
    }

    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
}
