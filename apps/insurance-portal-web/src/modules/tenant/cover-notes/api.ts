import { apiClient } from '@/modules/shared/api/client';
import type { CoverNoteFilters, CoverNoteRecord } from './types';

const BASE = '/tenant/cover-notes';

export const coverNotesApi = {
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
