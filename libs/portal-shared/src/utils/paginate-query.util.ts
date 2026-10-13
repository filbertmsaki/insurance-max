import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { SortDirection } from '../dto/pagination.dto';

/** Hard cap applied to every server-side table, regardless of the DTO max. */
export const TABLE_MAX_PAGE_SIZE = 100;
export const TABLE_DEFAULT_PAGE_SIZE = 20;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ListQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortDirection | 'ASC' | 'DESC' | string;
}

export interface ListQueryOptions {
  /**
   * Allowlist of public sort keys → SQL column expressions
   * (e.g. `{ name: 'role.display_name' }`). Unknown keys fall back to
   * `defaultSort`, so user input never reaches ORDER BY directly.
   */
  sortable: Record<string, string>;
  defaultSort: string;
  defaultOrder?: 'ASC' | 'DESC';
  /** Column expressions matched with ILIKE against the search term. */
  searchable?: string[];
  /** Unique column appended to ORDER BY for deterministic paging. */
  tieBreaker: string;
  maxLimit?: number;
}

export function normalizePage(input: ListQueryInput, maxLimit = TABLE_MAX_PAGE_SIZE) {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const limit = Math.min(
    Math.max(1, Math.floor(Number(input.limit) || TABLE_DEFAULT_PAGE_SIZE)),
    maxLimit,
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Applies allowlisted search, sorting and paging to a query builder that
 * already carries every access/tenant restriction, then runs records and
 * count with the same WHERE clause. Callers must add scope filters *before*
 * calling this so both queries stay consistent.
 */
export async function paginateQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  input: ListQueryInput,
  options: ListQueryOptions,
): Promise<PaginatedResult<T>> {
  const { page, limit, skip } = normalizePage(input, options.maxLimit);

  const term = input.search?.trim();
  if (term && options.searchable?.length) {
    const clause = options.searchable
      .map((column) => `CAST(${column} AS TEXT) ILIKE :__tableSearch ESCAPE '\\'`)
      .join(' OR ');
    qb.andWhere(`(${clause})`, { __tableSearch: `%${escapeLike(term)}%` });
  }

  const sortKey =
    input.sortBy && Object.prototype.hasOwnProperty.call(options.sortable, input.sortBy)
      ? input.sortBy
      : options.defaultSort;
  const requested = String(input.sortOrder ?? '').toUpperCase();
  const direction: 'ASC' | 'DESC' =
    requested === 'ASC' || requested === 'DESC'
      ? requested
      : (options.defaultOrder ?? 'DESC');

  qb.orderBy(options.sortable[sortKey], direction, 'NULLS LAST');
  if (options.sortable[sortKey] !== options.tieBreaker) {
    qb.addOrderBy(options.tieBreaker, direction);
  }

  const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
  return { data, pagination: buildPaginationMeta(page, limit, total) };
}

/** Pages an in-memory list for sources that are not SQL-backed (e.g. config registries). */
export function paginateArray<T>(
  rows: T[],
  input: ListQueryInput,
  options: {
    searchable?: (row: T) => Array<string | null | undefined>;
    sortable?: Record<string, (row: T) => string | number | null | undefined>;
    defaultSort?: string;
  } = {},
): PaginatedResult<T> {
  const { page, limit, skip } = normalizePage(input);
  const term = input.search?.trim().toLowerCase();
  let filtered = rows;
  if (term && options.searchable) {
    filtered = rows.filter((row) =>
      options.searchable!(row).some((v) => v?.toLowerCase().includes(term)),
    );
  }
  const key =
    input.sortBy && options.sortable?.[input.sortBy] ? input.sortBy : options.defaultSort;
  const getter = key ? options.sortable?.[key] : undefined;
  if (getter) {
    const dir = String(input.sortOrder).toUpperCase() === 'DESC' ? -1 : 1;
    filtered = [...filtered].sort((a, b) => {
      const x = getter(a) ?? '';
      const y = getter(b) ?? '';
      return x < y ? -dir : x > y ? dir : 0;
    });
  }
  return {
    data: filtered.slice(skip, skip + limit),
    pagination: buildPaginationMeta(page, limit, filtered.length),
  };
}
