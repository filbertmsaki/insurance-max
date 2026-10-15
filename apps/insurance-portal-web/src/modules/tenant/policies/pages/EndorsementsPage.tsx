import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, tableFilters, type Column } from '@/components/data-table';
import { PolicyTransactionStage } from '@insurance-max/contracts';
import { formatMoney } from '@/components/shared/detailFormat';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { useEndorsementsTable } from '../hooks';
import type { PolicyEndorsementRecord } from '../types';

export function EndorsementsPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useEndorsementsTable();

  const columns: Column<PolicyEndorsementRecord>[] = [
    {
      key: 'transaction_no',
      sortable: true,
      header: 'Endorsement',
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.transaction_no}</p>
          <p className="text-xs text-slate-400">
            {row.reason || 'No reason recorded'}
          </p>
        </div>
      ),
    },
    {
      key: 'stage',
      sortable: true,
      header: 'Stage',
      cell: (row) => <StatusBadge status={row.stage} />,
    },
    {
      key: 'approval_status',
      sortable: true,
      header: 'Approval',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.approval_status}</span>
      ),
    },
    {
      key: 'payment_status',
      sortable: true,
      header: 'Payment',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.payment_status}</span>
      ),
    },
    {
      key: 'premium_effect',
      header: 'Premium Effect',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {row.premium_effect}
          {Number(row.additional_premium) > 0
            ? ` (+${formatMoney(Number(row.additional_premium), row.currency_code)})`
            : ''}
          {Number(row.return_premium) > 0
            ? ` (-${formatMoney(Number(row.return_premium), row.currency_code)})`
            : ''}
        </span>
      ),
    },
    {
      key: 'effective_date',
      sortable: true,
      header: 'Effective Date',
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.effective_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(
                sharedUnderwritePaths.policyEndorsementEdit(
                  row.source_policy_id,
                  row.id,
                ),
              )
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Endorsements"
        description="Every endorsement raised against a policy, across the company"
      />

      <DataTable
        {...tableProps}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search endorsement number or reason"
        filters={tableFilters(state.filters, [
          {
            key: 'stage',
            label: 'Stage',
            placeholder: 'All',
            options: Object.values(PolicyTransactionStage).map((value) => ({
              value,
              label: value.replace(/_/g, ' '),
            })),
          },
        ])}
      />
    </div>
  );
}
