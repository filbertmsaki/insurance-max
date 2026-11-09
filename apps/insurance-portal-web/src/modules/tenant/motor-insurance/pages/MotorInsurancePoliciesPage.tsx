import { useNavigate } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ActionMenu } from '@/components/shared/ActionMenu';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { formatDate, formatMoney } from '@/components/shared/detailFormat';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { PolicyStatusBadge } from '@/modules/tenant/policies/components/PolicyStatusBadge';
import {
  motorInsuranceApi,
  motorInsuranceKeys,
  type MotorInsurancePolicy,
} from '../api';
import { MotorTypeBadge } from '../components/MotorTypeBadge';
import { motorInsurancePaths } from '../paths';

const POLICY_STATUS_OPTIONS = [
  'COVER_NOTE_ISSUED',
  'ACTIVE',
  'ENDORSED',
  'CANCELLED',
  'EXPIRED',
  'LAPSED',
] as const;

const FILTER_KEYS = ['policy_status', 'type'] as const;

/**
 * Motor Insurance policy register. Type comes from the stored
 * `business_line`, never from the vehicle count: a fleet reduced to one
 * vehicle is still a fleet.
 */
export function MotorInsurancePoliciesPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    MotorInsurancePolicy,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: motorInsuranceKeys.policies(),
    fetcher: (params, signal) =>
      motorInsuranceApi.getPolicies(
        params as Parameters<typeof motorInsuranceApi.getPolicies>[0],
        signal,
      ),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });

  const columns: Column<MotorInsurancePolicy>[] = [
    {
      key: 'policy_no',
      header: 'Policy No.',
      sortable: true,
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.policy_no}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) =>
        row.customer ? getCustomerDisplayName(row.customer) : row.customer_id,
    },
    {
      key: 'business_line',
      header: 'Type',
      cell: (row) =>
        row.business_line ? (
          <MotorTypeBadge fleet={row.business_line === 'FLEET'} />
        ) : (
          'N/A'
        ),
    },
    {
      key: 'cover_note_no',
      header: 'Cover Note',
      hideOnMobile: true,
      cell: (row) => row.cover_note_no || 'N/A',
    },
    {
      key: 'product',
      header: 'Product',
      hideOnMobile: true,
      cell: (row) => row.product?.product_name ?? row.product_id,
    },
    {
      key: 'start_date',
      header: 'Cover Period',
      sortable: true,
      hideOnMobile: true,
      cell: (row) =>
        `${formatDate(row.start_date)} – ${formatDate(row.end_date)}`,
    },
    {
      key: 'premium',
      header: 'Premium',
      className: 'text-right',
      cell: (row) => (
        <span className="tabular-nums">
          {formatMoney(Number(row.total_premium), row.currency)}
        </span>
      ),
    },
    {
      key: 'policy_status',
      header: 'Status',
      sortable: true,
      cell: (row) => <PolicyStatusBadge status={row.policy_status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <div className="flex justify-end">
          <ActionMenu
            ariaLabel={`Actions for policy ${row.policy_no}`}
            items={[
              {
                label: 'View policy',
                icon: <Eye className="h-4 w-4" />,
                onClick: () =>
                  navigate(motorInsurancePaths.policyDetail(row.id)),
              },
              {
                label: 'Download policy schedule PDF',
                icon: <Download className="h-4 w-4" />,
                onClick: () =>
                  void downloadPdf(
                    `/tenant/policies/${row.id}/schedule/download`,
                    documentFilename(row.policy_no, '-schedule'),
                  ),
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
        eyebrow="Motor Insurance"
        title="Policies"
        description="Single Motor and Fleet policies in one register."
        action={<CompanySwitcher menuLabel="Filter by owner company" />}
      />

      <DataTable
        {...tableProps}
        error={tableProps.error ? 'Unable to load policies' : undefined}
        columns={columns}
        searchPlaceholder="Search policies..."
        filters={tableFilters(state.filters, [
          {
            key: 'type',
            label: 'Type',
            placeholder: 'All types',
            options: [
              { value: 'single', label: 'Single Motor' },
              { value: 'fleet', label: 'Fleet' },
            ],
          },
          {
            key: 'policy_status',
            label: 'Status',
            placeholder: 'All statuses',
            options: POLICY_STATUS_OPTIONS.map((value) => ({
              value,
              label: value.replace(/_/g, ' '),
            })),
          },
        ])}
        emptyMessage="No motor policies found"
      />
    </div>
  );
}
