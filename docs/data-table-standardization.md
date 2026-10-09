# Data Table Standardization

## Audit Summary

The web app had one shared table component at
`apps/insurance-portal-web/src/components/shared/DataTable.tsx`, re-exported by
`apps/insurance-portal-web/src/components/data-table/index.ts`.

The shared table is used by standard listing screens across platform, tenant,
finance, underwriting, TIRAMIS, claims, and product-engine modules. These
screens now receive the TanStack Table-backed implementation through the same
import path, so existing permissions, row actions, mutations, and backend query
hooks continue to run unchanged.

Representative shared-table consumers:

- Platform: companies, roles, permissions, API clients, reference data.
- Tenant administration: users, branches, departments, company features.
- Underwriting and assets: customers, quotations, policies, renewals, motor
  vehicles, motor fleets, non-motor subject matters.
- Finance: invoices, payments, receipts, refunds, journals, commissions.
- TIRAMIS: dashboard, submissions, failed, retryable, tracking.
- Claims: claims list and claim documents.
- Product engine: categories, products, sub-classes, risks, rating factors.
- Shared user settings: sessions.

Specialized table implementations remain in place where the table is embedded
inside a workflow, dashboard, detail page, portal page, wizard, or complex
workbench. Examples include reinsurance, regulatory, reports, engagement,
portal, analytics, claims configuration/report dashboards, pricing breakdowns,
document detail tabs, and the newly added SaaS billing/platform intelligence
workbenches. These should be migrated only after their backend endpoints expose
compatible server-side pagination/search/sort/filter contracts.

## Architecture

The centralized table system now lives under
`apps/insurance-portal-web/src/components/data-table/`:

- `DataTable.tsx`: TanStack Table v8 rendering shell with manual server-side
  pagination, sorting, and filtering modes.
- `DataTableToolbar.tsx`: search, filter, refresh, actions, column visibility.
- `DataTablePagination.tsx`: first/previous/next/last and page-size controls.
- `DataTableColumnHeader.tsx`: sortable headers and indicators.
- `DataTableSearch.tsx`: debounced server-search input.
- `DataTableFilters.tsx`: reusable select filters.
- `DataTableRefresh.tsx`: current-query refresh control.
- `types.ts`: shared table, column, and filter types.
- `hooks/useDebouncedValue.ts`: debounce helper.

`components/shared/DataTable.tsx` is intentionally kept as a compatibility shim.

## Component Contract

Existing usage remains valid:

```tsx
<DataTable
  columns={columns}
  data={rows}
  page={page}
  limit={limit}
  total={total}
  totalPages={totalPages}
  onPageChange={setPage}
  onLimitChange={setLimit}
  sortBy={sortBy}
  sortOrder={sortOrder}
  onSortChange={setSort}
/>
```

New listing pages can additionally opt into:

- `search`, `onSearchChange`, `searchPlaceholder`, `searchDebounceMs`
- `filters`, `onFilterChange`, `onClearFilters`
- `onRefresh`, `isFetching`, `isRefreshing`
- `toolbarActions`
- `noResultsMessage`

Data fetching remains outside the component and should stay in module hooks that
call backend endpoints through the existing API client and TanStack Query.

## Backend Contract

Standard listing endpoints should converge on:

```http
GET /resource?page=1&pageSize=20&search=value&sortBy=created_at&sortOrder=DESC&status=ACTIVE
```

Responses should include rows plus pagination metadata. Existing helpers in
`modules/shared/api/pagination.ts` already normalize multiple response shapes,
so migrations can preserve backward compatibility while moving endpoints toward
a consistent contract.

Backend query handlers must allowlist searchable, sortable, and filterable
fields; apply company, branch, role, and user scope; use parameterized queries;
and return stable ordering with an ID or creation-date secondary sort.

## Migration Plan

1. Centralize the table engine behind the existing shared component. Complete.
2. Add server-search/filter/refresh props to newly migrated pages first.
3. For standard listing pages already using `DataTable`, migrate their hooks to
   backend pagination/search/sort/filter module by module.
4. For direct `Table` usage, migrate only pages that represent standard lists.
   Keep workflow/detail tables local until their APIs can return paginated data.
5. After each module migration, verify permissions, row actions, confirmation
   dialogs, approval workflows, and mutation invalidation.
6. Remove custom table logic only after the migrated module has build/test
   coverage.

## Current Exceptions

Direct `Table` implementations remain where they are workflow-specific or where
the backend currently returns dashboard/detail data instead of paginated list
data. This includes portal pages, engagement detail tabs, analytics result
tables, reinsurance/regulatory/reporting workbenches, and claim configuration
subtables.

## Validation

The shared component has focused tests covering rendering, pagination, sorting,
refresh, and debounced search. The full web production build validates all
current shared table call sites compile against the new TanStack implementation.
