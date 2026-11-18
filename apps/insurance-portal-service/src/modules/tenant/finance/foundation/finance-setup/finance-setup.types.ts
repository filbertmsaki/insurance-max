import { BadRequestException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
  isFinanceDate,
} from '../finance-configuration/finance-configuration.types';

export const FINANCE_SETUP_STEPS = [
  ['G04-01', 'Legal entity and product scope'],
  ['G04-02', 'People and independent authority'],
  ['G04-03', 'Accounting basis and currencies'],
  ['G04-04', 'Financial calendar and period governance'],
  ['G04-05', 'Source ownership and inventory'],
  ['G04-06', 'Chart, account roles and dimensions'],
  ['G04-07', 'Versioned accounting configuration'],
  ['G04-08', 'Company accounting policy decisions'],
  ['G04-09', 'Inactive acceptance and rehearsal'],
  ['G04-10', 'Company setup review completion'],
] as const;
export type FinanceSetupStep = (typeof FINANCE_SETUP_STEPS)[number][0];
export type FinanceSetupState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWED_INACTIVE'
  | 'REJECTED';
export type FinanceSetupAction = 'SUBMIT' | 'REVIEW_INACTIVE' | 'REJECT';
export interface SetupPin {
  id: string;
  hash: string;
}
export interface SetupEvidence extends SetupPin {
  documentId: string;
  purpose: string;
}
export interface FinanceSetupInput {
  purpose: 'COMPANY_SETUP' | 'DEMONSTRATION';
  step: FinanceSetupStep;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  answers: Record<string, unknown>;
  dependencies: SetupPin[];
  evidence: SetupEvidence[];
}
export const setupText = (v: unknown, max = 4000): v is string =>
  typeof v === 'string' && !!v.trim() && v === v.trim() && v.length <= max;
export const setupHash = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const setupUuid = (v: unknown): v is string =>
  typeof v === 'string' && FINANCE_UUID.test(v);
export const setupObject = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((x) => setupText(x, 100)) &&
  new Set(v).size === v.length;
const currency = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Z]{3}$/.test(v);

export function setupInput(value: unknown): FinanceSetupInput {
  if (!setupObject(value))
    throw new BadRequestException('A setup submission is required.');
  const allowed = [
    'purpose',
    'step',
    'version',
    'effectiveFrom',
    'effectiveTo',
    'answers',
    'dependencies',
    'evidence',
  ];
  if (
    Object.keys(value).some((k) => !allowed.includes(k)) ||
    !FINANCE_SETUP_STEPS.some(([id]) => id === value.step) ||
    (value.purpose !== undefined &&
      !['COMPANY_SETUP', 'DEMONSTRATION'].includes(String(value.purpose))) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    Number(value.version) > 2147483647 ||
    (value.effectiveFrom !== null && !isFinanceDate(value.effectiveFrom)) ||
    (value.effectiveTo !== null &&
      (!isFinanceDate(value.effectiveTo) ||
        !value.effectiveFrom ||
        value.effectiveTo <= value.effectiveFrom)) ||
    !setupObject(value.answers) ||
    !Array.isArray(value.dependencies) ||
    value.dependencies.length > 20 ||
    !Array.isArray(value.evidence) ||
    value.evidence.length > 100
  )
    throw new BadRequestException(
      'Explicit step, version, dates, answers, dependency pins and evidence are required.',
    );
  const bounded = (v: unknown, depth = 0): void => {
    if (depth > 16)
      throw new BadRequestException('Setup content is nested too deeply.');
    if (v && typeof v === 'object')
      for (const x of Object.values(v)) bounded(x, depth + 1);
  };
  bounded(value);
  if (Buffer.byteLength(canonicalFinanceJson(value), 'utf8') > 240000)
    throw new BadRequestException('Setup content exceeds the supported size.');
  for (const p of [...value.dependencies, ...value.evidence])
    if (!setupObject(p) || !setupUuid(p.id) || !setupHash(p.hash))
      throw new BadRequestException(
        'Every reference requires an exact ID and SHA-256 hash.',
      );
  for (const p of value.evidence)
    if (!setupUuid(p.documentId) || !setupText(p.purpose, 200))
      throw new BadRequestException(
        'Evidence requires a document, exact version and purpose.',
      );
  if (
    new Set(value.dependencies.map((p) => p.id)).size !==
      value.dependencies.length ||
    new Set(value.evidence.map((p) => p.id + '/' + p.purpose)).size !==
      value.evidence.length
  )
    throw new BadRequestException(
      'Duplicate evidence or dependency references are not allowed.',
    );
  return JSON.parse(
    canonicalFinanceJson({ purpose: 'COMPANY_SETUP', ...value }),
  ) as FinanceSetupInput;
}

