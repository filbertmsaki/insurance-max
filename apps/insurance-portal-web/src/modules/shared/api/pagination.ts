export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

/**
 * @deprecated Legacy backend pagination shape (currentPage/itemsPerPage/...).
 * Kept so existing call sites typing their responses as this union keep
 * compiling; normalizePaginatedResponse() accepts this shape directly.
 */
export interface BackendPaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

/** @deprecated See {@link BackendPaginationMeta}. */
export interface BackendPaginatedResponse<T> {
  data: T[];
  meta: BackendPaginationMeta;
}

type UnknownRecord = Record<string, unknown>;

function readNumber(
  record: UnknownRecord,
  keys: string[],
  fallback: number,
): number {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return fallback;
}

function readBoolean(
  record: UnknownRecord,
  keys: string[],
  fallback: boolean,
): boolean {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return fallback;
}

export function isPaginatedPayload(value: unknown): value is {
  data: unknown[];
  meta?: UnknownRecord;
  pagination?: UnknownRecord;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as UnknownRecord;

  return Boolean(
    Array.isArray(record.data) &&
    ((record.meta && typeof record.meta === 'object') ||
      (record.pagination && typeof record.pagination === 'object')),
  );
}

export function normalizePaginatedResponse<T>(response: {
  data: T[];
  meta?: unknown;
  pagination?: unknown;
}): PaginatedResponse<T> {
  if (response.pagination) {
    const pagination = response.pagination as UnknownRecord;

    const page = readNumber(pagination, ['page', 'currentPage'], 1);

    const limit = readNumber(
      pagination,
      ['limit', 'itemsPerPage'],
      response.data.length || 20,
    );

    const total = readNumber(
      pagination,
      ['total', 'totalItems'],
      response.data.length,
    );

    const totalPages = readNumber(
      pagination,
      ['totalPages', 'pages'],
      total > 0 ? Math.ceil(total / limit) : 0,
    );

    return {
      data: response.data,
      pagination: {
        page,
        limit,
        total,
        totalPages,

        hasNextPage: readBoolean(
          pagination,
          ['hasNextPage', 'has_next_page'],
          page < totalPages,
        ),

        hasPreviousPage: readBoolean(
          pagination,
          ['hasPreviousPage', 'has_previous_page'],
          page > 1,
        ),
      },
    };
  }

  const meta = (response.meta as UnknownRecord | undefined) || {};

  const page = readNumber(meta, ['currentPage', 'page', 'current_page'], 1);

  const limit = readNumber(
    meta,
    ['itemsPerPage', 'limit', 'items_per_page'],
    response.data.length || 20,
  );

  const total = readNumber(
    meta,
    ['totalItems', 'total', 'total_items'],
    response.data.length,
  );

  const totalPages = readNumber(
    meta,
    ['totalPages', 'pages', 'total_pages'],
    total > 0 ? Math.ceil(total / limit) : 0,
  );

  return {
    data: response.data,

    pagination: {
      page,
      limit,
      total,
      totalPages,

      hasNextPage: readBoolean(
        meta,
        ['hasNextPage', 'has_next_page'],
        page < totalPages,
      ),

      hasPreviousPage: readBoolean(
        meta,
        ['hasPreviousPage', 'has_previous_page'],
        page > 1,
      ),
    },
  };
}
