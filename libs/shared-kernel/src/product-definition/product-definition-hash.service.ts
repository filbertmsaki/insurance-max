import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * Canonical hashing used by both Portal and TIRAMIS to fingerprint a
 * published product definition and individual wording fields. Both
 * services must use this exact implementation — a signed hash produced
 * here by Portal must be reproducible byte-for-byte by TIRAMIS.
 */
@Injectable()
export class ProductDefinitionHashService {
  hashDefinition(definition: Record<string, unknown>): string {
    return createHash('sha256')
      .update(this.canonicalize(definition), 'utf8')
      .digest('hex');
  }

  hashText(value: string | null | undefined): string {
    return createHash('sha256')
      .update(this.normalizeText(value), 'utf8')
      .digest('hex');
  }

  private canonicalize(value: unknown): string {
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

    if (typeof value === 'string') {
      return value.trim().replace(/\r\n/g, '\n');
    }

    return value;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ');
  }
}
