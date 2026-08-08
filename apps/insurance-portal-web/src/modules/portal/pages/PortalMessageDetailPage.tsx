import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

export function PortalMessageDetailPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const threadQuery = useQuery({
    queryKey: ['portal', audience, 'messages', 'thread', id],
    queryFn: () => portalApi.getMessageThread(audience, id),
    enabled: Boolean(id),
  });
  const messagesQuery = useQuery({
    queryKey: ['portal', audience, 'messages', 'entries', id],
    queryFn: () => portalApi.listMessageEntries(audience, id),
    enabled: Boolean(id),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      portalApi.postMessage(audience, id, { body_text: message }),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({
        queryKey: ['portal', audience, 'messages', 'entries', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['portal', audience, 'messages'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title={threadQuery.data?.subject ?? 'Conversation'}
        description={
          threadQuery.data?.thread_no ?? 'Portal communication history.'
        }
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messagesQuery.isError ? (
            <ErrorState
              description="Thread messages could not be loaded."
              onRetry={() => messagesQuery.refetch()}
            />
          ) : (
            (messagesQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900">
                    {item.direction}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(item.created_at)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  {item.body_text}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Reply</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {threadQuery.isError ? (
            <ErrorState
              description="Thread detail could not be loaded."
              onRetry={() => threadQuery.refetch()}
            />
          ) : (
            <>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={Boolean(threadQuery.data?.closed_at)}
                placeholder={
                  threadQuery.data?.closed_at
                    ? 'This thread is closed.'
                    : 'Write your reply'
                }
              />
              <Button
                onClick={() => postMutation.mutate()}
                disabled={
                  postMutation.isPending ||
                  Boolean(threadQuery.data?.closed_at) ||
                  !message.trim()
                }
              >
                Send reply
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
