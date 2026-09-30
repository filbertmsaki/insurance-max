import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { engagementApi } from '../api';
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

export function WorkItemsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('all');

  const workItemsQuery = useQuery({
    queryKey: ['engagement', 'work-items', view],
    queryFn: () => engagementApi.listWorkItems(view),
  });

  const queuesQuery = useQuery({
    queryKey: ['engagement', 'work-item-queues'],
    queryFn: engagementApi.listWorkItemQueues,
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => engagementApi.claimWorkItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement', 'work-items'] });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'work-item-queues'],
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => engagementApi.startWorkItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement', 'work-items'] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => engagementApi.executeWorkItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement', 'work-items'] });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'work-item-queues'],
      });
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
            <Select value={view} onValueChange={setView}>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work item</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(workItemsQuery.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      to={`/work-items/${item.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {item.work_item_no ?? item.title}
                    </Link>
                    <div className="text-sm text-slate-500">{item.title}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusTone(item.priority)}
                    >
                      {item.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusTone(item.status)}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(item.due_at)}</TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => claimMutation.mutate(item.id)}
                    >
                      Claim
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startMutation.mutate(item.id)}
                    >
                      Start
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => executeMutation.mutate(item.id)}
                    >
                      Execute
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