/** Drafts may be incomplete. Submission and independent review use these same rules. */
export function setupAnswerIssues(input: FinanceSetupInput): string[] {
  const a = input.answers,
    issues: string[] = [];
  const need = (ok: unknown, message: string) => {
    if (!ok) issues.push(message);
  };
  need(isFinanceDate(input.effectiveFrom), 'Choose the actual effective date.');
  need(
    input.evidence.length > 0,
    'Attach owned, available document-version evidence.',
  );
  switch (input.step) {
    case 'G04-01':
      need(setupText(a.jurisdictionCode, 8), 'Specify the legal jurisdiction.');
      need(
        strings(a.productIds) && a.productIds.every(setupUuid),
        'Select the actual products in scope.',
      );
      need(
        setupText(a.legalScopeReason),
        'Explain the legal entity and product perimeter.',
      );
      break;
    case 'G04-02':
      need(
        setupUuid(a.preparerBindingId) &&
          setupUuid(a.reviewerBindingId) &&
          a.preparerBindingId !== a.reviewerBindingId,
        'Select different real preparer and reviewer identity bindings.',
      );
      need(
        setupText(a.appointmentReference, 200),
        'Reference the actual appointment and remit.',
      );
      need(
        setupText(a.segregationOfDuties),
        'Document segregation of duties and delegation limits.',
      );
      break;
    case 'G04-03': {
      need(
        ['IFRS', 'STATUTORY', 'OPERATIONAL_BRIDGE'].includes(
          String(a.accountingBasis),
        ),
        'Select the approved accounting basis.',
      );
      need(
        currency(a.functionalCurrency),
        'Select the assessed functional currency.',
      );
      need(
        strings(a.presentationCurrencies) &&
          a.presentationCurrencies.every(currency),
        'Select presentation currencies.',
      );
      need(
        strings(a.transactionCurrencies) &&
          a.transactionCurrencies.every(currency),
        'Select allowed transaction currencies.',
      );
      need(
        setupText(a.functionalCurrencyRationale),
        'Provide the functional currency assessment.',
      );
      need(strings(a.rateSources), 'Specify approved exchange-rate sources.');
      need(
        Number.isSafeInteger(a.maximumRateAgeDays) &&
          Number(a.maximumRateAgeDays) >= 0,
        'Specify the permitted rate age.',
      );
      need(
        ['REJECT_IMBALANCED', 'LARGEST_REMAINDER_HALF_UP'].includes(
          String(a.roundingMode),
        ),
        'Select the rounding policy.',
      );
      const currencies = [
        a.functionalCurrency,
        ...(Array.isArray(a.presentationCurrencies)
          ? a.presentationCurrencies
          : []),
        ...(Array.isArray(a.transactionCurrencies)
          ? a.transactionCurrencies
          : []),
      ];
      need(
        setupObject(a.currencyScales) &&
          currencies.every(
            (c) =>
              typeof c === 'string' &&
              Number.isSafeInteger(a.currencyScales?.[c]) &&
              Number(a.currencyScales?.[c]) >= 0 &&
              Number(a.currencyScales?.[c]) <= 12,
          ),
        'Specify precision for every selected currency.',
      );
      break;
    }
    case 'G04-04': {
      need(setupText(a.calendarCode, 40), 'Name the financial calendar.');
      need(
        typeof a.fiscalYearEnd === 'string' &&
          /^\d{2}-\d{2}$/.test(a.fiscalYearEnd) &&
          isFinanceDate('2024-' + a.fiscalYearEnd),
        'Specify the approved financial year-end as month and day.',
      );
      need(
        setupText(a.timezone, 100) && validTimezone(a.timezone),
        'Specify a valid accounting timezone.',
      );
      need(
        setupText(a.closeProcedure) && setupText(a.reopeningProcedure),
        'Document independent close and reopening procedures.',
      );
      const periods = Array.isArray(a.periods) ? a.periods : [];
      need(
        periods.length > 0 && periods.length <= 120,
        'Supply the actual calendar periods.',
      );
      const codes = new Set<string>();
      let previousEnd = '';
      for (const p of periods) {
        if (
          !setupObject(p) ||
          !setupText(p.code, 40) ||
          codes.has(p.code) ||
          !isFinanceDate(p.from) ||
          !isFinanceDate(p.to) ||
          p.to <= p.from ||
          (previousEnd && p.from !== previousEnd)
        ) {
          issues.push(
            'Calendar periods require unique codes and contiguous, nonoverlapping exclusive-end intervals.',
          );
          break;
        }
        codes.add(p.code);
        previousEnd = p.to;
      }
      if (
        periods.length &&
        setupObject(periods[0]) &&
        setupObject(periods.at(-1))
      ) {
        const first = periods[0],
          last = periods.at(-1);
        need(
          isFinanceDate(input.effectiveFrom) &&
            isFinanceDate(first.from) &&
            isFinanceDate(last.to) &&
            first.from <= input.effectiveFrom &&
            last.to > input.effectiveFrom,
          'The financial calendar must cover the setup effective date.',
        );
        if (isFinanceDate(last.to))
          need(
            new Date(Date.parse(last.to + 'T00:00:00Z') - 86400000)
              .toISOString()
              .slice(5, 10) === a.fiscalYearEnd,
            'Calendar boundaries must match the approved financial year-end.',
          );
      }
      break;
    }
    case 'G04-05':
      need(
        strings(a.sourceMapIds) && a.sourceMapIds.every(setupUuid),
        'Reference exact company-to-entity source maps.',
      );
      need(
        isFinanceDate(a.cutoffDate),
        'Select the source inventory cutoff date.',
      );
      need(
        setupHash(a.populationEvidenceHash),
        'Supply the independently reconciled population evidence hash.',
      );
      need(
        setupText(a.reconciliationProcedure),
        'Describe the source population and open-item reconciliation.',
      );
      break;
    case 'G04-06':
      need(
        setupUuid(a.chartReleaseId) && setupHash(a.chartReleaseHash),
        'Select an exact reviewed inactive chart.',
      );
      need(
        setupUuid(a.dimensionReleaseId) && setupHash(a.dimensionReleaseHash),
        'Select exact reviewed inactive dimensions.',
      );
      need(
        setupText(a.mappingReview),
        'Document legacy dispositions and unresolved mapping restrictions.',
      );
      break;
    case 'G04-07':
      need(
        Array.isArray(a.configurationPins) &&
          a.configurationPins.length === 13 &&
          a.configurationPins.every(
            (p) => setupObject(p) && setupUuid(p.id) && setupHash(p.hash),
          ),
        'Reference one exact reviewed inactive version for each of the 13 configuration families.',
      );
      need(
        setupText(a.consumerVerification),
        'Document configuration validation and downstream consumer verification.',
      );
      break;
    case 'G04-08':
      need(
        Array.isArray(a.policyDecisions) && a.policyDecisions.length === 70,
        'Review all 70 policies, with explicit selections, deferrals or justified nonapplicability.',
      );
      need(
        Array.isArray(a.decisionSelections) &&
          a.decisionSelections.length === 126,
        'Review all 126 inherited decisions and acceptance items.',
      );
      for (const row of [
        ...(Array.isArray(a.policyDecisions) ? a.policyDecisions : []),
        ...(Array.isArray(a.decisionSelections) ? a.decisionSelections : []),
      ])
        need(
          setupObject(row) &&
            setupText(row.id, 40) &&
            ['PROPOSED_TREATMENT', 'DEFERRED', 'NOT_APPLICABLE'].includes(
              String(row.disposition),
            ) &&
            setupText(row.reason) &&
            (row.disposition !== 'PROPOSED_TREATMENT' ||
              setupText(row.selection)),
          'Each policy/decision needs an explicit disposition, reason and selected treatment where applicable.',
        );
      break;
    case 'G04-09':
      need(
        a.environment === 'ISOLATED_COPY' && a.result === 'PASS',
        'Provide a passed isolated-copy rehearsal.',
      );
      need(
        Number.isSafeInteger(a.checksPassed) && Number(a.checksPassed) > 0,
        'Supply the number of actual passed checks.',
      );
      need(
        a.paidInvoicesUnchanged === true &&
          a.existingAccessUnchanged === true &&
          a.policyActivations === 0 &&
          a.bookActivations === 0 &&
          a.sourceFinancialWrites === 0,
        'Rehearsal must preserve paid invoices/access and make no source financial writes or activations.',
      );
      need(
        setupHash(a.reconciliationEvidenceHash),
        'Supply actual financial reconciliation evidence.',
      );
      break;
    case 'G04-10':
      need(
        a.acceptedScope === 'INACTIVE_SETUP_REVIEW' &&
          a.activationAuthorized === false,
        'Completion applies only to inactive setup review, without activation authority.',
      );
      need(
        setupText(a.completionStatement) && setupText(a.remainingRestrictions),
        'Record accepted scope and all remaining restrictions.',
      );
      break;
  }
  return [...new Set(issues)];
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
