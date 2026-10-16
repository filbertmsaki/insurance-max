import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { ActionMenu } from '@/components/shared/ActionMenu';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import { TiraStatusBadge } from '../components/TiraStatusBadge';
import { quotationsApi } from '../api';
import { useDeleteQuotation } from '../hooks';
import type { QuotationListItem, QuotationListParams } from '../types';
import { formatCoverPeriod } from '../utils/coverPeriod';
import { canEditQuotation } from '../utils/quotation-editability';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';

const FILTER_KEYS = [
  'status',
  'quotation_type',
  'quotation_flow',
  'product_id',
] as const;
type QuotationFilterKey = (typeof FILTER_KEYS)[number];

const STATUS_OPTIONS = [
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
].map((value) => ({ value, label: value }));

const TYPE_OPTIONS = [
  { value: 'MOTOR', label: 'Motor' },
  { value: 'NON_MOTOR', label: 'Non-Motor' },
];

const FLOW_OPTIONS = [
  { value: 'MOTOR_SINGLE', label: 'Motor Single' },
  { value: 'MOTOR_FLEET', label: 'Motor Fleet' },
  { value: 'NON_MOTOR', label: 'Non-Motor' },
];

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
  const { tableProps, state } = useServerTable<
    QuotationListItem,
    QuotationFilterKey
  >({
    queryKey: ['quotations', 'list'],
    fetcher: (params, signal) =>
      quotationsApi.getList(params as QuotationListParams, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
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
                label: 'Download quotation PDF',
                icon: <Download className="h-4 w-4" />,
                onClick: () =>
                  void downloadPdf(
                    `/tenant/quotations/${row.id}/document/download`,
                    documentFilename(row.quotation_no),
                  ),
              },
              ...(canEditQuotation(row)
                ? [
                    {
                      label: 'Edit quotation',
                      icon: <Pencil className="h-4 w-4" />,
                      onClick: () => {
                        void navigate(
                          sharedUnderwritePaths.quotationWizardEdit(row.id),
                        );
                      },
                    },
                  ]
                : []),
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

      <DataTable
        {...tableProps}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search quotations..."
        filters={tableFilters(state.filters, [
          {
            key: 'status',
            label: 'Status',
            placeholder: 'All Statuses',
            options: STATUS_OPTIONS,
          },
          {
            key: 'quotation_type',
            label: 'Type',
            placeholder: 'All Types',
            options: TYPE_OPTIONS,
          },
          {
            key: 'quotation_flow',
            label: 'Flow',
            placeholder: 'All Flows',
            options: FLOW_OPTIONS,
          },
        ])}
        toolbarActions={
          <Input
            placeholder="Product ID"
            value={state.filters.product_id ?? ''}
            onChange={(event) =>
              state.setFilter('product_id', event.target.value)
            }
            className="h-9 w-56"
          />
        }
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
