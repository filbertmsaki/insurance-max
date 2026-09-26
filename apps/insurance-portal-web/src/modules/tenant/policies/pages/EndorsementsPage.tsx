import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { formatMoney } from '@/components/shared/detailFormat';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { useAllEndorsements } from '../hooks';
import type { PolicyEndorsementRecord } from '../types';

export function EndorsementsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useAllEndorsements();

  const columns: Column<PolicyEndorsementRecord>[] = [
    {
      key: 'transaction_no',
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
      header: 'Stage',
      cell: (row) => <StatusBadge status={row.stage} />,
    },
    {
      key: 'approval_status',
      header: 'Approval',
      cell: (row) => (
        <span className="text-sm text-slate-600">{row.approval_status}</span>
      ),
    },
    {
      key: 'payment_status',
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
                underwritingPaths.policyEndorsementEdit(
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
        columns={columns}
        data={data}
        loading={isLoading}
        page={1}
        limit={data.length || 1}
        total={data.length}
        totalPages={1}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
      />
    </div>
  );
}
