export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BackendPaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface BackendPaginatedResponse<T> {
  data: T[];
  meta: BackendPaginationMeta;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export function normalizePaginatedResponse<T>(
  response: BackendPaginatedResponse<T> | PaginatedResponse<T>,
): PaginatedResponse<T> {
  if ('pagination' in response) {
    return response;
  }

  return {
    data: response.data,
    pagination: {
      page: response.meta.currentPage,
      limit: response.meta.itemsPerPage,
      total: response.meta.totalItems,
      totalPages: response.meta.totalPages,
    },
  };
}
