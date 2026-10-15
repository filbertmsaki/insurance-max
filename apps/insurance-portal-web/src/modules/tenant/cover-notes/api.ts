import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import { apiClient } from '@/modules/shared/api/client';
import type { CoverNoteFilters, CoverNoteRecord } from './types';

const BASE = '/tenant/cover-notes';

export const coverNotesApi = {
  /** Cover notes table for a policy or quotation (server-side paging). */
  page: (
    filters: CoverNoteFilters,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<CoverNoteRecord>>(BASE, {
        params: { ...filters, ...params },
        signal,
      })
      .then((response) => response.data),

  list: (filters: CoverNoteFilters) =>
    apiClient
      .get<CoverNoteRecord[]>(BASE, { params: filters })
      .then((response) => response.data),

  /** Re-runs issuance for a quotation TIRA already accepted (idempotent). */
  resyncForQuotation: (quotationId: string) =>
    apiClient
      .post<CoverNoteRecord[]>(`${BASE}/issue/quotation/${quotationId}`)
      .then((response) => response.data),
};
