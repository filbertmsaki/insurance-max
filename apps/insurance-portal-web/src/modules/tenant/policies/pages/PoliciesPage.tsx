import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatMoney } from '@/components/shared/detailFormat';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { usePolicyCustomers, useRestorePolicy } from '../hooks';
import { policiesApi } from '../api';
import { PolicyStatusBadge } from '../components/PolicyStatusBadge';
import type { PolicyRecord } from '../types';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';

const FILTER_KEYS = ['policy_status', 'customer_id'] as const;
const STATUS_OPTIONS = [
  'COVER_NOTE_ISSUED',
  'ACTIVE',
  'CANCELLED',
  'EXPIRED',
  'LAPSED',
].map((value) => ({ value, label: value }));

export function PoliciesPage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = usePolicyCustomers();
  const { tableProps, state } = useServerTable<
    PolicyRecord,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: ['policies', 'list'],
    fetcher: (params, signal) => policiesApi.getList(params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const customerFilterOptions = customerOptions.map((customer) => ({
    value: customer.id,
    label: `${getCustomerDisplayName(customer)} (${customer.customer_no})`,
  }));
  const restoreMutation = useRestorePolicy();
  const [restoreItem, setRestoreItem] = useState<PolicyRecord | null>(null);

  const columns: Column<PolicyRecord>[] = [
    {
      key: 'policy_no',
      header: 'Policy No.',
      sortable: true,
      cell: (row) => row.policy_no,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) =>
        row.customer ? getCustomerDisplayName(row.customer) : row.customer_id,
    },
    {
      key: 'product',
      header: 'Product',
      defaultVisible: false,
      cell: (row) => row.product?.product_name ?? row.product_id,
    },
    {
      key: 'policy_status',
      header: 'Status',
      sortable: true,
      cell: (row) => <PolicyStatusBadge status={row.policy_status} />,
    },
    {
      key: 'premium',
      header: 'Premium',
      cell: (row) => formatMoney(Number(row.total_premium), row.currency),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      defaultVisible: false,
      cell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(sharedUnderwritePaths.policyDetail(row.id))}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!['DRAFT', 'PENDING', 'INCOMPLETE'].includes(
            row.policy_status.toUpperCase(),
          ) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Download policy schedule PDF"
              title="Download policy schedule PDF"
              onClick={() =>
                void downloadPdf(
                  `/tenant/policies/${row.id}/schedule/download`,
                  documentFilename(row.policy_no, '-schedule'),
                )
              }
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {!row.issued_by_system && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  navigate(sharedUnderwritePaths.policyEdit(row.id))
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRestoreItem(row)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Policies issued automatically after successful TIRAMIS new-business transactions"
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search policies..."
        filters={tableFilters(state.filters, [
          {
            key: 'policy_status',
            label: 'Status',
            placeholder: 'All Statuses',
            options: STATUS_OPTIONS,
          },
          {
            key: 'customer_id',
            label: 'Customer',
            placeholder: 'All Customers',
            options: customerFilterOptions,
          },
        ])}
      />

      <ConfirmDialog
        open={!!restoreItem}
        onOpenChange={(open) => !open && setRestoreItem(null)}
        title="Restore Policy"
        description="This will restore the policy."
        confirmLabel="Restore"
        loading={restoreMutation.isPending}
        onConfirm={() =>
          restoreItem &&
          restoreMutation.mutate(restoreItem.id, {
            onSuccess: () => setRestoreItem(null),
          })
        }
      />
    </div>
  );
}
