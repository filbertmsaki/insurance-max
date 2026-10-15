import type { SelectQueryBuilder } from 'typeorm';
import {
  buildPaginationMeta,
  escapeLike,
  normalizePage,
  paginateArray,
  paginateQueryBuilder,
} from './paginate-query.util';

function fakeQueryBuilder(rows: unknown[] = [], total = 0) {
  const calls: Record<string, unknown[][]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
      return qb;
    };
  const qb = {
    andWhere: record('andWhere'),
    orderBy: record('orderBy'),
    addOrderBy: record('addOrderBy'),
    skip: record('skip'),
    take: record('take'),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  return { qb: qb as unknown as SelectQueryBuilder<{ id: string }>, calls };
}

const options = {
  sortable: { name: 'role.name', created_at: 'role.created_at' },
  defaultSort: 'created_at',
  searchable: ['role.name', 'role.display_name'],
  tieBreaker: 'role.id',
};

describe('paginate-query.util', () => {
  it('normalizes page and caps limit at 100', () => {
    expect(normalizePage({ page: 0, limit: 5000 })).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
    });
    expect(normalizePage({ page: 3, limit: 20 })).toEqual({
      page: 3,
      limit: 20,
      skip: 40,
    });
    expect(normalizePage({})).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('builds pagination meta', () => {
    expect(buildPaginationMeta(2, 10, 25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(buildPaginationMeta(1, 10, 0).totalPages).toBe(0);
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('applies parameterized search, allowlisted sort, tie-breaker and paging', async () => {
    const { qb, calls } = fakeQueryBuilder([{ id: 'a' }], 41);
    const result = await paginateQueryBuilder(
      qb,
      {
        page: 3,
        limit: 20,
        search: ' adm%n ',
        sortBy: 'name',
        sortOrder: 'asc',
      },
      options,
    );

    const [clause, params] = calls.andWhere[0] as [
      string,
      Record<string, string>,
    ];
    expect(clause).toContain('role.name');
    expect(clause).not.toContain('adm');
    expect(params.__tableSearch).toBe('%adm\\%n%');
    expect(calls.orderBy[0]).toEqual(['role.name', 'ASC', 'NULLS LAST']);
    expect(calls.addOrderBy[0]).toEqual(['role.id', 'ASC']);
    expect(calls.skip[0]).toEqual([40]);
    expect(calls.take[0]).toEqual([20]);
    expect(result.pagination).toMatchObject({
      page: 3,
      total: 41,
      totalPages: 3,
    });
  });

  it('rejects unknown sort keys (no SQL injection via sortBy)', async () => {
    const { qb, calls } = fakeQueryBuilder();
    await paginateQueryBuilder(
      qb,
      { sortBy: 'name; DROP TABLE x', sortOrder: 'bogus' },
      options,
    );
    expect(calls.orderBy[0]).toEqual(['role.created_at', 'DESC', 'NULLS LAST']);
    expect(calls.andWhere).toBeUndefined();
  });

  it('pages in-memory lists with search and sort', () => {
    const rows = [{ n: 'c' }, { n: 'a' }, { n: 'b' }, { n: 'ab' }];
    const result = paginateArray(
      rows,
      { page: 1, limit: 2, search: 'a', sortBy: 'n', sortOrder: 'ASC' },
      { searchable: (r) => [r.n], sortable: { n: (r) => r.n } },
    );
    expect(result.data.map((r) => r.n)).toEqual(['a', 'ab']);
    expect(result.pagination.total).toBe(2);
  });
});
