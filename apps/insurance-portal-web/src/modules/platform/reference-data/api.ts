import { apiClient } from '@/modules/shared/api/client';
import type {
  ReferenceCountry,
  ReferenceCurrency,
  ReferenceDistrict,
  ReferenceKind,
  ReferenceListParams,
  ReferenceRegion,
} from './types';

export const referenceDataApi = {
  countries: (params?: ReferenceListParams) =>
    apiClient
      .get<ReferenceCountry[]>('/reference-data/countries', { params })
      .then((r) => r.data),
  regions: (params?: ReferenceListParams) =>
    apiClient
      .get<ReferenceRegion[]>('/reference-data/regions', { params })
      .then((r) => r.data),
  districts: (params?: ReferenceListParams) =>
    apiClient
      .get<ReferenceDistrict[]>('/reference-data/districts', { params })
      .then((r) => r.data),
  currencies: (params?: ReferenceListParams) =>
    apiClient
      .get<ReferenceCurrency[]>('/reference-data/currencies', { params })
      .then((r) => r.data),
  create: <T>(kind: ReferenceKind, data: Record<string, unknown>) =>
    apiClient.post<T>(`/reference-data/${kind}`, data).then((r) => r.data),
  update: <T>(kind: ReferenceKind, id: string, data: Record<string, unknown>) =>
    apiClient
      .patch<T>(`/reference-data/${kind}/${id}`, data)
      .then((r) => r.data),
  activate: <T>(kind: ReferenceKind, id: string) =>
    apiClient
      .patch<T>(`/reference-data/${kind}/${id}/activate`)
      .then((r) => r.data),
  deactivate: <T>(kind: ReferenceKind, id: string) =>
    apiClient
      .patch<T>(`/reference-data/${kind}/${id}/deactivate`)
      .then((r) => r.data),
  remove: (kind: ReferenceKind, id: string) =>
    apiClient.delete(`/reference-data/${kind}/${id}`).then((r) => r.data),
};
