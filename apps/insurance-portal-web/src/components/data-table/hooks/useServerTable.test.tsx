import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
  it('reads state from the URL and caps the limit', () => {
    const { result } = renderHook(
      () => useTableState({ filterKeys: ['status'] as const }),
      { wrapper: wrapper('/?page=3&limit=999&q=abc&status=active&sortBy=name&sortOrder=ASC') },
    );
    expect(result.current.query).toEqual({
      page: 3,
      limit: 100,
      search: 'abc',
      sortBy: 'name',
      sortOrder: 'ASC',
      filters: { status: 'active' },
    });
  });

  it('resets to page 1 on search, filter, sort and page-size changes', () => {
    const { result } = renderHook(() => useTableState({ filterKeys: ['status'] as const }), {
      wrapper: wrapper('/?page=4'),
    });
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

  it('namespaces params with a prefix', () => {
    const { result } = renderHook(() => useTableState({ prefix: 'inv' }), {
      wrapper: wrapper('/?page=5&inv_page=2'),
    });
    expect(result.current.page).toBe(2);
  });
});

describe('useServerTable', () => {
  it('sends page/search/sort/filters to the server', async () => {
    const fetcher = vi.fn().mockResolvedValue(page(1, 1));
    renderHook(
      () => useServerTable({ queryKey: ['t'], fetcher, filterKeys: ['status'] as const }),
      { wrapper: wrapper('/?q=abc&status=active&sortBy=name&sortOrder=ASC') },
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][0]).toEqual({
      page: 1,
      limit: 20,
      search: 'abc',
      sortBy: 'name',
      sortOrder: 'ASC',
      status: 'active',
    });
    expect(fetcher.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it('moves back to the last valid page when the current page is out of range', async () => {
    const fetcher = vi.fn(async (params: { page: number }) =>
      params.page > 2 ? { data: [], pagination: { page: params.page, limit: 10, total: 15, totalPages: 2 } } : page(15, params.page),
    );
    const { result } = renderHook(() => useServerTable({ queryKey: ['t2'], fetcher }), {
      wrapper: wrapper('/?page=5&limit=10'),
    });
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
});
