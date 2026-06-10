import { apiClient } from './client'
import type { Role } from '@/types'

export interface CreateRoleDto {
  name: string
  display_name: string
  description?: string
  company_id?: string | null
  permission_ids?: string[]
  is_system_generated?: boolean
}

export type UpdateRoleDto = Partial<CreateRoleDto>

export const rolesApi = {
  /** GET /roles — returns Role[] (not paginated) */
  getRoles: () =>
    apiClient.get<Role[]>('/roles').then((r) => r.data),

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
}
