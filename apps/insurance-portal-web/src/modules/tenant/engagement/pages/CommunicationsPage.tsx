import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { engagementApi, type CommunicationThreadRecord } from '../api';
import { formatDateTime } from '../utils';

const THREAD_FILTER_KEYS = ['state'] as const;
type ThreadFilterKey = (typeof THREAD_FILTER_KEYS)[number];

const THREAD_STATE_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

const columns: Column<CommunicationThreadRecord>[] = [
  {
    key: 'thread_no',
    header: 'Thread',
    sortable: true,
    cell: (thread) => (
      <>
        <Link
          to={`/apps/communications/${thread.id}`}
          className="font-medium text-slate-900 hover:text-blue-700"
        >
          {thread.thread_no}
        </Link>
        <div className="text-sm text-slate-500">{thread.subject}</div>
      </>
    ),
  },
  {
    key: 'thread_type',
    header: 'Type',
    sortable: true,
    cell: (thread) => thread.thread_type,
  },
  {
    key: 'resource_type',
    header: 'Resource',
    sortable: true,
    hideOnMobile: true,
    cell: (thread) => (
      <>
        {thread.resource_type ?? '-'}
        {thread.resource_id ? (
          <div className="text-xs text-slate-500">{thread.resource_id}</div>
        ) : null}
      </>
    ),
  },
  {
    key: 'updated_at',
    header: 'Last activity',
    sortable: true,
    cell: (thread) => formatDateTime(thread.updated_at),
  },
];

export function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');

  const { tableProps, state } = useServerTable<
    CommunicationThreadRecord,
    ThreadFilterKey
  >({
    queryKey: ['engagement', 'communications', 'threads'],
    fetcher: (params, signal) =>
      engagementApi.pageCommunicationThreads(params, signal),
    filterKeys: THREAD_FILTER_KEYS,
    defaultSortBy: 'updated_at',
  });

  const createMutation = useMutation({
    mutationFn: () => engagementApi.createCommunicationThread({ subject }),
    onSuccess: () => {
      toast.success('Communication thread created');
      setSubject('');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'communications', 'threads'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Communications"
        description="Threaded communication history with controlled follow-up from internal teams."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">New thread</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="thread-subject">Subject</Label>
            <Input
              id="thread-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            Create thread
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="h-4 w-4 text-blue-600" />
            Threads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search threads…"
            filters={tableFilters(state.filters, [
              { key: 'state', label: 'State', options: THREAD_STATE_OPTIONS },
            ])}
            emptyMessage="No communication threads yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
