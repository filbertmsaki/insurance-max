import { apiClient } from '@/modules/shared/api/client'
import type { AccessRecord, GrantProductAccessDto, ResolveAccessDto } from '@/types/product-engine'

export const productAccessApi = {
  // Branch
  grantBranch: (data: GrantProductAccessDto) =>
    apiClient.post<AccessRecord>('/product-access/branch', data).then((r) => r.data),

  getByBranch: (branchId: string) =>
    apiClient.get<AccessRecord[]>(`/product-access/branch/${branchId}`).then((r) => r.data),

  deleteBranch: (id: string) =>
    apiClient.delete(`/product-access/branch/${id}`).then((r) => r.data),

  // Department
  grantDepartment: (data: GrantProductAccessDto) =>
    apiClient.post<AccessRecord>('/product-access/department', data).then((r) => r.data),

  getByDepartment: (departmentId: string) =>
    apiClient
      .get<AccessRecord[]>(`/product-access/department/${departmentId}`)
      .then((r) => r.data),

  deleteDepartment: (id: string) =>
    apiClient.delete(`/product-access/department/${id}`).then((r) => r.data),

  // User
  grantUser: (data: GrantProductAccessDto) =>
    apiClient.post<AccessRecord>('/product-access/user', data).then((r) => r.data),

  getByUser: (companyUserId: string) =>
    apiClient
      .get<AccessRecord[]>(`/product-access/user/${companyUserId}`)
      .then((r) => r.data),

  deleteUser: (id: string) =>
    apiClient.delete(`/product-access/user/${id}`).then((r) => r.data),

  // Resolve
  resolve: (data: ResolveAccessDto) =>
    apiClient.post('/product-access/resolve', data).then((r) => r.data),

  getAccessible: (params: { company_user_id?: string; branch_id?: string; department_id?: string; category_id?: string }) =>
    apiClient.get('/product-access/accessible', { params }).then((r) => r.data),
}
