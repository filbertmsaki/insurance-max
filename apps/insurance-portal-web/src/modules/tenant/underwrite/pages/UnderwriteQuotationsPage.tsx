import { useNavigate } from 'react-router-dom';
import { Download, Eye, Pencil, Plus } from 'lucide-react';
import {
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ActionMenu } from '@/components/shared/ActionMenu';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { QuotationStatusBadge } from '@/modules/tenant/quotations/components/QuotationStatusBadge';
import { TiraStatusBadge } from '@/modules/tenant/quotations/components/TiraStatusBadge';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';
import { formatCoverPeriod } from '@/modules/tenant/quotations/utils/coverPeriod';
import { underwriteApi } from '../api';
import { underwriteKeys, useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import { canEditQuotation } from '@/modules/tenant/quotations/utils/quotation-editability';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';

const STATUS_OPTIONS = [
  'DRAFT',
  'PENDING_REQUIREMENTS',
  'READY_FOR_SUBMISSION',
  'SUBMITTED_TO_TIRA',
  'TIRA_PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;

const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));
const FILTER_KEYS = ['status'] as const;

function lineColumns(line: UnderwriteLineMeta): Column<QuotationListItem>[] {
  if (line.line === 'MOTOR') {
    return [
      {
        key: 'vehicle_registration_number',
        header: 'Reg No.',
        sortable: true,
        hideOnMobile: true,
        cell: (row) => row.vehicle_registration_number || 'N/A',
      },
    ];
  }
  if (line.line === 'FLEET') {
    return [
      {
        key: 'fleet_id',
        header: 'Fleet ID',
        hideOnMobile: true,
        cell: (row) => row.fleet_id || 'N/A',
      },
    ];
  }
  return [];
}

function QuotationsList({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    QuotationListItem,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: underwriteKeys.quotations(line.slug),
    fetcher: (params, signal) =>
      underwriteApi.getQuotations(
        line.slug,
        params as Parameters<typeof underwriteApi.getQuotations>[1],
        signal,
      ),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate =
    line.hasWizard &&
    hasPermission(underwritePermission(line.line, UnderwriteAction.CREATE)) &&
    hasPermission('quotations:create');
  const canEdit =
    line.hasWizard &&
    hasPermission(underwritePermission(line.line, UnderwriteAction.EDIT)) &&
    hasPermission('quotations:update');

  const columns: Column<QuotationListItem>[] = [
    {
      key: 'quotation_no',
      header: 'Quotation No.',
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
      header: 'Customer',
      sortable: true,
      cell: (row) => row.customer_name || 'N/A',
    },
    ...lineColumns(line),
    {
      key: 'product_name',
      header: 'Product',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.product_name || row.product_code,
    },
    {
      key: 'cover_note_start_date',
      header: 'Cover Period',
      sortable: true,
      hideOnMobile: true,
      cell: (row) =>
        formatCoverPeriod(row.cover_note_start_date, row.cover_note_end_date),
    },
    {
      key: 'total_premium_including_tax',
      header: 'Premium',
      sortable: true,
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">
          {formatMoney(
            Number.isFinite(row.total_premium_including_tax)
              ? row.total_premium_including_tax
              : 0,
            row.currency_code,
          )}
        </span>
      ),
    },
    {
      key: 'quotation_status',
      header: 'Status',
      sortable: true,
      cell: (row) => <QuotationStatusBadge status={row.display_status} />,
    },
    {
      key: 'tira_status',
      header: 'TIRA',
      sortable: true,
      hideOnMobile: true,
      cell: (row) => <TiraStatusBadge status={row.tira_status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end">
          <ActionMenu
            ariaLabel={`Actions for quotation ${row.quotation_no}`}
            items={[
              {
                label: 'Download quotation PDF',
                icon: <Download className="h-4 w-4" />,
                onClick: () =>
                  void downloadPdf(
                    `/tenant/quotations/${row.id}/document/download`,
                    documentFilename(row.quotation_no),
                  ),
              },
              {
                label: 'View quotation',
                icon: <Eye className="h-4 w-4" />,
                onClick: () =>
                  navigate(underwritePaths.quotationDetail(line.slug, row.id)),
              },
              ...(canEdit &&
              !row.source_policy_transaction_id &&
              canEditQuotation(row)
                ? [
                    {
                      label: 'Edit quotation',
                      icon: <Pencil className="h-4 w-4" />,
                      onClick: () =>
                        navigate(
                          underwritePaths.quotationEdit(line.slug, row.id),
                        ),
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
        eyebrow={`Underwrite · ${line.label}`}
        title={`${line.label} quotations`}
        description={line.description}
        action={
          <>
            <CompanySwitcher menuLabel="Filter by owner company" />
            {canCreate ? (
              <Button
                onClick={() =>
                  navigate(underwritePaths.quotationCreate(line.slug))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New quotation
              </Button>
            ) : null}
          </>
        }
      />

      <DataTable
        {...tableProps}
        error={tableProps.error ? 'Unable to load quotations' : undefined}
        columns={columns}
        searchPlaceholder="Search quotations..."
        filters={tableFilters(state.filters, [
          {
            key: 'status',
            label: 'Status',
            placeholder: 'All statuses',
            options: STATUS_FILTER_OPTIONS,
          },
        ])}
        emptyMessage={`No ${line.label.toLowerCase()} quotations found`}
      />
    </div>
  );
}

export function UnderwriteQuotationsPage() {
  const line = useUnderwriteLineParam();
  return line ? <QuotationsList key={line.slug} line={line} /> : null;
}
