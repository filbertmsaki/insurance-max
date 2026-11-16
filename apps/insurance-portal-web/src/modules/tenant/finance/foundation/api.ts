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
export type FoundationScope = z.infer<typeof scopeSchema>;
export type FoundationDocumentSummary = z.infer<typeof summarySchema>;
export type FoundationDocument = z.infer<typeof documentSchema>;
export type FoundationDocumentKind = FoundationDocumentSummary['kind'];

function bookParams(scope: FoundationScope) {
  return { legalEntityId: scope.legalEntityId, bookId: scope.bookId };
}

/** Read-only adapter. Company/user identity is supplied by the normal API client. */
export const foundationReadApi = {
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
};
