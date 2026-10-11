import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { CustomersTable } from '@/modules/tenant/customers/components/CustomersTable';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { useUnderwriteCustomers, useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';

/**
 * Customers with business in the line. Customers are one central record set
 * (never duplicated per line), so rows and "New customer" open the shared
 * customer screens.
 */
function CustomersList({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const canCreate = useAuthStore((state) =>
    state.hasPermission('customers:create'),
  );
  const {
    query,
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    setSearch,
    setSort,
    setPage,
    setLimit,
  } = useUnderwriteCustomers(line.slug);

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite · ${line.label}`}
        title={`${line.label} customers`}
        description={`Customers with ${line.label.toLowerCase()} quotations or policies`}
        action={
          canCreate ? (
            <Button
              onClick={() => navigate(underwritePaths.customerCreate(line.slug))}
            >
              <Plus className="mr-2 h-4 w-4" />
              New customer
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <CustomersTable
        customers={query.data?.data ?? []}
        loading={query.isLoading}
        page={page}
        limit={limit}
        total={query.data?.pagination.total ?? 0}
        totalPages={query.data?.pagination.totalPages ?? 1}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSortChange={setSort}
      />
    </div>
  );
}

export function UnderwriteCustomersPage() {
  const line = useUnderwriteLineParam();
  return line ? <CustomersList key={line.slug} line={line} /> : null;
}
