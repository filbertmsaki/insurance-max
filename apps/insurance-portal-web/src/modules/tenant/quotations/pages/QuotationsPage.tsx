import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { ActionMenu } from '@/components/shared/ActionMenu';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import { TiraStatusBadge } from '../components/TiraStatusBadge';
import { useDeleteQuotation, useQuotationsList } from '../hooks';
import type { QuotationListItem } from '../types';

function formatCoverDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatPremiumAmount(amount: number, currencyCode: string) {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${currencyCode} ${formattedAmount}`;
}

function TruncatedText({ value }: { value: string }) {
  return (
    <span className="block max-w-55 truncate" title={value}>
      {value}
    </span>
  );
}

export function QuotationsPage() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    page,
    limit,
    search,
    status,
    quotationType,
    quotationFlow,
    productId,
    setSearch,
    setStatus,
    setQuotationType,
    setQuotationFlow,
    setProductId,
    setPage,
    setLimit,
  } = useQuotationsList();
  const deleteMutation = useDeleteQuotation();
  const [deleteItem, setDeleteItem] = useState<QuotationListItem | null>(null);

  const columns: Column<QuotationListItem>[] = [
    {
      key: 'quotation_no',
      header: 'Quotation Number',
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.quotation_no}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer Name',
      cell: (row) =>
        row.customer_name ? (
          <TruncatedText value={row.customer_name} />
        ) : (
          '—'
        ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle Reg. / Chassis No.',
      hideOnMobile: true,
      cell: (row) =>
        row.vehicle_registration_number || row.vehicle_chassis_number || '—',
    },
    {
      key: 'cover_note_start_date',
      header: 'Cover Start Date',
      hideOnMobile: true,
      cell: (row) => formatCoverDate(row.cover_note_start_date),
    },
    {
      key: 'cover_note_end_date',
      header: 'Cover End Date',
      hideOnMobile: true,
      cell: (row) => formatCoverDate(row.cover_note_end_date),
    },
    {
      key: 'product_name',
      header: 'Product Name',
      hideOnMobile: true,
      cell: (row) => <TruncatedText value={row.product_name || row.product_code} />,
    },
    {
      key: 'premium',
      header: 'Premium Amount',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">
          {formatPremiumAmount(
            row.total_premium_including_tax,
            row.currency_code,
          )}
        </span>
      ),
    },
    {
      key: 'quotation_status',
      header: 'Quotation Status',
      hideOnMobile: true,
      cell: (row) => <QuotationStatusBadge status={row.quotation_status} />,
    },
    {
      key: 'tira_status',
      header: 'TIRA Status',
      hideOnMobile: true,
      cell: (row) => <TiraStatusBadge status={row.tira_status} />,
    },
    {
      key: 'quotation_flow',
      header: 'Flow',
      defaultVisible: false,
      cell: (row) => row.quotation_flow,
    },
    {
      key: 'display_status',
      header: 'Overall Status',
      defaultVisible: false,
      cell: (row) => <QuotationStatusBadge status={row.display_status} />,
    },
    {
      key: 'actions',
      header: '',
      className:
        'w-12 sticky right-0 bg-white shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]',
      cell: (row) => (
        <div className="flex justify-end">
          <ActionMenu
            contentClassName="w-44"
            items={[
              {
                label: 'View quotation',
                icon: <Eye className="h-4 w-4" />,
                onClick: () =>
                  navigate(underwritingPaths.quotationDetail(row.id)),
              },
              {
                label: 'Edit quotation',
                icon: <Pencil className="h-4 w-4" />,
                onClick: () =>
                  navigate(underwritingPaths.quotationWizardEdit(row.id)),
              },
              {
                label: 'Delete quotation',
                icon: <Trash2 className="h-4 w-4" />,
                destructive: true,
                separatorBefore: true,
                onClick: () => setDeleteItem(row),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Create and manage quotations using the normalized backend quotation flow."
        action={
          <Button onClick={() => navigate(underwritingPaths.quotationWizard)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Quotation
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search quotations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {[
              'DRAFT',
              'PENDING_REQUIREMENTS',
              'READY_FOR_SUBMISSION',
              'SUBMITTING_TO_TIRA',
              'SUBMITTED_TO_TIRA',
              'TIRA_PROCESSING',
              'COMPLETED',
              'REJECTED',
              'FAILED',
              'EXPIRED',
              'CANCELLED',
            ].map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={quotationType} onValueChange={setQuotationType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="MOTOR">Motor</SelectItem>
            <SelectItem value="NON_MOTOR">Non-Motor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={quotationFlow} onValueChange={setQuotationFlow}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Flow" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Flows</SelectItem>
            <SelectItem value="MOTOR_SINGLE">Motor Single</SelectItem>
            <SelectItem value="MOTOR_FLEET">Motor Fleet</SelectItem>
            <SelectItem value="NON_MOTOR">Non-Motor</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Product ID"
          value={productId === 'all' ? '' : productId}
          onChange={(event) => setProductId(event.target.value || 'all')}
          className="w-56"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        limit={limit}
        total={data?.pagination.total ?? 0}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
        tableClassName="whitespace-nowrap"
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Quotation"
        description="This permanently removes the draft quotation from the current company workspace."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteItem &&
          deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null),
          })
        }
      />
    </div>
  );
}
