import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productAccessApi } from '@/modules/tenant/product-engine/api/product-access'
import { getApiErrorMessage } from '@/lib/api-error'
import { peKeys } from './query-keys'
import type { GrantProductAccessDto } from '@/types/product-engine'

export function useProductAccessByBranch(branchId: string) {
  return useQuery({
    queryKey: peKeys.productAccess.byBranch(branchId),
    queryFn: () => productAccessApi.getByBranch(branchId),
    staleTime: 30_000,
    enabled: !!branchId,
  })
}

export function useProductAccessByDepartment(departmentId: string) {
  return useQuery({
    queryKey: peKeys.productAccess.byDepartment(departmentId),
    queryFn: () => productAccessApi.getByDepartment(departmentId),
    staleTime: 30_000,
    enabled: !!departmentId,
  })
}

export function useProductAccessByUser(companyUserId: string) {
  return useQuery({
    queryKey: peKeys.productAccess.byUser(companyUserId),
    queryFn: () => productAccessApi.getByUser(companyUserId),
    staleTime: 30_000,
    enabled: !!companyUserId,
  })
}

export function useGrantProductAccessBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantProductAccessDto) => productAccessApi.grantBranch(data),
    onSuccess: (_d, vars) => {
      if (vars.branch_id) qc.invalidateQueries({ queryKey: peKeys.productAccess.byBranch(vars.branch_id) })
      toast.success('Access granted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useGrantProductAccessDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantProductAccessDto) => productAccessApi.grantDepartment(data),
    onSuccess: (_d, vars) => {
      if (vars.department_id) qc.invalidateQueries({ queryKey: peKeys.productAccess.byDepartment(vars.department_id) })
      toast.success('Access granted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useGrantProductAccessUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GrantProductAccessDto) => productAccessApi.grantUser(data),
    onSuccess: (_d, vars) => {
      if (vars.company_user_id) qc.invalidateQueries({ queryKey: peKeys.productAccess.byUser(vars.company_user_id) })
      toast.success('Access granted')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRevokeProductAccessBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: string }) =>
      productAccessApi.deleteBranch(id).then(() => branchId),
    onSuccess: (branchId) => {
      qc.invalidateQueries({ queryKey: peKeys.productAccess.byBranch(branchId) })
      toast.success('Access revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRevokeProductAccessDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deptId }: { id: string; deptId: string }) =>
      productAccessApi.deleteDepartment(id).then(() => deptId),
    onSuccess: (deptId) => {
      qc.invalidateQueries({ queryKey: peKeys.productAccess.byDepartment(deptId) })
      toast.success('Access revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useRevokeProductAccessUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      productAccessApi.deleteUser(id).then(() => userId),
    onSuccess: (userId) => {
      qc.invalidateQueries({ queryKey: peKeys.productAccess.byUser(userId) })
      toast.success('Access revoked')
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
