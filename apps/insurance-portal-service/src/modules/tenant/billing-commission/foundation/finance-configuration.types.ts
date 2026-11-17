import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { FinancePrincipal } from './finance-scope.service';

export const CONFIGURATION_KINDS = [
  'POSTING_RULES',
  'ACCOUNT_ROLES',
  'DIMENSIONS',
  'TAX_RULES',
  'CURRENCY_RULES',
  'SOURCE_ASSOCIATIONS',
  'APPROVAL_RULES',
  'EVENT_CONTRACTS',
  'EVENT_ROUTES',
  'INTEGRATION_RULES',
  'EXCEPTION_RULES',
  'QUOTATION_BILLING_RULES',
  'RECEIVABLE_CONTROLS',
] as const;
export type FinanceConfigurationKind = (typeof CONFIGURATION_KINDS)[number];
export type FinanceConfigurationState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWED_INACTIVE'
  | 'REJECTED'
  | 'SUPERSEDED_INACTIVE';

/** Natural person identity must come from the future trusted IAM adapter. */
export interface FinanceConfigurationActor extends FinancePrincipal {
  readonly kind: 'USER';
  readonly naturalPersonId: string;
}

export interface FinanceConfigurationInput {
  kind: FinanceConfigurationKind;
  key: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  payload?: Record<string, unknown>;
  sourceMapIds?: string[];
  dependencyRefs: string[];
  supersedesId?: string | null;
}

/** Transaction-local permission rechecks; never supplied by a request payload. */
export interface FinanceSourceReadCheck {
  authorityId: string;
  verify: () => Promise<void>;
}

export const FINANCE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preserve exact strings. The product hash helper intentionally trims them. */
export function canonicalFinanceJson(value: unknown): string {
  const active = new Set<object>();
  function encode(item: unknown): string {
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean')
      return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item))
      return JSON.stringify(item);
    if (typeof item !== 'object' || !item || active.has(item))
      throw new BadRequestException(
        'Configuration must contain finite, acyclic JSON values.',
      );
    if (Object.getOwnPropertySymbols(item).length)
      throw new BadRequestException(
        'Configuration cannot contain symbol keys.',
      );
    active.add(item);
    let result: string;
    if (Array.isArray(item)) {
      // Reject sparse arrays; JSON must not silently turn missing values into null.
      if (Object.keys(item).length !== item.length)
        throw new BadRequestException('Configuration arrays must be dense.');
      result = '[' + item.map(encode).join(',') + ']';
    } else {
      if (
        Object.getPrototypeOf(item) !== Object.prototype &&
        Object.getPrototypeOf(item) !== null
      )
        throw new BadRequestException(
          'Configuration requires plain JSON objects.',
        );
      result =
        '{' +
        Object.keys(item)
          .sort()
          .map(
            (key) =>
              JSON.stringify(key) +
              ':' +
              encode((item as Record<string, unknown>)[key]),
          )
          .join(',') +
        '}';
    }
    active.delete(item);
    return result;
  }
  return encode(value);
}

export function financeConfigurationHash(snapshot: unknown): string {
  return createHash('sha256')
    .update(canonicalFinanceJson(snapshot), 'utf8')
    .digest('hex');
}

export function isFinanceDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  );
}
