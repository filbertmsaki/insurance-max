import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { getApiErrorMessage } from '@/lib/api-error';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import { TiraStatusBadge } from '../components/TiraStatusBadge';
import { useDeleteQuotation, useQuotationsList } from '../hooks';
import type { QuotationListItem } from '../types';
import { formatCoverPeriod } from '../utils/coverPeriod';

function formatPremiumAmount(amount: number, currencyCode: string) {
  return formatMoney(Number.isFinite(amount) ? amount : 0, currencyCode);
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
    error,
    refetch,
    page,
    limit,
    search,
    status,
    quotationType,
    quotationFlow,
    productId,
    sortBy,
    sortOrder,
    setSearch,
    setStatus,
    setQuotationType,
    setQuotationFlow,
    setProductId,
    setPage,
    setLimit,
    setSort,
  } = useQuotationsList();
  const deleteMutation = useDeleteQuotation();
  const [deleteItem, setDeleteItem] = useState<QuotationListItem | null>(null);

  const columns: Column<QuotationListItem>[] = [
    {
      key: 'quotation_no',
      header: 'Quotation Number',
      sortable: true,
      cell: (row) => (
        <div className="space-y-1">
          <span className="block font-medium text-slate-900">
            {row.quotation_no}
          </span>
          {row.source_policy_transaction_id ? (
            <Badge variant="secondary" className="text-[11px]">
              Policy transaction
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer Name',
      sortable: true,
      cell: (row) =>
        row.customer_name ? <TruncatedText value={row.customer_name} /> : 'N/A',
    },
    {
      key: 'vehicle_registration_number',
      header: 'Reg No.',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.vehicle_registration_number || 'N/A',
    },
    {
      key: 'cover_note_start_date',
      header: 'Cover Period',
      sortable: true,
      cell: (row) => (
        <span className="block max-w-48 whitespace-normal break-words md:max-w-none md:whitespace-nowrap">
          {formatCoverPeriod(
            row.cover_note_start_date,
            row.cover_note_end_date,
          )}
        </span>
      ),
    },
    {
      key: 'product_name',
      header: 'Product Name',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => (
        <TruncatedText value={row.product_name || row.product_code} />
      ),
    },
    {
      key: 'total_premium_including_tax',
      header: 'Premium Amount',
      sortable: true,
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
      sortable: true,
      hideOnMobile: true,
      cell: (row) => <QuotationStatusBadge status={row.quotation_status} />,
    },
    {
      key: 'tira_status',
      header: 'TIRA Status',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => <TiraStatusBadge status={row.tira_status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
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
                onClick: () => {
                  void navigate(sharedUnderwritePaths.quotationDetail(row.id));
                },
              },
              {
                label: 'Edit quotation',
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => {
                  void navigate(sharedUnderwritePaths.quotationWizardEdit(row.id));
                },
              },
              ...(row.tira_status === 'NOT_SUBMITTED'
                ? [
                    {
                      label: 'Delete quotation',
                      icon: <Trash2 className="h-4 w-4" />,
                      destructive: true,
                      separatorBefore: true,
                      onClick: () => setDeleteItem(row),
                    },
                  ]
                : []),
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
          <Button
            onClick={() => {
              void navigate(sharedUnderwritePaths.quotationWizard);
            }}
          >
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
        error={error ? getApiErrorMessage(error) : undefined}
        onRetry={() => void refetch()}
        page={page}
        limit={limit}
        total={data?.pagination.total ?? 0}
        totalPages={data?.pagination.totalPages ?? 1}
        rowKey={(row) => row.id}
        onPageChange={setPage}
        onLimitChange={setLimit}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(key, order) => setSort(key, order)}
        tableClassName="whitespace-nowrap"
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Quotation"
        description="This permanently removes the unsubmitted quotation from the current company workspace."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteItem) {
            return;
          }

          deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null),
          });
        }}
      />
    </div>
  );
}
