import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuotationRecalculationService {
  createInputSignature(input: unknown): string {
    const canonical = this.toCanonicalJson(input);
    return createHash('sha256').update(canonical).digest('hex');
  }

  isRecalculationRequired(
    previousSignature: string | null | undefined,
    nextInput: unknown,
  ): boolean {
    if (!previousSignature) {
      return true;
    }

    return previousSignature !== this.createInputSignature(nextInput);
  }

  private toCanonicalJson(value: unknown): string {
    return JSON.stringify(this.sortValue(value));
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }

    return value;
  }
}
