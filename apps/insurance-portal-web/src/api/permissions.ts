import { apiClient } from './client'
import type { Permission } from '@/types'

export interface CreatePermissionDto {
  name: string
  display_name: string
  description?: string
}

export type UpdatePermissionDto = Partial<CreatePermissionDto>

export const permissionsApi = {
  /** GET /permissions — returns Permission[] (not paginated) */
  getPermissions: () =>
    apiClient.get<Permission[]>('/permissions').then((r) => r.data),

  /** GET /permissions/:id */
  getPermissionById: (id: string) =>
    apiClient.get<Permission>(`/permissions/${id}`).then((r) => r.data),

  /** POST /permissions — requires OWNER role */
  createPermission: (data: CreatePermissionDto) =>
    apiClient.post<Permission>('/permissions', data).then((r) => r.data),

  /** PATCH /permissions/:id — requires OWNER role */
  updatePermission: (id: string, data: UpdatePermissionDto) =>
    apiClient.patch<Permission>(`/permissions/${id}`, data).then((r) => r.data),

  /** DELETE /permissions/:id — requires OWNER role */
  deletePermission: (id: string) =>
    apiClient.delete(`/permissions/${id}`).then((r) => r.data),
}
