import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { complaintsApi } from '../api';
import type { ComplaintRecord } from '../types';
import { complaintTone, formatComplaintDate } from '../utils';

const FILTER_KEYS = ['status', 'priority'] as const;

const toOptions = (values: string[]) =>
  values.map((value) => ({ value, label: value.replace(/_/g, ' ') }));

const STATUS_OPTIONS = toOptions([
  'OPEN',
  'ACKNOWLEDGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'ESCALATED',
  'APPEALED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
]);
const PRIORITY_OPTIONS = toOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export function ComplaintsPage() {
  const navigate = useNavigate();
  const { tableProps, state } = useServerTable<
    ComplaintRecord,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: ['complaints', 'list'],
    fetcher: (params, signal) => complaintsApi.listPage(params, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  const columns: Column<ComplaintRecord>[] = [
    {
      key: 'complaint',
      header: 'Complaint',
      sortable: true,
      cell: (row) => (
        <div>
          <button
            className="font-medium text-slate-900 hover:text-blue-700"
            type="button"
            onClick={() => {
              navigate(`/complaints/${row.id}`);
            }}
          >
            {row.complaint_no}
          </button>
          <div className="text-sm text-slate-500">{row.subject}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      cell: (row) => row.category,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => (
        <Badge variant="outline" className={complaintTone(row.status)}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      cell: (row) => row.priority,
    },
    {
      key: 'due',
      header: 'Resolution Due',
      sortable: true,
      cell: (row) => formatComplaintDate(row.resolution_due_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Complaints"
        title="Complaint Workbench"
        description="Manage acknowledgements, assignments, resolution, escalation, appeals, and customer-visible comments."
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search complaint, category, subject, status"
        filters={tableFilters(state.filters, [
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          { key: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
        ])}
        rowActions={[
          {
            label: 'Open',
            icon: Eye,
            onClick: (row) => navigate(`/complaints/${row.id}`),
          },
        ]}
        showColumnVisibility={false}
      />
    </div>
  );
}
