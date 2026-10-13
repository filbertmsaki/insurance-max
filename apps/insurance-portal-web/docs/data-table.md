# Server-side DataTable

Every database-backed record list uses one shared component
(`@/components/shared/DataTable`, built on TanStack Table v8) plus one
hook (`useServerTable`). Pagination, search, sorting and filtering run in
the database; the browser never pages or filters a full list.

Reference implementation: `src/modules/platform/roles/pages/RolesPage.tsx`
+ `apps/insurance-portal-service/src/modules/platform/roles/roles.service.ts#findPage`.

## Request / response contract

```
GET /things?page=1&limit=20&search=abc&sortBy=name&sortOrder=ASC&status=active
→ { data: Thing[], pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage } }
```

- `limit` is capped at 100. `sortBy` must be in the service allowlist; unknown keys fall back to the default sort.
- Legacy endpoints that returned `meta: { totalItems, currentPage, ... }` keep working. The frontend's `normalizePaginatedResponse` accepts both shapes.
- **Compatibility:** if an endpoint used to return a plain array (dropdowns, pickers), keep that response when `page` is absent and return the paged shape only when `page` is present (`isPagedRequest(query)`).

## Backend: adding a paged list

```ts
// dto/find-things-query.dto.ts
export class FindThingsQueryDto extends TableQueryDto {   // @insurance-max/portal-shared/dto/table-query.dto
  @IsOptional() @IsEnum(ThingStatus) status?: ThingStatus; // every filter must be declared (forbidNonWhitelisted)
}

// controller
@Get() @Permissions('things:read')
findAll(@CurrentUser() user, @Query() query: FindThingsQueryDto) {
  return isPagedRequest(query) ? this.service.findPage(user, query) : this.service.findAll(user);
}

// service
async findPage(user: AuthenticatedUser, query: FindThingsQueryDto) {
  const qb = this.repo.createQueryBuilder('thing');
  this.applyAccessScope(qb, user);          // tenant / branch / department / role rules FIRST
  if (query.status) qb.andWhere('thing.status = :status', { status: query.status });
  return paginateQueryBuilder(qb, query, {  // @insurance-max/portal-shared/utils/paginate-query.util
    sortable: { name: 'thing.name', created_at: 'thing.created_at' },
    defaultSort: 'created_at',
    searchable: ['thing.name', 'thing.code'],
    tieBreaker: 'thing.id',
  });
}
```

`paginateQueryBuilder` runs records and count against the same query, so
scope and filters always apply to both. It parameterises and escapes the
search term, allowlists sort columns, and adds a unique tie-breaker so paging
is deterministic. For non-SQL sources (static registries) use `paginateArray`.

Indexes: add a migration only when a new filter or sort column is not
already covered and the table can grow large (for example `(company_id, created_at)`).

## Frontend: adding a table

```tsx
const FILTER_KEYS = ['status'] as const;

const { tableProps, state } = useServerTable<Thing, (typeof FILTER_KEYS)[number]>({
  queryKey: ['things'],                                 // mutations invalidate ['things']
  fetcher: (params, signal) => thingsApi.list(params, signal),
  filterKeys: FILTER_KEYS,
  defaultSortBy: 'created_at',
  // prefix: 'things',       // when a page has more than one table (URL param namespace)
  // persist: 'memory',      // for tables inside dialogs/drawers
  // extraParams: { policy_id }, // fixed scope (parent id, active tab)
});

<DataTable
  {...tableProps}
  columns={columns}                                      // { key, header, sortable?, cell, hideOnMobile?, defaultVisible? }
  searchPlaceholder="Search things…"
  filters={tableFilters(state.filters, [{ key: 'status', label: 'Status', options: STATUS_OPTIONS }])}
  rowActions={[
    { label: 'View', icon: Eye, onClick: (r) => navigate(`/things/${r.id}`) },
    { label: 'Delete', icon: Trash2, destructive: true, separator: true,
      hidden: !can('things:delete'), onClick: (r) => setDeleteId(r.id) },
  ]}
  toolbarActions={<Button onClick={openCreate}>New</Button>}
/>
```

Column `key` should equal the backend sort key when `sortable: true`.

The state lives in the URL (`?page=&limit=&q=&sortBy=&sortOrder=&status=`),
so refresh, shared links and back-navigation keep the view. Search, filter and
page-size changes reset to page 1. If a delete leaves the current page past the
end, the hook moves back to the last valid page.

Stale responses: every request is keyed by its full params and receives an
`AbortSignal`, so an older search can't overwrite a newer one.

### Selection and bulk actions

```tsx
<DataTable enableRowSelection bulkActions={(ids, clear) => <Button onClick={() => approve(ids).then(clear)}>Approve</Button>} … />
```

Selection is keyed by row id and **persists across pages, search and sort
changes** until it is cleared. The header checkbox toggles only the current page.

### Export

```tsx
exportOptions={{
  onExportPage: () => downloadCsv(tableProps.data),
  onExportAll: () => thingsApi.export(toListParams(state.query)),   // server applies same scope + filters
}}
```

## Local tables (not migrated)

Form-entry grids, calculation and preview tables, and fixed small config
tables that are not lists of database records keep their local behaviour.
They may still render with `DataTable` using client data.
