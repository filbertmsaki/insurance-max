import { useNavigate } from 'react-router-dom';
import { Download, Eye, Pencil, Plus } from 'lucide-react';
import {
  UnderwriteAction,
  UnderwriteLine,
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
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';
import { QuotationStatusBadge } from '@/modules/tenant/quotations/components/QuotationStatusBadge';
import { TiraStatusBadge } from '@/modules/tenant/quotations/components/TiraStatusBadge';
import { PaymentStatusBadge } from '@/modules/tenant/quotations/components/PaymentStatusBadge';
import type { QuotationListItem } from '@/modules/tenant/quotations/types';
import { formatCoverPeriod } from '@/modules/tenant/quotations/utils/coverPeriod';
import { canEditQuotation } from '@/modules/tenant/quotations/utils/quotation-editability';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { MotorTypeBadge } from '../components/MotorTypeBadge';
import {
  MotorQuotationMobileList,
  type MotorTypeChip,
} from '../components/MotorQuotationMobileList';
import { motorInsurancePaths } from '../paths';

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

const FILTER_KEYS = [
  'status',
  'type',
  'approval_status',
  'payment_status',
  'tira_status',
] as const;

const TYPE_FILTER_OPTIONS = [
  { value: 'single', label: 'Single Motor' },
  { value: 'fleet', label: 'Fleet' },
];

function isFleetRow(row: QuotationListItem) {
  return row.quotation_flow === 'MOTOR_FLEET';
}

/**
 * Motor Insurance quotation register: Single Motor and Fleet together.
 * The backend only returns the lines the user holds the line gate for, with
 * the usual data scope applied.
 */
export function MotorInsuranceQuotationsPage() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { tableProps, state, rows, total, totalPages, query } = useServerTable<
    QuotationListItem,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: motorInsuranceKeys.quotations(),
    fetcher: (params, signal) =>
      motorInsuranceApi.getQuotations(
        params as Parameters<typeof motorInsuranceApi.getQuotations>[0],
        signal,
      ),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });

  const can = (line: UnderwriteLine, action: 'create' | 'edit') =>
    hasPermission(
      underwritePermission(
        line,
        action === 'create' ? UnderwriteAction.CREATE : UnderwriteAction.EDIT,
      ),
    ) &&
    hasPermission(
      action === 'create' ? 'quotations:create' : 'quotations:update',
    );

  const canCreateAny =
    can(UnderwriteLine.MOTOR, 'create') || can(UnderwriteLine.FLEET, 'create');

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
    {
      key: 'quotation_flow',
      header: 'Type',
      cell: (row) => <MotorTypeBadge fleet={isFleetRow(row)} />,
    },
    {
      key: 'vehicle_registration_number',
      header: 'Reg No. / Chassis / Fleet ID',
      hideOnMobile: true,
      cell: (row) =>
        (isFleetRow(row)
          ? row.fleet_id
          : row.vehicle_registration_number || row.vehicle_chassis_number) ||
        'N/A',
    },
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
          {Number.isFinite(row.total_premium_including_tax)
            ? formatMoney(row.total_premium_including_tax, row.currency_code)
            : '?'}
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
      key: 'payment_status',
      header: 'Payment',
      hideOnMobile: true,
      cell: (row) => <PaymentStatusBadge status={row.payment_status} />,
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
      cell: (row) => {
        const line = isFleetRow(row)
          ? UnderwriteLine.FLEET
          : UnderwriteLine.MOTOR;
        return (
          <div className="flex justify-end">
            <ActionMenu
              ariaLabel={`Actions for quotation ${row.quotation_no}`}
              items={[
                {
                  label: 'View quotation',
                  icon: <Eye className="h-4 w-4" />,
                  onClick: () =>
                    navigate(motorInsurancePaths.quotationDetail(row.id)),
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
                ...(can(line, 'edit') &&
                !row.source_policy_transaction_id &&
                canEditQuotation(row)
                  ? [
                      {
                        label: 'Edit quotation',
                        icon: <Pencil className="h-4 w-4" />,
                        onClick: () =>
                          navigate(motorInsurancePaths.quotationEdit(row.id)),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        );
      },
    },
  ];

  const filters = tableFilters(state.filters, [
    {
      key: 'type',
      label: 'Type',
      placeholder: 'All types',
      options: TYPE_FILTER_OPTIONS,
    },
    {
      key: 'status',
      label: 'Quotation status',
      placeholder: 'All quotation statuses',
      options: STATUS_OPTIONS.map((value) => ({
        value,
        label: value.replace(/_/g, ' '),
      })),
    },
    ...(
      [
        [
          'approval_status',
          'Approval',
          [
            'NOT_REQUIRED',
            'NOT_SUBMITTED',
            'PENDING',
            'APPROVED',
            'CHANGES_REQUESTED',
            'REJECTED',
            'CANCELLED',
          ],
        ],
        [
          'payment_status',
          'Payment',
          [
            'NOT_REQUIRED',
            'NOT_INITIATED',
            'REQUESTED',
            'PROCESSING',
            'PARTIALLY_PAID',
            'PAID',
            'FAILED',
            'EXPIRED',
            'CANCELLED',
            'REFUNDED',
          ],
        ],
        [
          'tira_status',
          'TIRA',
          [
            'NOT_SUBMITTED',
            'SUBMITTING',
            'SUBMITTED',
            'PROCESSING',
            'SUCCESS',
            'ENDORSED',
            'CANCELLED',
            'REJECTED',
            'FAILED',
          ],
        ],
      ] as const
    ).map(([key, label, values]) => ({
      key,
      label,
      placeholder: `Any ${label} status`,
      options: values.map((value) => ({
        value,
        label: value.replace(/_/g, ' '),
      })),
    })),
  ]);

  return (
    <div>
      {/* Phone layout (<768px); tablet/desktop keep the header + table below. */}
      <MotorQuotationMobileList
        rows={rows}
        total={total}
        loading={tableProps.loading}
        isFetching={tableProps.isFetching}
        error={tableProps.error ? 'Unable to load quotations' : undefined}
        onRetry={tableProps.onRetry}
        onRefresh={() => query.refetch()}
        search={state.search ?? ''}
        onSearchChange={state.setSearch}
        type={(state.filters.type ?? '') as MotorTypeChip}
        onTypeChange={(value) => state.setFilter('type', value)}
        sortBy={state.sortBy}
        sortOrder={state.sortOrder}
        onSortChange={state.setSort}
        filters={filters.filter((filter) => filter.key !== 'type')}
        onFilterChange={tableProps.onFilterChange}
        page={state.page}
        totalPages={totalPages}
        onPageChange={state.setPage}
        onOpen={(row) => navigate(motorInsurancePaths.quotationDetail(row.id))}
        onCreate={
          canCreateAny
            ? () => navigate(motorInsurancePaths.quotationCreate())
            : undefined
        }
        sheetExtras={<CompanySwitcher menuLabel="Filter by owner company" />}
      />

      <div className="max-md:hidden">
        <PageHeader
          eyebrow="Motor Insurance"
          title="Quotations"
          description="Single Motor and Fleet quotations in one register."
          action={
            <>
              <CompanySwitcher menuLabel="Filter by owner company" />
              {canCreateAny ? (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    navigate(motorInsurancePaths.quotationCreate())
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Motor Quotation
                </Button>
              ) : null}
            </>
          }
        />

        <DataTable
          {...tableProps}
          error={tableProps.error ? 'Unable to load quotations' : undefined}
          columns={columns}
          searchPlaceholder="Search by quotation no., customer..."
          filters={filters}
          emptyMessage="No motor quotations found"
        />
      </div>
    </div>
  );
}
