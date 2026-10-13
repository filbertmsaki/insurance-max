import { apiClient } from '@/modules/shared/api/client';
import type {
  Branch,
  BranchAddress,
  BranchFeature,
  EffectiveBranchFeature,
  PaginatedResponse,
} from '@/types';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateBranchDto {
  name: string;
  code: string;
  address?: BranchAddress;
  phone?: string;
  email?: string;
  manager_id?: string;
  is_head_office?: boolean;
}

export interface UpdateBranchDto {
  name?: string;
  code?: string;
  address?: BranchAddress;
  phone?: string;
  email?: string;
  manager_id?: string;
  is_head_office?: boolean;
}

export interface UpdateBranchStatusDto {
  status: 'active' | 'inactive';
}

export interface AssignBranchUserDto {
  company_user_id: string;
  is_primary?: boolean;
  make_active?: boolean;
  company_user_ids?: string[];
}

export interface BranchUserAssignment {
  id: string;
  company_user_id: string;
  is_primary: boolean;
  is_active_branch: boolean;
  assigned_at: string;
  user: {
    id: string;
    user_no: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    status: string;
    officer_title?: string;
  };
}

export interface EligibleBranchUser {
  company_user_id: string;
  user: {
    id: string;
    user_no: string;
    first_name: string;
    last_name: string;
    email: string;
    officer_title?: string;
  };
}

export interface UserBranchAssignment {
  id: string;
  is_primary: boolean;
  is_active_branch: boolean;
  branch: Branch;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const branchesApi = {
  /**
   * GET /branches?page=… — server-side table page
   * (search / status / sort / paging run in the DB, max 100 rows).
   */
  listBranches: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<Branch>>('/branches', { params, signal })
      .then((r) => r.data),

  /**
   * GET /branches without `page` — every branch of the company, for
   * selectors/dropdowns (legacy unpaged response).
   */
  getAllBranches: () =>
    apiClient.get<{ data: Branch[] }>('/branches').then((r) => r.data.data),

  /** POST /branches — create a new branch (requires branches:create) */
  createBranch: (data: CreateBranchDto) =>
    apiClient.post<Branch>('/branches', data).then((r) => r.data),

  /** GET /branches/:id — get single branch (requires branches:read) */
  getBranchById: (id: string) =>
    apiClient.get<Branch>(`/branches/${id}`).then((r) => r.data),

  /** PATCH /branches/:id — update branch (requires branches:update) */
  updateBranch: (id: string, data: UpdateBranchDto) =>
    apiClient.patch<Branch>(`/branches/${id}`, data).then((r) => r.data),

  /** PATCH /branches/:id/status — toggle active/inactive (requires branches:update) */
  setBranchStatus: (id: string, status: 'active' | 'inactive') =>
    apiClient
      .patch<Branch>(`/branches/${id}/status`, { status })
      .then((r) => r.data),

  /** DELETE /branches/:id — soft-delete branch (requires branches:delete) */
  deleteBranch: (id: string) =>
    apiClient.delete(`/branches/${id}`).then((r) => r.data),

  /** GET /branches/:id/users — list users assigned to branch */
  getBranchUsers: (branchId: string) =>
    apiClient
      .get<BranchUserAssignment[]>(`/branches/${branchId}/users`)
      .then((r) => r.data),
  getEligibleBranchUsers: (branchId: string, search?: string) =>
    apiClient
      .get<
        EligibleBranchUser[]
      >(`/branches/${branchId}/eligible-users`, { params: search ? { search } : undefined })
      .then((r) => r.data),
  getUserBranches: (companyUserId: string) =>
    apiClient
      .get<
        UserBranchAssignment[]
      >(`/company-features/${companyUserId}/branches`)
      .then((r) => r.data),

  /** POST /branches/:id/users — assign a company user to branch */
  assignBranchUser: (branchId: string, data: AssignBranchUserDto) =>
    apiClient.post(`/branches/${branchId}/users`, data).then((r) => r.data),

  /** DELETE /branches/:id/users/:companyUserId — remove user from branch */
  removeBranchUser: (branchId: string, companyUserId: string) =>
    apiClient
      .delete(`/branches/${branchId}/users/${companyUserId}`)
      .then((r) => r.data),
  removeBranchUsers: (
    branchId: string,
    company_user_ids: string[],
    replacement_branch_id?: string,
  ) =>
    apiClient
      .delete(`/branches/${branchId}/users`, {
        data: { company_user_ids, replacement_branch_id },
      })
      .then((r) => r.data),
  setUserActiveBranch: (companyUserId: string, branch_id: string) =>
    apiClient
      .patch(`/branches/users/${companyUserId}/active-branch`, { branch_id })
      .then((r) => r.data),
  setMyActiveBranch: (branch_id: string) =>
    apiClient
      .patch('/branches/me/active-branch', { branch_id })
      .then((r) => r.data),

  /** GET /branches/:id/features — effective features (company defaults merged with branch overrides) */
  getBranchFeatures: (branchId: string) =>
    apiClient
      .get<EffectiveBranchFeature[]>(`/branches/${branchId}/features`)
      .then((r) => r.data),

  /** PUT /branches/:id/features/:companyFeatureId — set branch-level override */
  setBranchFeature: (
    branchId: string,
    companyFeatureId: string,
    is_enabled: boolean,
  ) =>
    apiClient
      .put<BranchFeature>(
        `/branches/${branchId}/features/${companyFeatureId}`,
        { is_enabled },
      )
      .then((r) => r.data),

  /** DELETE /branches/:id/features/:companyFeatureId — remove override, revert to company default */
  removeBranchFeatureOverride: (branchId: string, companyFeatureId: string) =>
    apiClient
      .delete(`/branches/${branchId}/features/${companyFeatureId}`)
      .then((r) => r.data),
};
