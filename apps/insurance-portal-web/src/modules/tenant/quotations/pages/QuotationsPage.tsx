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
import { useDeleteQuotation, useQuotationsList } from '../hooks';
import type { QuotationListItem } from '../types';

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
      header: 'Quotation No.',
      cell: (row) => row.quotation_no,
    },
    {
      key: 'quotation_flow',
      header: 'Flow',
      cell: (row) => row.quotation_flow,
    },
    {
      key: 'product_code',
      header: 'Product Code',
      cell: (row) => row.product_code,
    },
    {
      key: 'period',
      header: 'Cover Period',
      cell: (row) =>
        `${new Date(row.cover_note_start_date).toLocaleDateString()} - ${new Date(row.cover_note_end_date).toLocaleDateString()}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <QuotationStatusBadge status={row.status} />,
    },
    {
      key: 'premium',
      header: 'Premium',
      cell: (row) =>
        `${row.currency_code} ${row.total_premium_including_tax.toLocaleString()}`,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
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
              'RATED',
              'REFERRED',
              'PENDING_APPROVAL',
              'SUBMITTED_TO_TIRA',
              'COMPLETED',
              'FAILED',
              'APPROVED',
              'REJECTED',
              'CONVERTED',
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
