import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { Role } from '@/types';

export interface RolesListParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  scope?: string;
}

export interface CreateRoleDto {
  name: string;
  display_name: string;
  description?: string;
  company_id?: string | null;
  permission_ids?: string[];
  is_system_generated?: boolean;
  permission_data_scopes?: Array<{
    permission_id: string;
    data_scope: 'USER' | 'DEPARTMENT' | 'BRANCH' | 'COMPANY';
  }>;
}

export type UpdateRoleDto = Partial<CreateRoleDto>;

export const rolesApi = {
  /** GET /roles — returns Role[] (not paginated) */
  getRoles: () => apiClient.get<Role[]>('/roles').then((r) => r.data),

  /** GET /roles?page=… — server-side paginated/searchable/sortable list */
  listRoles: (params: RolesListParams, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<Role>>('/roles', { params, signal })
      .then((r) => r.data),

  /** GET /roles/:id */
  getRoleById: (id: string) =>
    apiClient.get<Role>(`/roles/${id}`).then((r) => r.data),

  /** POST /roles */
  createRole: (data: CreateRoleDto) =>
    apiClient.post<Role>('/roles', data).then((r) => r.data),

  /** PATCH /roles/:id */
  updateRole: (id: string, data: UpdateRoleDto) =>
    apiClient.patch<Role>(`/roles/${id}`, data).then((r) => r.data),

  /** DELETE /roles/:id */
  deleteRole: (id: string) =>
    apiClient.delete(`/roles/${id}`).then((r) => r.data),
};
