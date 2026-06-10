import { apiClient } from '@/api/client'
import type { AccessRecord, GrantCategoryAccessDto, ResolveAccessDto } from '@/types/product-engine'

export const categoryAccessApi = {
  // Branch
  grantBranch: (data: GrantCategoryAccessDto) =>
    apiClient.post<AccessRecord>('/category-access/branch', data).then((r) => r.data),

  getByBranch: (branchId: string) =>
    apiClient.get<AccessRecord[]>(`/category-access/branch/${branchId}`).then((r) => r.data),

  deleteBranch: (id: string) =>
    apiClient.delete(`/category-access/branch/${id}`).then((r) => r.data),

  // Department
  grantDepartment: (data: GrantCategoryAccessDto) =>
    apiClient.post<AccessRecord>('/category-access/department', data).then((r) => r.data),

  getByDepartment: (departmentId: string) =>
    apiClient
      .get<AccessRecord[]>(`/category-access/department/${departmentId}`)
      .then((r) => r.data),

  deleteDepartment: (id: string) =>
    apiClient.delete(`/category-access/department/${id}`).then((r) => r.data),

  // User
  grantUser: (data: GrantCategoryAccessDto) =>
    apiClient.post<AccessRecord>('/category-access/user', data).then((r) => r.data),

  getByUser: (companyUserId: string) =>
    apiClient
      .get<AccessRecord[]>(`/category-access/user/${companyUserId}`)
      .then((r) => r.data),

  deleteUser: (id: string) =>
    apiClient.delete(`/category-access/user/${id}`).then((r) => r.data),

  // Resolve
  resolve: (data: ResolveAccessDto) =>
    apiClient.post('/category-access/resolve', data).then((r) => r.data),

  getAccessible: (params: { company_user_id?: string; branch_id?: string; department_id?: string }) =>
    apiClient.get('/category-access/accessible', { params }).then((r) => r.data),
}
