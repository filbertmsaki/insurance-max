import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunicationThreadRecord } from '@/modules/tenant/engagement/api';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

const THREAD_FILTER_KEYS = ['status'] as const;
type ThreadFilterKey = (typeof THREAD_FILTER_KEYS)[number];

const STATUS_OPTIONS = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Closed', value: 'CLOSED' },
];

export function PortalMessagesPage({ audience }: { audience: PortalAudience }) {
  const basePath = `/${audience}/messages`;

  const { tableProps, state } = useServerTable<
    CommunicationThreadRecord,
    ThreadFilterKey
  >({
    queryKey: ['portal', audience, 'messages'],
    fetcher: (params, signal) =>
      portalApi.pageMessages(audience, params, signal),
    filterKeys: THREAD_FILTER_KEYS,
    defaultSortBy: 'updated_at',
  });

  const columns: Column<CommunicationThreadRecord>[] = [
    {
      key: 'subject',
      header: 'Thread',
      sortable: true,
      cell: (thread) => (
        <div className="space-y-1">
          <Link
            to={`${basePath}/${thread.id}`}
            className="font-medium text-slate-900 hover:text-blue-700"
          >
            {thread.subject}
          </Link>
          <div className="text-xs text-slate-500">{thread.thread_no}</div>
        </div>
      ),
    },
    {
      key: 'thread_type',
      header: 'Type',
      sortable: true,
      cell: (thread) => thread.thread_type,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (thread) => {
        const status = thread.closed_at ? 'CLOSED' : 'OPEN';
        return (
          <Badge variant="outline" className={statusTone(status)}>
            {status}
          </Badge>
        );
      },
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      cell: (thread) => formatDateTime(thread.updated_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer portal"
        title="Messages"
        description="Communication threads shared to this portal account."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Conversation list</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search conversations…"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            ])}
            emptyMessage="No conversations. Threads will appear here when the insurer opens communication with this portal account."
          />
        </CardContent>
      </Card>
    </div>
  );
}
