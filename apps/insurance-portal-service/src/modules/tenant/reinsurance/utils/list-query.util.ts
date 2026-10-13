import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  paginateQueryBuilder,
  type ListQueryOptions,
  type PaginatedResult,
} from '@insurance-max/portal-shared/utils/paginate-query.util';

import type { ReinsuranceListQueryDto } from '../dto/reinsurance.dto';

/**
 * Legacy consumers (pickers) get the full scoped array when `page` is absent;
 * the workbench table gets `{ data, pagination }`. The query builder must
 * already carry every party/scope restriction so records and count agree.
 */
export async function listOrPage<T extends ObjectLiteral, R>(
  qb: SelectQueryBuilder<T>,
  query: ReinsuranceListQueryDto | undefined,
  options: ListQueryOptions & { statusColumn: string },
  map: (row: T) => R,
): Promise<R[] | PaginatedResult<R>> {
  if (!query || !isPagedRequest(query)) {
    return (await qb.getMany()).map(map);
  }
  if (query.status) {
    qb.andWhere(`${options.statusColumn} = :listStatus`, {
      listStatus: query.status,
    });
  }
  const result = await paginateQueryBuilder(qb, query, options);
  return { ...result, data: result.data.map(map) };
}
