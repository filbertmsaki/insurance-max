import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
  FINANCE_UUID,
  isFinanceDate,
  FinanceConfigurationActor,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  candidateAmount,
  candidateCode,
  candidateText,
} from '../journal-entries/finance-journal-candidate.types';
import { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';

export type FoundationMode = 'VALIDATION' | 'LIVE';
export type FoundationCapability =
  | 'PREPARE'
  | 'REVIEW'
  | 'ACCEPT'
  | 'READ'
  | 'RELEASE';
export interface PolicyPin {
  id: string;
  hash: string;
}
export interface CurrencyContextInput {
  schema: 'FINANCE_CURRENCY_CONTEXT_V1';
  version: number;
  sourceCompanyId: string;
  basis: 'IFRS' | 'STATUTORY' | 'OPERATIONAL_BRIDGE';
  functionalCurrency: string;
  presentationCurrencies: string[];
  currencyScales: Record<string, number>;
  effectiveFrom: string;
  effectiveTo: string | null;
  rateSources: string[];
  maxRateAgeDays: number;
  roundingMode: 'REJECT_IMBALANCED' | 'LARGEST_REMAINDER_HALF_UP';
  chartReleaseId: string;
  chartReleaseHash: string;
  policyPins: PolicyPin[];
  unresolvedDecisions: string[];
  allowedComponents: {
    origin: string;
    component: string;
    owner: 'FINANCE' | 'IFRS17_ENGINE';
    policyCode: string;
    effect:
      | 'CASH'
      | 'ORDINARY'
      | 'BILLING_MEMORANDUM'
      | 'INSURANCE_MEASUREMENT';
    sourceEventType: string | null;
    factKind: string | null;
    debitRoles: string[];
    creditRoles: string[];
    sourceMapping: null | {
      amountPath: string;
      currencyPath: string;
      datePath: string;
      companyPath: string;
      aggregatePath: string;
    };
  }[];
  assessmentReference: string;
  assessmentEvidenceHash: string;
}
export interface FoundationRateInput {
  contextId: string;
  contextHash: string;
  transactionCurrency: string;
  rate: string;
  rateDate: string;
  validTo: string;
  source: string;
  sourceReference: string;
  evidenceHash: string;
}
export interface SourceProof {
  kind: 'MANUAL' | 'ACCEPTED_INBOX' | 'OPERATING_DOCUMENT' | 'BOOK_VOUCHER';
  reference: string;
  evidenceHash: string;
  inboxId?: string;
  deliveryId?: string;
  snapshot?: Record<string, unknown>;
  expected?: {
    eventType: string;
    factKind: string;
    aggregateType: string;
    aggregateId: string;
    companyId: string;
    revision: number;
    snapshotHash: string;
  };
}
export interface FoundationAcceptInput {
  candidateId: string;
  candidateHash: string;
  contextId: string;
  contextHash: string;
  mode: FoundationMode;
  rateId: string | null;
  rateHash: string | null;
  transactionDate: string;
  source: SourceProof;
}
export const FOUNDATION_CHECKS = [
  'CURRENCY',
  'LEDGER_REPORTS',
  'SCOPE_ISOLATION',
  'PERIOD_FENCES',
  'MAKER_CHECKER',
  'SOURCE_IDENTITY',
  'AUDIT_IMMUTABILITY',
  'SOURCE_COMPATIBILITY',
  'HISTORICAL_PROTECTION',
] as const;
export function foundationFail(message: string): never {
  throw new ConflictException({ code: 'FINANCE_FOUNDATION_HELD', message });
}
export function uuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !FINANCE_UUID.test(value))
    throw new BadRequestException('An explicit UUID reference is required.');
}
export function digest(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new BadRequestException(
      'An exact SHA-256 evidence hash is required.',
    );
}
export function dateOnly(value: unknown): asserts value is string {
  if (!isFinanceDate(value))
    throw new BadRequestException('An exact valid UTC date is required.');
}
export function modeOnly(mode: unknown): asserts mode is FoundationMode {
  if (!['VALIDATION', 'LIVE'].includes(String(mode)))
    throw new BadRequestException(
      'Explicit VALIDATION or LIVE ledger mode is required.',
    );
}
export function foundationIdentity(
  actor: FinanceConfigurationActor,
  scope: FinanceBookSelection,
) {
  if (actor?.kind !== 'USER')
    throw new BadRequestException(
      'A trusted human Finance identity is required.',
    );
  [
    actor.tenantId,
    actor.subjectId,
    actor.naturalPersonId,
    scope?.legalEntityId,
    scope?.bookId,
  ].forEach(uuid);
  return {
    actor: {
      ...actor,
      tenantId: actor.tenantId.toLowerCase(),
      subjectId: actor.subjectId.toLowerCase(),
      naturalPersonId: actor.naturalPersonId.toLowerCase(),
    },
    scope: {
      legalEntityId: scope.legalEntityId.toLowerCase(),
      bookId: scope.bookId.toLowerCase(),
    },
  };
}
export function normalizeCurrencyContext(
  value: CurrencyContextInput,
): CurrencyContextInput {
  const c = JSON.parse(canonicalFinanceJson(value)) as CurrencyContextInput;
  if (!c || typeof c !== 'object' || Array.isArray(c))
    foundationFail('An explicit currency context object is required.');
  if (
    c.schema !== 'FINANCE_CURRENCY_CONTEXT_V1' ||
    !Number.isSafeInteger(c.version) ||
    c.version < 1 ||
    !['IFRS', 'STATUTORY', 'OPERATIONAL_BRIDGE'].includes(c.basis)
  )
    throw new BadRequestException(
      'Explicit context schema, version and accounting basis are required.',
    );
  uuid(c.sourceCompanyId);
  uuid(c.chartReleaseId);
  digest(c.chartReleaseHash);
  digest(c.assessmentEvidenceHash);
  dateOnly(c.effectiveFrom);
  if (c.effectiveTo !== null) {
    dateOnly(c.effectiveTo);
    if (c.effectiveTo <= c.effectiveFrom)
      foundationFail('Currency-context interval is empty.');
  }
  if (
    !c.currencyScales ||
    Array.isArray(c.currencyScales) ||
    !Object.keys(c.currencyScales).length ||
    Object.entries(c.currencyScales).some(
      ([k, v]) =>
        !/^[A-Z]{3}$/.test(k) || !Number.isInteger(v) || v < 0 || v > 12,
    )
  )
    foundationFail(
      'Configured currency precisions from zero to twelve are required.',
    );
  if (
    !Object.hasOwn(c.currencyScales, c.functionalCurrency) ||
    !Array.isArray(c.presentationCurrencies) ||
    !c.presentationCurrencies.length ||
    c.presentationCurrencies.some((k) => !Object.hasOwn(c.currencyScales, k)) ||
    new Set(c.presentationCurrencies).size !== c.presentationCurrencies.length
  )
    foundationFail(
      'Functional and presentation currencies must exist in the exact configured currency set.',
    );
  if (
    !Array.isArray(c.rateSources) ||
    !c.rateSources.length ||
    c.rateSources.some((s) => !candidateCode(s)) ||
    new Set(c.rateSources).size !== c.rateSources.length ||
    !Number.isInteger(c.maxRateAgeDays) ||
    c.maxRateAgeDays < 0 ||
    c.maxRateAgeDays > 366 ||
    !['REJECT_IMBALANCED', 'LARGEST_REMAINDER_HALF_UP'].includes(c.roundingMode)
  )
    foundationFail(
      'Explicit rate-source, age and rounding controls are required.',
    );
  if (
    !candidateText(c.assessmentReference, 2000) ||
    !Array.isArray(c.policyPins) ||
    new Set(c.policyPins.map((p) => p.id)).size !== c.policyPins.length
  )
    foundationFail(
      'A documented functional assessment and distinct policy-version pins are required.',
    );
  c.policyPins.forEach((p) => {
    uuid(p.id);
    digest(p.hash);
  });
  if (
    !Array.isArray(c.unresolvedDecisions) ||
    c.unresolvedDecisions.some((d) => !candidateText(d)) ||
    !Array.isArray(c.allowedComponents) ||
    !c.allowedComponents.length ||
    c.allowedComponents.some(
      (a) =>
        !candidateCode(a.origin) ||
        !candidateCode(a.component) ||
        !['FINANCE', 'IFRS17_ENGINE'].includes(a.owner) ||
        !/^AP-\d{2}\.\d{2}$/.test(a.policyCode),
    ) ||
    new Set(c.allowedComponents.map((a) => a.origin + ':' + a.component))
      .size !== c.allowedComponents.length
  )
    foundationFail(
      'Distinct explicit component ownership, policy code and unresolved-decision references are required.',
    );
  if (
    c.allowedComponents.some(
      (a) =>
        ![
          'CASH',
          'ORDINARY',
          'BILLING_MEMORANDUM',
          'INSURANCE_MEASUREMENT',
        ].includes(a.effect) ||
        (a.effect === 'INSURANCE_MEASUREMENT' && a.owner !== 'IFRS17_ENGINE') ||
        (c.basis === 'IFRS' &&
          a.effect === 'ORDINARY' &&
          /^AP-(07|10|13|23)\./.test(a.policyCode)),
    )
  )
    foundationFail(
      'IFRS insurance billing and measured components cannot be configured as ordinary revenue or reserve recognition. Use the separately approved cash or measurement owner.',
    );
  if (
    c.allowedComponents.some(
      (a) =>
        (a.sourceEventType === null) !== (a.factKind === null) ||
        (a.sourceEventType !== null &&
          (!candidateText(a.sourceEventType) || !candidateCode(a.factKind))),
    )
  )
    foundationFail(
      'Automatic components must pin their event type and fact kind; manual components explicitly declare both absent.',
    );
  if (
    c.allowedComponents.some((a) =>
      [a.debitRoles, a.creditRoles].some(
        (roles) =>
          !Array.isArray(roles) ||
          !roles.length ||
          roles.some((r) => !candidateCode(r)) ||
          new Set(roles).size !== roles.length,
      ),
    )
  )
    foundationFail(
      'Each component requires explicit debit and credit account-role rules.',
    );
  for (const a of c.allowedComponents) {
    if (a.sourceEventType === null) {
      if (a.sourceMapping !== null)
        foundationFail(
          'Manual components explicitly omit automatic snapshot mappings.',
        );
    } else {
      if (!a.sourceMapping || typeof a.sourceMapping !== 'object')
        foundationFail(
          'Automatic components require explicit signed financial-snapshot field mappings.',
        );
      for (const key of [
        'amountPath',
        'currencyPath',
        'datePath',
        'companyPath',
        'aggregatePath',
      ] as const)
        validatePointer(a.sourceMapping[key]);
    }
  }
  return c;
}
export function normalizeSourceProof(value: SourceProof): SourceProof {
  const p = JSON.parse(canonicalFinanceJson(value)) as SourceProof;
  if (!p || typeof p !== 'object' || Array.isArray(p))
    foundationFail('An explicit source-proof object is required.');
  if (
    ![
      'MANUAL',
      'ACCEPTED_INBOX',
      'OPERATING_DOCUMENT',
      'BOOK_VOUCHER',
    ].includes(p.kind) ||
    !candidateText(p.reference, 2000)
  )
    foundationFail(
      'A complete signed-source or independently approved manual source reference is required.',
    );
  digest(p.evidenceHash);
  if (p.kind === 'ACCEPTED_INBOX') {
    uuid(p.inboxId);
    if (p.deliveryId !== undefined) uuid(p.deliveryId);
    if (
      !p.expected ||
      !candidateText(p.expected.eventType) ||
      !candidateCode(p.expected.factKind) ||
      !candidateCode(p.expected.aggregateType) ||
      !candidateText(p.expected.aggregateId) ||
      !Number.isSafeInteger(p.expected.revision) ||
      p.expected.revision < 1
    )
      foundationFail(
        'Accepted source identity, type and revision are required.',
      );
    uuid(p.expected.companyId);
    digest(p.expected.snapshotHash);
    if (
      !p.snapshot ||
      Array.isArray(p.snapshot) ||
      typeof p.snapshot !== 'object' ||
      hash(p.snapshot) !== p.expected.snapshotHash
    )
      foundationFail(
        'Full financial snapshot bytes must match the producer-signed immutable snapshot hash.',
      );
  } else if (p.inboxId || p.expected || p.deliveryId || p.snapshot)
    foundationFail(
      'A manual reference cannot impersonate a signed inbox source.',
    );
  return p;
}
export const FOUNDATION_SCALE = 12;
export const units = (value: string) =>
  candidateAmount(value, FOUNDATION_SCALE).units;
