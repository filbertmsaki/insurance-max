import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type {
  ReferenceCountry,
  ReferenceCurrency,
  ReferenceDistrict,
  ReferenceKind,
  ReferenceListParams,
  ReferenceRegion,
  ReferenceTableParams,
} from './types';

export const referenceDataApi = {
  vehicleMakes: (params?: ReferenceListParams) =>
    apiClient
      .get<
        Array<{ id: string; name: string; is_active: boolean }>
      >('/reference-data/vehicle/makes', { params })
      .then((r) => r.data),
  vehicleModels: (params?: ReferenceListParams & { make_id?: string }) =>
    apiClient
      .get<
        Array<{ id: string; make_id: string; name: string; is_active: boolean }>
      >('/reference-data/vehicle/models', { params })
      .then((r) => r.data),
  vehicleAttributes: (
    kind: 'body_type' | 'colour' | 'fuel_type',
    params?: ReferenceListParams,
  ) =>
    apiClient
      .get<
        Array<{ id: string; kind: string; name: string; is_active: boolean }>
      >(`/reference-data/vehicle/attributes/${kind}`, { params })
      .then((r) => r.data),
  previewModels: (make_id: string, models: string) =>
    apiClient
      .post<{
        new_models: string[];
        duplicates: string[];
        existing_models: string[];
        invalid: string[];
      }>('/reference-data/vehicle/models/bulk-preview', { make_id, models })
      .then((r) => r.data),
  saveModels: (make_id: string, models: string) =>
    apiClient
      .post<{
        created: string[];
        skipped: string[];
      }>('/reference-data/vehicle/models/bulk-save', { make_id, models })
      .then((r) => r.data),
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
  /** GET /reference-data/:kind?page=… — server-side paginated table */
  listPage: <T>(
    kind: ReferenceKind,
    params: ReferenceTableParams,
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<PaginatedResponse<T>>('/reference-data/' + kind, { params, signal })
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
