import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { categoryAccessApi } from '@/modules/tenant/product-engine/api/category-access'
import { getApiErrorMessage } from '@/lib/api-error'
import { peKeys } from './query-keys'
import type { GrantCategoryAccessDto } from '@/types/product-engine'

export function useCategoryAccessByBranch(branchId: string) {
  return useQuery({
    queryKey: peKeys.categoryAccess.byBranch(branchId),
    queryFn: () => categoryAccessApi.getByBranch(branchId),
    staleTime: 30_000,
    enabled: !!branchId,
  })
}

export function useCategoryAccessByDepartment(departmentId: string) {
  return useQuery({
    queryKey: peKeys.categoryAccess.byDepartment(departmentId),
    queryFn: () => categoryAccessApi.getByDepartment(departmentId),
    staleTime: 30_000,
    enabled: !!departmentId,
  })
}

export function useCategoryAccessByUser(companyUserId: string) {
  return useQuery({
    queryKey: peKeys.categoryAccess.byUser(companyUserId),
    queryFn: () => categoryAccessApi.getByUser(companyUserId),
    staleTime: 30_000,
    enabled: !!companyUserId,
  })
}

export function useGrantCategoryAccessBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantCategoryAccessDto) => categoryAccessApi.grantBranch(data),
    onSuccess: (_d, vars) => {
      if (vars.branch_id) qc.invalidateQueries({ queryKey: peKeys.categoryAccess.byBranch(vars.branch_id) })
      toast.success('Access granted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useGrantCategoryAccessDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantCategoryAccessDto) => categoryAccessApi.grantDepartment(data),
    onSuccess: (_d, vars) => {
      if (vars.department_id) qc.invalidateQueries({ queryKey: peKeys.categoryAccess.byDepartment(vars.department_id) })
      toast.success('Access granted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useGrantCategoryAccessUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantCategoryAccessDto) => categoryAccessApi.grantUser(data),
    onSuccess: (_d, vars) => {
      if (vars.company_user_id) qc.invalidateQueries({ queryKey: peKeys.categoryAccess.byUser(vars.company_user_id) })
      toast.success('Access granted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRevokeCategoryAccessBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) =>
      categoryAccessApi.deleteBranch(id).then(() => branchId),
    onSuccess: (branchId) => {
      qc.invalidateQueries({ queryKey: peKeys.categoryAccess.byBranch(branchId) })
      toast.success('Access revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRevokeCategoryAccessDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deptId }: { id: string; deptId: string }) =>
      categoryAccessApi.deleteDepartment(id).then(() => deptId),
    onSuccess: (deptId) => {
      qc.invalidateQueries({ queryKey: peKeys.categoryAccess.byDepartment(deptId) })
      toast.success('Access revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRevokeCategoryAccessUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      categoryAccessApi.deleteUser(id).then(() => userId),
    onSuccess: (userId) => {
      qc.invalidateQueries({ queryKey: peKeys.categoryAccess.byUser(userId) })
      toast.success('Access revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
