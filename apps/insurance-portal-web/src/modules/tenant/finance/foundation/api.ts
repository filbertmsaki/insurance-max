import { z } from 'zod';
import { apiClient } from '@/modules/shared/api/client';

export const FOUNDATION_READ = 'finance-foundation:read';
export const FOUNDATION_PATH = '/apps/finance/foundation';
export const documentKinds = {
  CURRENCY_CONTEXT: 'Currency context',
  EXCHANGE_RATE: 'Exchange rate',
  OPENING: 'Opening balances',
  B45_ACCEPTANCE: 'Foundation acceptance',
  RELEASE: 'Release',
} as const;

const scopeSchema = z.object({
  tenantId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  bookId: z.string().uuid(),
  entity_code: z.string(),
  book_code: z.string(),
  business_profile: z.string(),
  state: z.enum(['DRAFT', 'ACTIVE']),
});
const summarySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    'CURRENCY_CONTEXT',
    'EXCHANGE_RATE',
    'OPENING',
    'B45_ACCEPTANCE',
    'RELEASE',
  ]),
  mode: z.enum(['VALIDATION', 'LIVE']),
  document_key: z.string(),
  version: z.number().int().positive(),
  subject_hash: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(['REVIEWED', 'APPROVED', 'REJECTED']).nullable(),
  created_at: z.string(),
});
const documentSchema = summarySchema.extend({
  tenant_id: z.string().uuid(),
  legal_entity_id: z.string().uuid(),
  book_id: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  parent_id: z.string().uuid().nullable(),
  maker_subject_id: z.string().uuid(),
  maker_natural_person_id: z.string().uuid(),
});
const journalSummarySchema = z.object({
  id: z.string().uuid(),
  accountingDate: z.iso.date(),
  transactionDate: z.iso.date(),
  transactionCurrency: z.string().regex(/^[A-Z]{3}$/),
  functionalCurrency: z.string().regex(/^[A-Z]{3}$/),
  kind: z.enum(['ORIGINAL', 'REVERSAL']),
  reversalOf: z.string().uuid().nullable(),
  subjectHash: z.string().regex(/^[a-f0-9]{64}$/),
  financialEffects: z.union([z.literal(0), z.literal(1)]),
});
const journalPageSchema = z
  .object({
    journals: z.array(journalSummarySchema).max(100),
    hasMore: z.boolean(),
    nextCursor: z
      .object({ beforeDate: z.iso.date(), beforeId: z.string().uuid() })
      .nullable(),
    mode: z.enum(['VALIDATION', 'LIVE']),
  })
  .refine(
    (page) => page.hasMore === (page.nextCursor !== null),
    'Invalid journal cursor.',
  );
export type FoundationJournal = z.infer<typeof journalSummarySchema>;
export type JournalSearch = {
  mode: 'VALIDATION' | 'LIVE';
  from: string;
  to: string;
  beforeDate?: string;
  beforeId?: string;
};
const readinessSchema = z
  .object({
    scope: z.object({
      tenantId: z.string().uuid(),
      legalEntityId: z.string().uuid(),
      bookId: z.string().uuid(),
    }),
    contextId: z.string().uuid(),
    contextHash: z.string().regex(/^[a-f0-9]{64}$/),
    acceptanceScope: z.literal('FOUNDATION_ONLY'),
    overallFinanceProductionAccepted: z.literal(false),
    technicalAcceptance: z.boolean(),
    productionEligible: z.boolean(),
    blockers: z.array(z.string()),
    policyActivation: z.literal(false),
    financialEffects: z.literal(0),
  })
  .refine(
    (value) =>
      value.productionEligible
        ? value.technicalAcceptance && value.blockers.length === 0
        : value.blockers.length > 0,
    'Readiness evidence is inconsistent.',
  );
