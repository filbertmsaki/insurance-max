import { apiClient } from '@/modules/shared/api/client';

export interface SalePointRecord {
  id: string;
  companyId: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  salePointCode: string;
  salePointName: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalePointDto {
  sale_point_code: string;
  sale_point_name: string;
  is_default?: boolean;
}

export type UpdateSalePointDto = Partial<CreateSalePointDto>;

/**
 * Sales-point CRUD now lives under the dedicated `/sale-points` module
 * (previously under `/tenant/tiramis-submissions/sale-points`, which was
 * removed). Branch scoping is expressed via the URL path, not the body.
 */
export const salePointsApi = {
  getAll: (branchId?: string) =>
    apiClient
      .get<SalePointRecord[]>('/sale-points', {
        params: branchId ? { branch_id: branchId } : undefined,
      })
      .then((r) => r.data),

  getForBranch: (branchId: string) =>
    apiClient
      .get<SalePointRecord[]>(`/sale-points/branch/${branchId}`)
      .then((r) => r.data),

  create: (branchId: string, data: CreateSalePointDto) =>
    apiClient
      .post<SalePointRecord>(`/sale-points/branch/${branchId}`, data)
      .then((r) => r.data),

  update: (branchId: string, id: string, data: UpdateSalePointDto) =>
    apiClient
      .patch<SalePointRecord>(`/sale-points/branch/${branchId}/${id}`, data)
      .then((r) => r.data),

  setStatus: (branchId: string, id: string, is_active: boolean) =>
    apiClient
      .patch<SalePointRecord>(`/sale-points/branch/${branchId}/${id}/status`, {
        is_active,
      })
      .then((r) => r.data),

  setDefault: (branchId: string, id: string) =>
    apiClient
      .patch<SalePointRecord>(`/sale-points/branch/${branchId}/${id}/default`)
      .then((r) => r.data),

  remove: (branchId: string, id: string) =>
    apiClient
      .delete(`/sale-points/branch/${branchId}/${id}`)
      .then((r) => r.data),
};
