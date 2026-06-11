import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { companyFeaturesApi } from '@/modules/tenant/company-features/api/company-features'
import { companyFeaturesKeys } from './query-keys'
import type { CompanyFeature, SortOrder } from '@/types'

export type CompanyFeatureSortKey = 'feature_key' | 'display_name' | 'is_enabled' | 'created_at'

function sortFeatures(
  a: CompanyFeature,
  b: CompanyFeature,
  key: CompanyFeatureSortKey,
  order: SortOrder,
): number {
  let aVal: string | number | boolean
  let bVal: string | number | boolean

  if (key === 'created_at') {
    aVal = new Date(a.created_at).getTime()
    bVal = new Date(b.created_at).getTime()
  } else if (key === 'is_enabled') {
    aVal = a.is_enabled ? 1 : 0
    bVal = b.is_enabled ? 1 : 0
  } else {
    aVal = (a[key] as string) ?? ''
    bVal = (b[key] as string) ?? ''
  }

  if (aVal === bVal) return 0
  const cmp = aVal < bVal ? -1 : 1
  return order === 'ASC' ? cmp : -cmp
}

export function useCompanyFeaturesList() {
  const [params, setParams] = useSearchParams()

  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1'))
  const limit = Number(params.get('limit') ?? '10')
  const sortBy = (params.get('sortBy') as CompanyFeatureSortKey) ?? 'feature_key'
  const sortOrder = (params.get('sortOrder') as SortOrder) ?? 'ASC'

  const { data: allFeatures = [], isLoading, error } = useQuery({
    queryKey: companyFeaturesKeys.lists(),
    queryFn: companyFeaturesApi.getCompanyFeatures,
    staleTime: 30_000,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const matches = q
      ? allFeatures.filter(
          (f) =>
            f.feature_key.toLowerCase().includes(q) ||
            f.display_name.toLowerCase().includes(q) ||
            (f.description ?? '').toLowerCase().includes(q),
        )
      : [...allFeatures]
    return matches.sort((a, b) => sortFeatures(a, b, sortBy, sortOrder))
  }, [allFeatures, search, sortBy, sortOrder])

  const total = filtered.length
  const totalPages = Math.ceil(total / limit) || 1
  const safePageIndex = Math.min(page, totalPages)
  const pageData = filtered.slice((safePageIndex - 1) * limit, safePageIndex * limit)

  function setSearch(q: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('q', q)
      next.set('page', '1')
      return next
    })
  }

  function setPage(p: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
  }

  function setLimit(l: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('limit', String(l))
      next.set('page', '1')
      return next
    })
  }

  function setSort(key: CompanyFeatureSortKey, order: SortOrder) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('sortBy', key)
      next.set('sortOrder', order)
      next.set('page', '1')
      return next
    })
  }

  return {
    features: pageData,
    total,
    totalPages,
    isLoading,
    error,
    search,
    page: safePageIndex,
    limit,
    sortBy,
    sortOrder,
    setSearch,
    setPage,
    setLimit,
    setSort,
  }
}