export type FoundationScope = z.infer<typeof scopeSchema>;
export type FoundationDocumentSummary = z.infer<typeof summarySchema>;
export type FoundationDocument = z.infer<typeof documentSchema>;
export type FoundationDocumentKind = FoundationDocumentSummary['kind'];
const trialBalanceSchema = z.object({
  scope: z.object({
    tenantId: z.string().uuid(),
    legalEntityId: z.string().uuid(),
    bookId: z.string().uuid(),
  }),
  mode: z.enum(['VALIDATION', 'LIVE']),
  from: z.iso.date(),
  to: z.iso.date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  openingId: z.string().uuid(),
  rows: z.array(
    z.object({
      accountCode: z.string(),
      opening: z.string(),
      debit: z.string(),
      credit: z.string(),
      closing: z.string(),
    }),
  ),
  totalDebit: z.string(),
  totalCredit: z.string(),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
  financialEffects: z.literal(0),
});
export type TrialBalance = z.infer<typeof trialBalanceSchema>;
const accountLedgerSchema = z.object({
  accountCode: z.string(),
  opening: z.string(),
  debit: z.string(),
  credit: z.string(),
  closing: z.string(),
  scope: trialBalanceSchema.shape.scope,
  mode: z.enum(['VALIDATION', 'LIVE']),
  from: z.iso.date(),
  to: z.iso.date(),
  currency: z.string(),
  sourceJournals: z.array(
    z.object({
      id: z.string().uuid(),
      date: z.iso.date(),
      subjectHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
});

function bookParams(scope: FoundationScope) {
  return { legalEntityId: scope.legalEntityId, bookId: scope.bookId };
}

/** Read-only adapter. Company/user identity is supplied by the normal API client. */
export const foundationReadApi = {
  async accountLedger(
    scope: FoundationScope,
    input: {
      opening: FoundationDocumentSummary;
      from: string;
      to: string;
      accountCode: string;
    },
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      `/tenant/finance/foundation/accounts/${encodeURIComponent(input.accountCode)}`,
      {
        params: {
          ...bookParams(scope),
          mode: input.opening.mode,
          openingId: input.opening.id,
          openingHash: input.opening.subject_hash,
          from: input.from,
          to: input.to,
        },
        signal,
      },
    );
    const result = accountLedgerSchema.parse(data);
    if (
      result.scope.tenantId !== scope.tenantId ||
      result.scope.legalEntityId !== scope.legalEntityId ||
      result.scope.bookId !== scope.bookId ||
      result.mode !== input.opening.mode ||
      result.from !== input.from ||
      result.to !== input.to ||
      result.accountCode !== input.accountCode
    )
      throw new Error(
        'Account activity does not match the selected book and period.',
      );
    return result;
  },
  async trialBalance(
    scope: FoundationScope,
    input: { opening: FoundationDocumentSummary; from: string; to: string },
    signal?: AbortSignal,
  ) {
    if (input.opening.kind !== 'OPENING' || input.opening.state !== 'REVIEWED')
      throw new Error('Select a reviewed opening certificate.');
    const { data } = await apiClient.get(
      '/tenant/finance/foundation/trial-balance',
      {
        params: {
          ...bookParams(scope),
          mode: input.opening.mode,
          openingId: input.opening.id,
          openingHash: input.opening.subject_hash,
          from: input.from,
          to: input.to,
        },
        signal,
      },
    );
    const result = trialBalanceSchema.parse(data);
    if (
      result.scope.tenantId !== scope.tenantId ||
      result.scope.legalEntityId !== scope.legalEntityId ||
      result.scope.bookId !== scope.bookId ||
      result.mode !== input.opening.mode ||
      result.openingId !== input.opening.id ||
      result.from !== input.from ||
      result.to !== input.to ||
      result.totalDebit !== result.totalCredit
    )
      throw new Error(
        'Trial balance does not reconcile to the selected book, period and certificate.',
      );
    return result;
  },
  async exportJournals(
    scope: FoundationScope,
    search: JournalSearch,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      '/tenant/finance/foundation/journals/export',
      {
        params: {
          ...bookParams(scope),
          mode: search.mode,
          from: search.from,
          to: search.to,
        },
        signal,
      },
    );
    const result = z
      .object({
        schema: z.literal('FINANCE_JOURNAL_EXPORT_V1'),
        tenantId: z.string().uuid(),
        legalEntityId: z.string().uuid(),
        bookId: z.string().uuid(),
        mode: z.enum(['VALIDATION', 'LIVE']),
        from: z.iso.date(),
        to: z.iso.date(),
        journals: z
          .array(
            journalSummarySchema.extend({
              payload: z.record(z.string(), z.unknown()),
            }),
          )
          .max(1000),
        evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(data);
    if (
      result.tenantId !== scope.tenantId ||
      result.legalEntityId !== scope.legalEntityId ||
      result.bookId !== scope.bookId ||
      result.mode !== search.mode ||
      result.from !== search.from ||
      result.to !== search.to ||
      result.journals.some(
        (j) =>
          j.accountingDate < search.from ||
          j.accountingDate > search.to ||
          j.financialEffects !== (search.mode === 'LIVE' ? 1 : 0),
      )
    )
      throw new Error('Journal export does not match the selected scope.');
    return result;
  },
  async journals(
    scope: FoundationScope,
    search: JournalSearch,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      '/tenant/finance/foundation/journals',
      {
        params: { ...bookParams(scope), ...search, limit: 50 },
        signal,
      },
    );
    const page = journalPageSchema.parse(data);
    if (
      page.mode !== search.mode ||
      page.journals.some(
        (j) =>
          j.accountingDate < search.from ||
          j.accountingDate > search.to ||
          j.financialEffects !== (search.mode === 'LIVE' ? 1 : 0),
      )
    )
      throw new Error('Journal results do not match the requested scope.');
    return page;
  },
  async scopes(signal?: AbortSignal): Promise<FoundationScope[]> {
    const { data } = await apiClient.get('/tenant/finance/foundation/scopes', {
      signal,
    });
    return z.array(scopeSchema).parse(data);
  },
  async documents(
    scope: FoundationScope,
    kind?: FoundationDocumentKind,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      '/tenant/finance/foundation/documents',
      {
        params: { ...bookParams(scope), kind, limit: 50 },
        signal,
      },
    );
    return z.array(summarySchema).parse(data);
  },
  async document(
    scope: FoundationScope,
    summary: FoundationDocumentSummary,
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      `/tenant/finance/foundation/documents/${encodeURIComponent(summary.id)}`,
      {
        params: { ...bookParams(scope), subjectHash: summary.subject_hash },
        signal,
      },
    );
    const document = documentSchema.parse(data);
    if (
      document.tenant_id !== scope.tenantId ||
      document.legal_entity_id !== scope.legalEntityId ||
      document.book_id !== scope.bookId ||
      document.id !== summary.id ||
      document.subject_hash !== summary.subject_hash
    ) {
      throw new Error(
        'The document does not match the selected accounting book and version.',
      );
    }
    return document;
  },
  async readiness(
    scope: FoundationScope,
    summary: FoundationDocumentSummary,
    signal?: AbortSignal,
  ) {
    if (summary.kind !== 'CURRENCY_CONTEXT' || summary.state !== 'REVIEWED')
      throw new Error('Select an independently reviewed currency context.');
    const { data } = await apiClient.get(
      '/tenant/finance/foundation/readiness',
      {
        params: {
          ...bookParams(scope),
          contextId: summary.id,
          contextHash: summary.subject_hash,
        },
        signal,
      },
    );
    const result = readinessSchema.parse(data);
    if (
      result.scope.tenantId !== scope.tenantId ||
      result.scope.legalEntityId !== scope.legalEntityId ||
      result.scope.bookId !== scope.bookId ||
      result.contextId !== summary.id ||
      result.contextHash !== summary.subject_hash
    )
      throw new Error(
        'Readiness does not match the selected book and context.',
      );
    return result;
  },
};
