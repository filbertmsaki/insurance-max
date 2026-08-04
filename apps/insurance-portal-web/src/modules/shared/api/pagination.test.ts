import { describe, expect, it } from 'vitest';

import { normalizePaginatedResponse } from './pagination';

describe('normalizePaginatedResponse', () => {
  it('normalizes camel-case metadata', () => {
    const result = normalizePaginatedResponse({
      data: [{ id: '1' }],

      meta: {
        currentPage: 2,
        itemsPerPage: 10,
        totalItems: 21,
        totalPages: 3,
      },
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('normalizes snake-case quotation metadata', () => {
    const result = normalizePaginatedResponse({
      data: [{ id: '1' }],

      meta: {
        page: 1,
        limit: 20,
        total: 40,
        total_pages: 2,
        has_next_page: true,
        has_previous_page: false,
      },
    });

    expect(result.pagination.totalPages).toBe(2);
  });
});
