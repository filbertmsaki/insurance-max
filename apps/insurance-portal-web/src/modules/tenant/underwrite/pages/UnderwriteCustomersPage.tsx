import { useNavigate } from 'react-router-dom';
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
    <CustomersTable
      title={`${line.label} customers`}
      description={`Customers with ${line.label.toLowerCase()} quotations or policies`}
      breadcrumb={[
        { label: line.label, href: underwritePaths.lineDashboard(line.slug) },
        { label: 'Customers' },
      ]}
      stateKey={`${line.slug}-customers`}
      primaryAction={
        canCreate
          ? {
              label: 'New customer',
              onClick: () =>
                navigate(underwritePaths.customerCreate(line.slug)),
            }
          : undefined
      }
      queryKey={[...underwriteKeys.all, line.slug, 'customers']}
      fetcher={(params, signal) =>
        underwriteApi.getCustomers(line.slug, params, signal)
      }
    />
  );
}

export function UnderwriteCustomersPage() {
  const line = useUnderwriteLineParam();
  return line ? <CustomersList key={line.slug} line={line} /> : null;
}
