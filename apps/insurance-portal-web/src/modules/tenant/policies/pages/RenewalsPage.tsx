import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getApiErrorMessage } from '@/lib/api-error';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { policiesApi } from '../api';
import { useAllRenewals } from '../hooks';
import type { PolicyRenewalRecord } from '../types';
import { toast } from 'sonner';

export function RenewalsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useAllRenewals();
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function openRenewal(renewal: PolicyRenewalRecord) {
    setOpeningId(renewal.id);
    try {
      const context = await policiesApi.getRenewalContext(renewal.id);
      if (!context.transaction) {
        toast.error('Could not find the source policy for this renewal.');
        return;
      }
      navigate(
        sharedUnderwritePaths.policyRenewalDetail(
          context.transaction.source_policy_id,
          renewal.id,
        ),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setOpeningId(null);
    }
  }

  const columns: Column<PolicyRenewalRecord>[] = [
    {
      key: 'renewal_no',
      header: 'Renewal',
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.renewal_no}</p>
          <p className="text-xs text-slate-400">
            {row.source_cover_note_reference}
          </p>
        </div>
      ),
    },
    {
      key: 'renewal_status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.renewal_status} />,
    },
    {
      key: 'period',
      header: 'Renewal Period',
      cell: (row) => (
        <span className="text-sm text-slate-600">
          {new Date(row.renewal_start_date).toLocaleDateString()} –{' '}
          {new Date(row.renewal_end_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'offer_expires_at',
      header: 'Offer Expires',
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {row.offer_expires_at
            ? new Date(row.offer_expires_at).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString()}
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
            disabled={openingId === row.id}
            onClick={() => void openRenewal(row)}
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
        title="Renewals"
        description="Every renewal offer in progress or completed, across the company"
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
