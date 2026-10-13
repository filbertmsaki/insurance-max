import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { CustomersTable } from '@/modules/tenant/customers/components/CustomersTable';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { underwriteApi } from '../api';
import { underwriteKeys, useUnderwriteLineParam } from '../hooks';
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

  return (
    <div>
      <PageHeader
        eyebrow={`Underwrite · ${line.label}`}
        title={`${line.label} customers`}
        description={`Customers with ${line.label.toLowerCase()} quotations or policies`}
        action={
          canCreate ? (
            <Button
              onClick={() =>
                navigate(underwritePaths.customerCreate(line.slug))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              New customer
            </Button>
          ) : undefined
        }
      />

      <CustomersTable
        queryKey={[...underwriteKeys.all, line.slug, 'customers']}
        fetcher={(params, signal) =>
          underwriteApi.getCustomers(line.slug, params, signal)
        }
      />
    </div>
  );
}

export function UnderwriteCustomersPage() {
  const line = useUnderwriteLineParam();
  return line ? <CustomersList key={line.slug} line={line} /> : null;
}
