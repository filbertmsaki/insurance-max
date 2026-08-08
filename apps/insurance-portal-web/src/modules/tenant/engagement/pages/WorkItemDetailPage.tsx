import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function WorkItemDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const itemQuery = useQuery({
    queryKey: ['engagement', 'work-item', id],
    queryFn: () => engagementApi.getWorkItem(id),
    enabled: Boolean(id),
  });

  const timelineQuery = useQuery({
    queryKey: ['engagement', 'work-item', id, 'timeline'],
    queryFn: () => engagementApi.getWorkItemTimeline(id),
    enabled: Boolean(id),
  });

  const commentMutation = useMutation({
    mutationFn: () => engagementApi.commentOnWorkItem(id, comment),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'work-item', id, 'timeline'],
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => engagementApi.executeWorkItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'work-item', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'work-item', id, 'timeline'],
      });
    },
  });

  const item = itemQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title={item?.work_item_no ?? 'Work item'}
        description={item?.title ?? 'Operational assignment detail'}
        action={
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending}
          >
            Execute
          </Button>
        }
      />

      {item ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Priority', item.priority],
              ['Status', item.status],
              ['Queue', item.queue_code ?? 'general'],
              ['Due', formatDateTime(item.due_at)],
            ].map(([label, value]) => (
              <Card
                key={label}
                className="rounded-xl border-slate-200 shadow-sm"
              >
                <CardContent className="pt-5">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={statusTone(String(value))}
                    >
                      {value}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <div>{item.description ?? 'No description provided.'}</div>
              <div>
                Source module: {item.source_module ?? item.resource_type}
              </div>
              <div>
                Source record: {item.source_record_id ?? item.resource_id}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Add comment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button
                onClick={() => commentMutation.mutate()}
                disabled={commentMutation.isPending}
              >
                Save comment
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(timelineQuery.data ?? []).map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">
                      {event.event_type}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(event.created_at)}
                    </div>
                  </div>
                  {event.comment ? (
                    <div className="mt-2 text-sm text-slate-700">
                      {event.comment}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
