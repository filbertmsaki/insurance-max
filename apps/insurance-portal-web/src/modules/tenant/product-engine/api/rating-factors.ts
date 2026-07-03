import { apiClient } from '@/modules/shared/api/client';
import type {
  RatingFactor,
  CreateFactorDto,
  UpdateFactorDto,
  FactorQueryParams,
  PEPage,
} from '@/types/product-engine';

export const ratingFactorsApi = {
  getList: (params?: FactorQueryParams) =>
    apiClient
      .get<PEPage<RatingFactor>>('/rating-factors', { params })
      .then((r) => r.data),

  create: (data: CreateFactorDto) =>
    apiClient.post<RatingFactor>('/rating-factors', data).then((r) => r.data),

  update: (id: string, data: UpdateFactorDto) =>
    apiClient
      .patch<RatingFactor>(`/rating-factors/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/rating-factors/${id}`).then((r) => r.data),

  getAll: () =>
    apiClient
      .get<PEPage<RatingFactor>>('/rating-factors', {
        params: { limit: 100, is_active: true },
      })
      .then((r) => r.data.data),
};
