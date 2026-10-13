import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  type Column,
} from '@/components/data-table';
import { TiramisStatusBadge } from '../components/TiramisStatusBadge';
import { TiramisTextFilter } from '../components/TiramisTextFilter';
import { useTenantSubmissionsTable } from '../hooks';
import type { TiramisSubmissionRecord } from '../types';
import { TIRAMIS_TRACKING_STATUS_OPTIONS } from '../utils';

const columns: Column<TiramisSubmissionRecord>[] = [
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <TiramisStatusBadge status={row.status} />,
  },
  {
    key: 'quotation',
    header: 'Quotation',
    cell: (row) =>
      row.quotation?.quotation_no ??
      row.quotation_id ??
      row.business_reference ??
      ' - ',
  },
  {
    key: 'requestId',
    header: 'Request ID',
    cell: (row) => row.tiramis_request_id ?? ' - ',
  },
  {
    key: 'businessReference',
    header: 'Business Ref',
    hideOnMobile: true,
    cell: (row) => row.business_reference ?? ' - ',
  },
  { key: 'type', header: 'Type', cell: (row) => row.request_type ?? ' - ' },
  {
    key: 'source',
    header: 'Source',
    hideOnMobile: true,
    cell: (row) => row.source_module ?? ' - ',
  },
];

export function TiramisSubmissionsPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useTenantSubmissionsTable({
    sourceModule: 'quotations',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Submissions"
        description="Monitor quotation submissions sent to TIRAMIS"
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search submissions"
        filters={tableFilters(state.filters, [
          {
            key: 'status',
            label: 'Status',
            options: TIRAMIS_TRACKING_STATUS_OPTIONS,
          },
        ])}
        toolbarActions={
          <>
            <TiramisTextFilter
              value={state.filters.request_id ?? ''}
              onChange={(value) => state.setFilter('request_id', value)}
              placeholder="Request ID"
            />
            <TiramisTextFilter
              value={state.filters.business_reference ?? ''}
              onChange={(value) => state.setFilter('business_reference', value)}
              placeholder="Business reference"
            />
          </>
        }
        rowActions={[
          {
            label: 'View',
            icon: Eye,
            onClick: (row) => navigate(`/tiramis/submissions/${row.id}`),
          },
        ]}
        emptyMessage="No TIRAMIS submissions yet"
      />
    </div>
  );
}
