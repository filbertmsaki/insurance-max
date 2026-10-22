import { apiClient } from '@/modules/shared/api/client';
import type { PaginatedResponse } from '@/modules/shared/api/pagination';
import type { Permission } from '@/types';

export interface PermissionsListParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  category?: string;
}

export interface PermissionCategoryCount {
  category: string;
  count: number;
}

export interface CreatePermissionDto {
  name: string;
  display_name: string;
  description?: string;
}

export type UpdatePermissionDto = Partial<CreatePermissionDto>;

export const permissionsApi = {
  /** GET /permissions — returns Permission[] (not paginated) */
  getPermissions: () =>
    apiClient.get<Permission[]>('/apps/permissions').then((r) => r.data),

  /** GET /permissions?page=… — server-side paginated/searchable/sortable list */
  listPermissions: (params: PermissionsListParams, signal?: AbortSignal) =>
    apiClient
      .get<
        PaginatedResponse<Permission>
      >('/apps/permissions', { params, signal })
      .then((r) => r.data),

  /** GET /permissions/categories — visible permission counts per category */
  getCategoryCounts: (signal?: AbortSignal) =>
    apiClient
      .get<
        PermissionCategoryCount[]
      >('/apps/permissions/categories', { signal })
      .then((r) => r.data),

  /** GET /permissions/:id */
  getPermissionById: (id: string) =>
    apiClient.get<Permission>(`/apps/permissions/${id}`).then((r) => r.data),

  /** POST /permissions — requires OWNER role */
  createPermission: (data: CreatePermissionDto) =>
    apiClient.post<Permission>('/apps/permissions', data).then((r) => r.data),

  /** PATCH /permissions/:id — requires OWNER role */
  updatePermission: (id: string, data: UpdatePermissionDto) =>
    apiClient
      .patch<Permission>(`/apps/permissions/${id}`, data)
      .then((r) => r.data),

  /** DELETE /permissions/:id — requires OWNER role */
  deletePermission: (id: string) =>
    apiClient.delete(`/apps/permissions/${id}`).then((r) => r.data),
};
