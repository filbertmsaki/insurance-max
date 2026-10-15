import { apiClient } from '@/modules/shared/api/client';
import type { BackendPaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  PricingRateBook,
  CreatePricingRateBookDto,
  UpdatePricingRateBookDto,
  ClonePricingRateBookDto,
  RateBookQueryParams,
} from '@/types/product-engine';

export const rateBooksApi = {
  /** Rate books table: server-side paging, search, sort and filters. */
  page: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<BackendPaginatedResponse<PricingRateBook>>('/pricing-rate-books', {
        params,
        signal,
      })
      .then((r) => r.data),

  list: (params?: RateBookQueryParams) =>
    apiClient
      .get<PricingRateBook[]>('/pricing-rate-books', { params })
      .then((r) => r.data),

  findOne: (id: string) =>
    apiClient
      .get<PricingRateBook>(`/pricing-rate-books/${id}`)
      .then((r) => r.data),

  create: (data: CreatePricingRateBookDto) =>
    apiClient
      .post<PricingRateBook>('/pricing-rate-books', data)
      .then((r) => r.data),

  update: (id: string, data: UpdatePricingRateBookDto) =>
    apiClient
      .patch<PricingRateBook>(`/pricing-rate-books/${id}`, data)
      .then((r) => r.data),

  clone: (data: ClonePricingRateBookDto) =>
    apiClient
      .post<PricingRateBook>('/pricing-rate-books/clone', data)
      .then((r) => r.data),

  submitReview: (id: string) =>
    apiClient
      .post<PricingRateBook>(`/pricing-rate-books/${id}/submit-review`)
      .then((r) => r.data),

  approve: (id: string) =>
    apiClient
      .post<PricingRateBook>(`/pricing-rate-books/${id}/approve`)
      .then((r) => r.data),

  reject: (id: string, comments: string) =>
    apiClient
      .post<PricingRateBook>(`/pricing-rate-books/${id}/reject`, { comments })
      .then((r) => r.data),

  publish: (id: string) =>
    apiClient
      .post<PricingRateBook>(`/pricing-rate-books/${id}/publish`)
      .then((r) => r.data),

  retire: (id: string) =>
    apiClient
      .post<PricingRateBook>(`/pricing-rate-books/${id}/retire`)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/pricing-rate-books/${id}`).then((r) => r.data),
};