export function signedUnits(value: string): bigint {
  if (typeof value !== 'string')
    foundationFail('An explicit signed decimal is required.');
  return value.startsWith('-') ? -units(value.slice(1)) : units(value);
}
export function stored(value: bigint): string {
  const negative = value < 0n,
    v = negative ? -value : value;
  if (v >= 10n ** 38n) foundationFail('Amount exceeds numeric(38,12) storage.');
  return (
    (negative ? '-' : '') +
    (v / 10n ** 12n).toString() +
    '.' +
    (v % 10n ** 12n).toString().padStart(12, '0')
  );
}
export function fixedRate(value: string): bigint {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,18})?$/.test(value)
  )
    foundationFail(
      'A positive plain decimal rate with at most eighteen fractional digits is required.',
    );
  const [whole, fraction = ''] = value.split('.'),
    n = BigInt(whole + fraction.padEnd(18, '0'));
  if (n <= 0n) foundationFail('FX rate must be strictly positive.');
  return n;
}
/** Integer arithmetic prevents precision loss before the explicitly configured rounding. */
export function convertLedgerLines(
  lines: { lineKey: string; debit: string; credit: string }[],
  rate: string,
  functionalScale: number,
  rounding: CurrencyContextInput['roundingMode'],
) {
  if (
    !Number.isInteger(functionalScale) ||
    functionalScale < 0 ||
    functionalScale > 12 ||
    !['REJECT_IMBALANCED', 'LARGEST_REMAINDER_HALF_UP'].includes(rounding)
  )
    foundationFail(
      'Explicit functional precision and rounding policy are required.',
    );
  const r = fixedRate(rate),
    denominator = 10n ** BigInt(30 - functionalScale),
    quantum = 10n ** BigInt(12 - functionalScale);
  const round = (n: bigint) => (n * 2n + denominator) / (denominator * 2n);
  const result = lines.map((l) => ({
    lineKey: l.lineKey,
    debit: units(l.debit),
    credit: units(l.credit),
    functionalDebit: 0n,
    functionalCredit: 0n,
    roundingDebit: 0n,
    roundingCredit: 0n,
  }));
  if (
    !result.length ||
    new Set(result.map((l) => l.lineKey)).size !== result.length ||
    result.some((l) => l.debit > 0n === l.credit > 0n)
  )
    foundationFail('Distinct positive one-sided ledger lines are required.');
  const debit = result.reduce((s, l) => s + l.debit, 0n),
    credit = result.reduce((s, l) => s + l.credit, 0n);
  if (debit !== credit) foundationFail('Source journal does not balance.');
  const target = round(debit * r);
  for (const side of ['debit', 'credit'] as const) {
    const rows = result
      .filter((l) => l[side] > 0n)
      .map((l) => ({ l, n: l[side] * r, rounded: round(l[side] * r) }));
    if (
      rounding === 'REJECT_IMBALANCED' &&
      rows.reduce((s, l) => s + l.rounded, 0n) !== target
    )
      foundationFail(
        'Independent line rounding does not conserve the journal total; a rounding policy decision is required.',
      );
    const allocated = rows.map((x) => ({
      ...x,
      final:
        rounding === 'LARGEST_REMAINDER_HALF_UP'
          ? x.n / denominator
          : x.rounded,
    }));
    let residual = target - allocated.reduce((s, x) => s + x.final, 0n);
    allocated.sort((a, b) =>
      a.n % denominator === b.n % denominator
        ? a.l.lineKey < b.l.lineKey
          ? -1
          : a.l.lineKey > b.l.lineKey
            ? 1
            : 0
        : a.n % denominator > b.n % denominator
          ? -1
          : 1,
    );
    for (const x of allocated) {
      if (residual > 0n) {
        x.final++;
        residual--;
      }
      if (x.final === 0n)
        foundationFail(
          'Conversion would erase a positive source line at the configured precision. Review precision or the source journal.',
        );
      const f = side === 'debit' ? 'functionalDebit' : 'functionalCredit',
        d = side === 'debit' ? 'roundingDebit' : 'roundingCredit';
      x.l[f] = x.final * quantum;
      x.l[d] = (x.final - x.rounded) * quantum;
    }
    if (residual !== 0n)
      foundationFail('Rounding allocation did not conserve the exact target.');
  }
  return result.map((l) => ({
    lineKey: l.lineKey,
    transactionDebit: stored(l.debit),
    transactionCredit: stored(l.credit),
    functionalDebit: stored(l.functionalDebit),
    functionalCredit: stored(l.functionalCredit),
    roundingDebit: stored(l.roundingDebit),
    roundingCredit: stored(l.roundingCredit),
  }));
}
export const foundationHash = hash;
function validatePointer(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.length > 300 ||
    value.split('/').length > 20 ||
    value
      .split('/')
      .slice(1)
      .some(
        (s) =>
          !s ||
          ['__proto__', 'prototype', 'constructor'].includes(
            s.replace(/~1/g, '/').replace(/~0/g, '~'),
          ),
      )
  )
    foundationFail(
      'A bounded explicit JSON pointer without prototype traversal is required.',
    );
}
export function financialSnapshotValue(
  snapshot: Record<string, unknown>,
  path: string,
): unknown {
  validatePointer(path);
  let value: unknown = snapshot;
  for (const part of path
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part))
      foundationFail(
        'A required source financial-snapshot field is missing; no zero or date default is inferred.',
      );
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
/** Excludes the pins to avoid a circular policy-hash/context-hash dependency. */
export const currencyContextPolicyHash = (context: CurrencyContextInput) =>
  hash({ ...context, policyPins: [] });
