import { useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { usersKeys } from './query-keys'
import type { UserStatus, SortOrder, UsersQueryParams } from '@/types'

export type UserSortKey = NonNullable<UsersQueryParams['sortBy']>

/**
 * Server-side paginated user list with URL-persisted filter/sort/page state.
 *
 * URL params used:
 *   q          — committed search (sent to API)
 *   page       — current page (1-based)
 *   limit      — rows per page
 *   sortBy     — UserSortKey
 *   sortOrder  — 'ASC' | 'DESC'
 *   status     — UserStatus | 'all'
 *
 * liveSearch is local state only (display value while user types).
 */
export function useUsersList() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Number(searchParams.get('limit') ?? '20')
  const filterStatus = (searchParams.get('status') ?? 'all') as UserStatus | 'all'
  const sortBy = (searchParams.get('sortBy') as UserSortKey) ?? 'created_at'
  const sortOrder = (searchParams.get('sortOrder') as SortOrder) ?? 'DESC'

  // liveSearch tracks what the user is typing without debounce lag in the input
  const [liveSearch, setLiveSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const queryParams: UsersQueryParams = {
    page,
    limit,
    search: search || undefined,
    status: filterStatus !== 'all' ? filterStatus : undefined,
    sortBy,
    sortOrder,
  }

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: usersKeys.list(queryParams),
    queryFn: () => usersApi.getUsers(queryParams),
    placeholderData: (prev) => prev,
  })

  const setSearch = useCallback(
    (value: string) => {
      setLiveSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set('q', value)
          else next.delete('q')
          next.set('page', '1')
          return next
        })
      }, 350)
    },
    [setSearchParams],
  )

  const setFilterStatus = useCallback(
    (status: UserStatus | 'all') => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (status === 'all') next.delete('status')
        else next.set('status', status)
        next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('page', String(p))
        return next
      })
    },
    [setSearchParams],
  )

  const setLimit = useCallback(
    (l: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('limit', String(l))
        next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  const setSort = useCallback(
    (key: UserSortKey, order: SortOrder) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('sortBy', key)
        next.set('sortOrder', order)
        next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setLiveSearch('')
    setSearchParams({})
  }, [setSearchParams])

  return {
    users: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    isFetching,
    error,
    // state
    liveSearch,
    search,
    filterStatus,
    sortBy,
    sortOrder,
    page,
    limit,
    hasActiveFilters: !!(search || filterStatus !== 'all' || sortBy !== 'created_at'),
    // setters
    setSearch,
    setFilterStatus,
    setPage,
    setLimit,
    setSort,
    clearFilters,
  }
}
