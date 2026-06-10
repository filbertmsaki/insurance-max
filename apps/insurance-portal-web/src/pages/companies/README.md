# Companies Module

Multi-tenant company management for the Insurance Portal. Owners manage all companies; company-scoped users manage only their own.

---

## Setup

No additional packages are required beyond what is already in `package.json`. The module is registered in [App.tsx](../../App.tsx).

To enable the test suite, install vitest once:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then add to `vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  globals: true,
}
```

Run tests:

```bash
npx vitest run src/hooks/companies
```

---

## Routes

| Path | Component | Access |
|---|---|---|
| `/companies` | `CompaniesListPage` | OWNER / SUPER_ADMIN only |
| `/companies/:id` | `CompanyDetailPage` | OWNER / SUPER_ADMIN only |
| `/my-company` | `MyCompanyPage` | Company-scoped users only (TenantGuard on backend) |

Route protection is enforced at two levels:

1. **Frontend** — `App.tsx` wraps owner routes with `requiredRole="OWNER"` and the sidebar hides links based on `hasPermission` / `hasRole` from the auth store.
2. **Backend** — `RolesGuard + PermissionsGuard` on owner endpoints; `TenantGuard` on `/companies/my`. Platform-scope tokens (OWNER) are rejected by `TenantGuard`.

---

## Hooks (`src/hooks/companies/`)

All hooks are re-exported from `src/hooks/companies/index.ts`.

### Query key strategy

```
['companies']                     root — invalidate everything
['companies', 'list']             full list (GET /companies)
['companies', 'detail', id]       single company (GET /companies/:id)
['companies', 'my']               user's company (GET /companies/my)
```

Mutations invalidate the narrowest superset needed:
- **create** → invalidates `['companies', 'list']`
- **update** → invalidates `['companies', 'detail', id]` + `['companies', 'list']`
- **status** → same as update
- **delete** → invalidates `['companies', 'list']`
- **updateMyCompany** → invalidates `['companies', 'my']`

### Read hooks

| Hook | Description |
|---|---|
| `useCompaniesList()` | All companies with URL-param filter/sort/pagination state |
| `useCompany(id)` | Single company; disabled when `id` is undefined |
| `useMyCompany()` | Authenticated user's company; disabled for platform-scope users |

### Mutation hooks

| Hook | Signature | Description |
|---|---|---|
| `useCreateCompany()` | `mutate(CreateCompanyDto)` | Creates company + admin; OWNER only |
| `useUpdateCompany(id)` | `mutate(UpdateCompanyDto)` | Updates company fields |
| `useUpdateCompanyStatus()` | `mutate({ id, status })` | Toggle active/inactive |
| `useDeleteCompany()` | `mutate(id)` | Permanently deletes company |
| `useUpdateMyCompany()` | `mutate(UpdateCompanyDto)` | Updates own company (company-scoped) |

All mutation hooks show a `sonner` toast on success and on error. Errors are parsed through `src/lib/api-error.ts` which normalises 401/403/404/422/500 responses into a human-readable string.

---

## URL query params (`CompaniesListPage`)

The list page persists all filter/sort/pagination state in the URL so the browser back button works correctly.

| Param | Default | Description |
|---|---|---|
| `q` | `''` | Search string (filters name, slug, email, phone) |
| `page` | `1` | Current page (1-based) |
| `limit` | `10` | Rows per page |
| `sortBy` | `created_at` | Sort column |
| `sortOrder` | `DESC` | `ASC` or `DESC` |

Supported sort columns: `name`, `slug`, `status`, `contact_email`, `contact_phone`, `website`, `active_users_count`, `created_at`.

Filtering and sorting are performed **client-side** because `GET /companies` returns a flat array. If the API is extended with server-side pagination in the future, update `useCompaniesList` to pass params to the API call and remove the client-side `useMemo`.

---

## Permission behaviour

| User type | Can see `/companies` | Can see `/my-company` | Can edit company |
|---|---|---|---|
| OWNER | Yes | No | Yes (all companies) |
| SUPER_ADMIN | Yes | No | Yes (all companies) |
| COMPANY_ADMIN | No | Yes | Yes (own, if `update_company_data` permission) |
| STAFF / AGENT / etc | No | Yes | No (read-only) |

The `update_company_data` permission is seeded per company role. Users without it see a read-only notice on `MyCompanyPage`.

---

## API layer (`src/api/companies.ts`)

```ts
companiesApi.getCompanies()                     // GET /companies
companiesApi.createCompany(dto)                 // POST /companies
companiesApi.getMyCompany()                     // GET /companies/my
companiesApi.updateMyCompany(dto)               // PATCH /companies/my
companiesApi.getCompanyById(id)                 // GET /companies/:id
companiesApi.updateCompany(id, dto)             // PATCH /companies/:id
companiesApi.setCompanyStatus(id, status)       // PATCH /companies/:id/status
companiesApi.deleteCompany(id)                  // DELETE /companies/:id
```
