import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { engagementApi } from '../api';
import { formatDateTime } from '../utils';

export function CommunicationDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const threadQuery = useQuery({
    queryKey: ['engagement', 'communications', 'thread', id],
    queryFn: () => engagementApi.getCommunicationThread(id),
    enabled: Boolean(id),
  });

  const messagesQuery = useQuery({
    queryKey: ['engagement', 'communications', 'messages', id],
    queryFn: () => engagementApi.listCommunicationMessages(id),
    enabled: Boolean(id),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      engagementApi.postCommunicationMessage(id, { body_text: message }),
    onSuccess: () => {
      toast.success('Message sent');
      setMessage('');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'communications', 'messages', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'communications', 'threads'],
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      const thread = threadQuery.data;
      if (thread?.closed_at) {
        return engagementApi.reopenCommunicationThread(id);
      }
      return engagementApi.closeCommunicationThread(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'communications', 'thread', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'communications', 'threads'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title={threadQuery.data?.thread_no ?? 'Communication thread'}
        description={
          threadQuery.data?.subject ?? 'Conversation history and follow-up.'
        }
        action={
          <Button variant="outline" onClick={() => closeMutation.mutate()}>
            {threadQuery.data?.closed_at ? 'Reopen thread' : 'Close thread'}
          </Button>
        }
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(messagesQuery.data ?? []).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4"
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
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Reply</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending}
          >
            Send message
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
