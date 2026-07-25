import { apiClient } from '@/modules/shared/api/client';
import type { CompanyFeature } from '@/types';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface UpsertCompanyFeatureDto {
  feature_key: string;
  display_name: string;
  description?: string;
  is_enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CompanyUserBranchAssignment {
  id: string;
  is_primary: boolean;
  branch: {
    id: string;
    name: string;
    code: string;
    status: string;
    sale_point_code?: string | null;
    sale_point_name?: string | null;
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const companyFeaturesApi = {
  /** GET /company-features — list all company-level features (requires branches:read) */
  getCompanyFeatures: () =>
    apiClient.get<CompanyFeature[]>('/company-features').then((r) => r.data),

  /** POST /company-features — create or update a company feature (requires branches:manage-access) */
  upsertCompanyFeature: (data: UpsertCompanyFeatureDto) =>
    apiClient
      .post<CompanyFeature>('/company-features', data)
      .then((r) => r.data),

  /** DELETE /company-features/:id — delete a company feature (requires branches:manage-access) */
  deleteCompanyFeature: (id: string) =>
    apiClient.delete(`/company-features/${id}`).then((r) => r.data),

  /** GET /company-features/:companyUserId/branches — branches assigned to a user */
  getUserBranches: (companyUserId: string) =>
    apiClient
      .get<
        CompanyUserBranchAssignment[]
      >(`/company-features/${companyUserId}/branches`)
      .then((r) => r.data),
};
