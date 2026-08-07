import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { engagementApi } from '../api';
import { formatDateTime } from '../utils';

export function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');

  const threadsQuery = useQuery({
    queryKey: ['engagement', 'communications', 'threads'],
    queryFn: engagementApi.listCommunicationThreads,
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
        eyebrow="Phase 17"
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
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thread</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(threadsQuery.data ?? []).map((thread) => (
                <TableRow key={thread.id}>
                  <TableCell>
                    <Link
                      to={`/communications/${thread.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {thread.thread_no}
                    </Link>
                    <div className="text-sm text-slate-500">{thread.subject}</div>
                  </TableCell>
                  <TableCell>{thread.thread_type}</TableCell>
                  <TableCell>
                    {thread.resource_type ?? '-'}
                    {thread.resource_id ? (
                      <div className="text-xs text-slate-500">{thread.resource_id}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDateTime(thread.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
