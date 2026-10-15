import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { useServerTable } from './useServerTable';
import { useTableState } from './useTableState';

function wrapper(initialUrl = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function page(total: number, pageNo: number, limit = 10) {
  return {
    data: [{ id: String(pageNo) }],
    pagination: { page: pageNo, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

describe('useTableState', () => {
  it('ignores URL query params and caps the limit', () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ['status'] as const, defaultLimit: 999 }),
      { wrapper: wrapper('/?page=3&q=abc&status=active&sortBy=name') },
    );
    expect(result.current.query).toEqual({
      page: 1,
      limit: 100,
      search: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      filters: {},
    });
  });

  it('never changes the browser location during table interactions', () => {
    const { result } = renderHook(
      () => ({ table: useTableState({ filterKeys: ['status'] as const }), location: useLocation() }),
      { wrapper: wrapper('/customers/list#top') },
    );
    act(() => result.current.table.setSearch('acme'));
    act(() => result.current.table.setFilter('status', 'active'));
    act(() => result.current.table.setSort('name', 'ASC'));
    act(() => result.current.table.setLimit(50));
    act(() => result.current.table.setPage(3));
    expect(result.current.table.query).toMatchObject({
      page: 3,
      limit: 50,
      search: 'acme',
      sortBy: 'name',
      filters: { status: 'active' },
    });
    expect(result.current.location.pathname).toBe('/customers/list');
    expect(result.current.location.search).toBe('');
    expect(result.current.location.hash).toBe('#top');
  });

  it('resets to page 1 on search, filter, sort and page-size changes', () => {
    const { result } = renderHook(() => useTableState({ filterKeys: ['status'] as const }), {
      wrapper: wrapper('/'),
    });
    act(() => result.current.setPage(4));
    act(() => result.current.setSearch('x'));
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(4));
    act(() => result.current.setFilter('status', 'active'));
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(4));
    act(() => result.current.setLimit(50));
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(4));
    act(() => result.current.setSort('name', 'ASC'));
    expect(result.current.page).toBe(1);
  });

  it('applies cascading filter changes in one update and clears them', () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ['category_id', 'product_id'] as const }),
      { wrapper: wrapper('/') },
    );
    act(() => result.current.setFilters({ category_id: 'c1', product_id: 'p1' }));
    act(() => result.current.setFilters({ category_id: 'c2', product_id: null }));
    expect(result.current.filters).toEqual({ category_id: 'c2' });
    act(() => result.current.setSearch('q'));
    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('keeps separate state for each table instance', () => {
    const { result } = renderHook(() => ({ a: useTableState(), b: useTableState() }), {
      wrapper: wrapper('/'),
    });
    act(() => result.current.a.setPage(3));
    expect(result.current.a.page).toBe(3);
    expect(result.current.b.page).toBe(1);
  });
});

describe('useServerTable', () => {
  it('defaults to 10 rows and sends page/search/sort/filters to the server', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(1, 1));
    const { result } = renderHook(
      () => useServerTable({ queryKey: ['t'], fetcher, filterKeys: ['status'] as const }),
      { wrapper: wrapper('/') },
    );
    act(() => result.current.state.setSearch('abc'));
    act(() => result.current.state.setFilter('status', 'active'));
    act(() => result.current.state.setSort('name', 'ASC'));
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        { page: 1, limit: 10, search: 'abc', sortBy: 'name', sortOrder: 'ASC', status: 'active' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('moves back to the last valid page when the current page is out of range', async () => {
    const fetcher = vi.fn(async (params: { page: number }) =>
      params.page > 2 ? { data: [], pagination: { page: params.page, limit: 10, total: 15, totalPages: 2 } } : page(15, params.page),
    );
    const { result } = renderHook(
      () => useServerTable({ queryKey: ['t2'], fetcher, defaultLimit: 10 }),
      { wrapper: wrapper('/') },
    );
    await waitFor(() => expect(result.current.total).toBe(15));
    act(() => result.current.state.setPage(5));
    await waitFor(() => expect(result.current.state.page).toBe(2));
  });

  it('keys cache by params so stale searches cannot overwrite newer ones', async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    const fetcher = vi.fn((params: { search?: string }) =>
      params.search === 'a'
        ? new Promise((r) => (resolveSlow = r))
        : Promise.resolve({ data: [{ id: 'ab' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    );
    const { result } = renderHook(() => useServerTable<{ id: string }>({ queryKey: ['t3'], fetcher: fetcher as never }), {
      wrapper: wrapper('/'),
    });
    act(() => result.current.state.setSearch('a'));
    act(() => result.current.state.setSearch('ab'));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'ab' }]));
    await act(async () => {
      resolveSlow({ data: [{ id: 'a' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    });
    expect(result.current.rows).toEqual([{ id: 'ab' }]);
  });

  it('resets state and refetches when the active company changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(1, 1));
    const { result } = renderHook(() => useServerTable({ queryKey: ['t4'], fetcher }), {
      wrapper: wrapper('/'),
    });
    act(() => result.current.state.setSearch('secret'));
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'secret' }), expect.any(AbortSignal)));
    act(() => useAuthStore.setState({ company: { id: 'other-company' } as never }));
    await waitFor(() => expect(result.current.state.search).toBeUndefined());
    expect(fetcher).toHaveBeenLastCalledWith({ page: 1, limit: 10 }, expect.any(AbortSignal));
    act(() => useAuthStore.setState({ company: null }));
  });
});
