import type {
  PaginatedResponse,
  PaginatedWithSummary,
} from '@/modules/shared/api/pagination';
import { underwriteApi, type UnderwriteTableParams } from '../api';
import { underwriteKeys } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import type {
  UnderwritePolicyTransactionRow,
  UnderwriteRenewalRow,
  UnderwriteTiraQueueRow,
} from '../types';

export type TransactionRowsKind = 'endorsements' | 'cancellations';
export type TiraRowsKind = 'failed' | 'pending';

/**
 * Where the renewal / endorsement / cancellation / TIRA tables load their
 * rows and where their row actions lead. The Underwrite line pages use one
 * line; the Motor Insurance module lists Motor and Fleet together.
 */
export interface TransactionListSource {
  /** Query-key prefix, unique per source. */
  keyPrefix: readonly unknown[];
  /** Used in empty-state messages, e.g. "fleet" or "motor". */
  noun: string;
  listRenewals: (
    params: UnderwriteTableParams,
    signal?: AbortSignal,
  ) => Promise<PaginatedWithSummary<UnderwriteRenewalRow>>;
  listTransactions: (
    kind: TransactionRowsKind,
    params: UnderwriteTableParams,
    signal?: AbortSignal,
  ) => Promise<PaginatedWithSummary<UnderwritePolicyTransactionRow>>;
  getTiraQueue: (
    kind: TiraRowsKind,
    params: UnderwriteTableParams,
    signal?: AbortSignal,
  ) => Promise<PaginatedResponse<UnderwriteTiraQueueRow>>;
  paths: {
    renewal: (policyId: string, renewalId: string) => string;
    endorsement: (policyId: string, endorsementId: string) => string;
    cancellation: (policyId: string, cancellationId: string) => string;
    quotation: (id: string) => string;
    policy: (id: string) => string;
  };
  /**
   * Re-submit a failed TIRA item from the list. Omitted when the source cannot
   * address the row's line; the record's own page offers the retry then.
   */
  retryTira?: (row: UnderwriteTiraQueueRow) => Promise<unknown>;
}

export function lineTransactionSource(
  line: UnderwriteLineMeta,
): TransactionListSource {
  const slug = line.slug;
  return {
    keyPrefix: [...underwriteKeys.all, slug],
    noun: line.label.toLowerCase(),
    listRenewals: (params, signal) =>
      underwriteApi.listRenewals(slug, params, signal),
    listTransactions: (kind, params, signal) =>
      underwriteApi.listTransactions(slug, kind, params, signal),
    getTiraQueue: (kind, params, signal) =>
      underwriteApi.getTiraQueue(slug, kind, params, signal),
    paths: {
      renewal: (policyId, renewalId) =>
        underwritePaths.policyRenewalDetail(slug, policyId, renewalId),
      endorsement: (policyId, endorsementId) =>
        underwritePaths.policyEndorsementEdit(slug, policyId, endorsementId),
      cancellation: (policyId, cancellationId) =>
        underwritePaths.policyCancellationDetail(
          slug,
          policyId,
          cancellationId,
        ),
      quotation: (id) => underwritePaths.quotationDetail(slug, id),
      policy: (id) => underwritePaths.policyDetail(slug, id),
    },
    retryTira: (row) => {
      if (row.source_kind === 'quotation') {
        return underwriteApi.retryQuotationTira(slug, row.id);
      }
      if (row.transaction_type === 'ENDORSEMENT') {
        return underwriteApi.retryEndorsementTiramis(slug, row.id);
      }
      return underwriteApi.submitCancellationToTiramis(slug, row.id);
    },
  };
}
