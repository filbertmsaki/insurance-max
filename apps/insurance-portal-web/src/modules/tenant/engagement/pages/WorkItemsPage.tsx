import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Hand, Play, Zap } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { engagementApi, type WorkItemRecord } from '../api';
import { formatDateTime, statusTone } from '../utils';

const VIEWS = [
  { value: 'all', label: 'All open work' },
  { value: 'my', label: 'My work' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'team', label: 'My team' },
  { value: 'due-today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'high-priority', label: 'High priority' },
  { value: 'completed', label: 'Completed' },
  { value: 'delegated', label: 'Delegated' },
];

const WORK_ITEM_FILTER_KEYS = ['view', 'status', 'priority'] as const;
type WorkItemFilterKey = (typeof WORK_ITEM_FILTER_KEYS)[number];

const toOptions = (values: string[]) =>
  values.map((value) => ({ label: value, value }));
const STATUS_OPTIONS = toOptions([
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]);
const PRIORITY_OPTIONS = toOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const columns: Column<WorkItemRecord>[] = [
  {
    key: 'work_item_no',
    header: 'Work item',
    sortable: true,
    cell: (item) => (
      <>
        <Link
          to={`/apps/work-items/${item.id}`}
          className="font-medium text-slate-900 hover:text-blue-700"
        >
          {item.work_item_no ?? item.title}
        </Link>
        <div className="text-sm text-slate-500">{item.title}</div>
      </>
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    sortable: true,
    cell: (item) => (
      <Badge variant="outline" className={statusTone(item.priority)}>
        {item.priority}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (item) => (
      <Badge variant="outline" className={statusTone(item.status)}>
        {item.status}
      </Badge>
    ),
  },
  {
    key: 'due_at',
    header: 'Due',
    sortable: true,
    cell: (item) => formatDateTime(item.due_at),
  },
];

export function WorkItemsPage() {
  const queryClient = useQueryClient();

  const { tableProps, state } = useServerTable<
    WorkItemRecord,
    WorkItemFilterKey
  >({
    queryKey: ['engagement', 'work-items'],
    fetcher: (params, signal) => engagementApi.pageWorkItems(params, signal),
    filterKeys: WORK_ITEM_FILTER_KEYS,
    defaultSortBy: 'due_at',
    defaultSortOrder: 'ASC',
  });
  const view = state.filters.view || 'all';

  const queuesQuery = useQuery({
    queryKey: ['engagement', 'work-item-queues'],
    queryFn: engagementApi.listWorkItemQueues,
  });

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['engagement', 'work-items'] });
  const invalidateQueues = () =>
    queryClient.invalidateQueries({
      queryKey: ['engagement', 'work-item-queues'],
    });

  const claimMutation = useMutation({
    mutationFn: (id: string) => engagementApi.claimWorkItem(id),
    onSuccess: () => {
      invalidateList();
      invalidateQueues();
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => engagementApi.startWorkItem(id),
    onSuccess: invalidateList,
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => engagementApi.executeWorkItem(id),
    onSuccess: () => {
      invalidateList();
      invalidateQueues();
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Work Items"
        description="Operational task projections with queue views, timelines, and direct execution actions."
        action={
          <div className="w-[220px]">
            <Select
              value={view}
              onValueChange={(value) =>
                state.setFilter('view', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(queuesQuery.data ?? []).slice(0, 3).map((queue) => (
          <Card
            key={queue.queue_code}
            className="rounded-xl border-slate-200 shadow-sm"
          >
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">
                {queue.queue_code}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {queue.open_count + queue.in_progress_count}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {queue.open_count} open, {queue.in_progress_count} in progress
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search work items…"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: STATUS_OPTIONS },
              { key: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
            ])}
            rowActions={[
              {
                label: 'Claim',
                icon: Hand,
                onClick: (item) => claimMutation.mutate(item.id),
              },
              {
                label: 'Start',
                icon: Play,
                onClick: (item) => startMutation.mutate(item.id),
              },
              {
                label: 'Execute',
                icon: Zap,
                onClick: (item) => executeMutation.mutate(item.id),
              },
            ]}
            emptyMessage="No work items in this view"
          />
        </CardContent>
      </Card>
    </div>
  );
}
