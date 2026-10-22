import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/types';

export interface DepartmentBranchSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  sale_point_code?: string | null;
  sale_point_name?: string | null;
}

export interface DepartmentRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  code: string;
  description: string | null;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  branch?: DepartmentBranchSummary | null;
}

export interface DepartmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  branch_id?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  code?: string;
  description?: string | null;
  branch_id?: string | null;
}

export interface UpdateDepartmentStatusDto {
  status: 'active' | 'inactive';
}

/** Backend page-size cap for server-side tables. */
const MAX_TABLE_LIMIT = 100;

export const departmentsApi = {
  /**
   * GET /departments. A request for more than one table page (legacy
   * "fetch all" callers pass limit > 100) is sent without page/limit so the
   * backend returns every department of the company.
   */
  getDepartments: (params?: DepartmentQueryParams) => {
    const wantsAll = (params?.limit ?? 0) > MAX_TABLE_LIMIT;
    return apiClient
      .get<PaginatedResponse<DepartmentRecord>>('/apps/departments', {
        params: wantsAll ? undefined : params,
      })
      .then((r) => r.data);
  },

  /** GET /departments?page=… — server-side table page (search/status/branch/sort). */
  listDepartments: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<DepartmentRecord>>('/apps/departments', {
        params,
        signal,
      })
      .then((r) => r.data),

  getDepartment: (departmentId: string) =>
    apiClient
      .get<DepartmentRecord>(`/apps/departments/${departmentId}`)
      .then((r) => r.data),

  createDepartment: (data: CreateDepartmentDto) =>
    apiClient
      .post<DepartmentRecord>('/apps/departments', data)
      .then((r) => r.data),

  updateDepartment: (departmentId: string, data: UpdateDepartmentDto) =>
    apiClient
      .patch<DepartmentRecord>(`/apps/departments/${departmentId}`, data)
      .then((r) => r.data),

  updateDepartmentStatus: (
    departmentId: string,
    status: 'active' | 'inactive',
  ) =>
    apiClient
      .patch<DepartmentRecord>(`/apps/departments/${departmentId}/status`, {
        status,
      })
      .then((r) => r.data),

  deleteDepartment: (departmentId: string) =>
    apiClient.delete(`/apps/departments/${departmentId}`).then((r) => r.data),
};
