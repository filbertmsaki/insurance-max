import { apiClient } from '@/modules/shared/api/client'
import type { CompanyFeature } from '@/types'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface UpsertCompanyFeatureDto {
  feature_key: string
  display_name: string
  description?: string
  is_enabled?: boolean
  metadata?: Record<string, unknown>
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const companyFeaturesApi = {
  /** GET /company-features — list all company-level features (requires branches:read) */
  getCompanyFeatures: () =>
    apiClient.get<CompanyFeature[]>('/company-features').then((r) => r.data),

  /** POST /company-features — create or update a company feature (requires branches:manage-access) */
  upsertCompanyFeature: (data: UpsertCompanyFeatureDto) =>
    apiClient.post<CompanyFeature>('/company-features', data).then((r) => r.data),

  /** DELETE /company-features/:id — delete a company feature (requires branches:manage-access) */
  deleteCompanyFeature: (id: string) =>
    apiClient.delete(`/company-features/${id}`).then((r) => r.data),
}

