import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';

export const insurancePartnersApi = {
  list: () =>
    apiClient
      .get<PartnerRelationship[]>('/insurance-partners')
      .then((r) => r.data),
  /** GET /insurance-partners?page=… — server-side table page (search/status/partner_type/sort). */
  page: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<PartnerRelationship>>('/insurance-partners', {
        params,
        signal,
      })
      .then((r) => r.data),
  products: () =>
    apiClient
      .get<PartnerProduct[]>('/insurance-partners/products')
      .then((r) => r.data),
  branches: () =>
    apiClient
      .get<
        Array<{ id: string; name: string; code: string }>
      >('/insurance-partners/branches')
      .then((r) => r.data),
  scopes: (id: string) =>
    apiClient
      .get<PartnerProductScope[]>(`/insurance-partners/${id}/product-scopes`)
      .then((r) => r.data),
  events: (id: string) =>
    apiClient
      .get<PartnerEvent[]>(`/insurance-partners/${id}/events`)
      .then((r) => r.data),
  replaceScopes: (
    id: string,
    product_scopes: Array<{
      product_id: string;
      allowed_operations: string[];
      branch_ids: string[] | null;
      commission_rate?: number | null;
    }>,
  ) =>
    apiClient
      .put(`/insurance-partners/${id}/product-scopes`, { product_scopes })
      .then((r) => r.data),
  transition: (
    id: string,
    action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'terminate',
    reason?: string,
  ) =>
    apiClient
      .patch(`/insurance-partners/${id}/${action}`, reason ? { reason } : {})
      .then((r) => r.data),
};

export interface PartnerRelationship {
  id: string;
  intermediary_company_id: string;
  partner_type: string;
  status: string;
  scope_mode: 'LEGACY' | 'RESTRICTED';
  commission_rate: string | null;
  start_date: string | null;
  end_date: string | null;
  agreement_reference: string | null;
  intermediary_company?: { id: string; name: string; company_type: string };
}

export interface PartnerProduct {
  id: string;
  product_name: string;
  product_code: string;
  category?: { name?: string } | null;
}

export interface PartnerProductScope {
  id: string;
  product_id: string;
  product?: PartnerProduct;
  allowed_operations: string[];
  branch_ids: string[] | null;
  commission_rate: string | null;
  is_active: boolean;
}

export interface PartnerEvent {
  id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}
