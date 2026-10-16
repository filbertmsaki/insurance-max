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
import { formatDate, formatMoney } from '@/components/shared/detailFormat';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { PolicyStatusBadge } from '@/modules/tenant/policies/components/PolicyStatusBadge';
import type { PolicyRecord } from '@/modules/tenant/policies/types';
import { underwriteApi } from '../api';
import { underwriteKeys, useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';
import {
  downloadPdf,
  documentFilename,
} from '@/modules/shared/documents/download-pdf';

const POLICY_STATUS_OPTIONS = [
  'COVER_NOTE_ISSUED',
  'ACTIVE',
  'ENDORSED',
  'CANCELLED',
  'EXPIRED',
  'LAPSED',
] as const;

const STATUS_FILTER_OPTIONS = POLICY_STATUS_OPTIONS.map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));
const FILTER_KEYS = ['policy_status'] as const;

function PoliciesList({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    PolicyRecord,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: underwriteKeys.policies(line.slug),
    fetcher: (params, signal) =>
      underwriteApi.getPolicies(line.slug, params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });

  const columns: Column<PolicyRecord>[] = [
    {
      key: 'policy_no',
      header: 'Policy No.',
      sortable: true,
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.policy_no}</span>
      ),
    },
    {
      key: 'cover_note_no',
      header: 'Cover Note',
      hideOnMobile: true,
      cell: (row) => row.cover_note_no || 'N/A',
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) =>
        row.customer ? getCustomerDisplayName(row.customer) : row.customer_id,
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
                label: 'Download policy schedule PDF',
                icon: <Download className="h-4 w-4" />,
                onClick: () =>
                  void downloadPdf(
                    `/tenant/policies/${row.id}/schedule/download`,
                    documentFilename(row.policy_no, '-schedule'),
                  ),
              },
              {
                label: 'View policy',
                icon: <Eye className="h-4 w-4" />,
                onClick: () =>
                  navigate(underwritePaths.policyDetail(line.slug, row.id)),
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
        eyebrow={`Underwrite · ${line.label}`}
        title={`${line.label} policies`}
        description={line.description}
      />

      <DataTable
        {...tableProps}
        error={tableProps.error ? 'Unable to load policies' : undefined}
        columns={columns}
        searchPlaceholder="Search policies..."
        filters={tableFilters(state.filters, [
          {
            key: 'policy_status',
            label: 'Status',
            placeholder: 'All statuses',
            options: STATUS_FILTER_OPTIONS,
          },
        ])}
        emptyMessage={`No ${line.label.toLowerCase()} policies found`}
      />
    </div>
  );
}

export function UnderwritePoliciesPage() {
  const line = useUnderwriteLineParam();
  return line ? <PoliciesList key={line.slug} line={line} /> : null;
}
