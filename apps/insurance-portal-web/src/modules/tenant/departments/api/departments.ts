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

export const departmentsApi = {
  getDepartments: (params?: DepartmentQueryParams) =>
    apiClient
      .get<PaginatedResponse<DepartmentRecord>>('/departments', { params })
      .then((r) => r.data),

  getDepartment: (departmentId: string) =>
    apiClient
      .get<DepartmentRecord>(`/departments/${departmentId}`)
      .then((r) => r.data),

  createDepartment: (data: CreateDepartmentDto) =>
    apiClient.post<DepartmentRecord>('/departments', data).then((r) => r.data),

  updateDepartment: (departmentId: string, data: UpdateDepartmentDto) =>
    apiClient
      .patch<DepartmentRecord>(`/departments/${departmentId}`, data)
      .then((r) => r.data),

  updateDepartmentStatus: (
    departmentId: string,
    status: 'active' | 'inactive',
  ) =>
    apiClient
      .patch<DepartmentRecord>(`/departments/${departmentId}/status`, {
        status,
      })
      .then((r) => r.data),

  deleteDepartment: (departmentId: string) =>
    apiClient.delete(`/departments/${departmentId}`).then((r) => r.data),
};
