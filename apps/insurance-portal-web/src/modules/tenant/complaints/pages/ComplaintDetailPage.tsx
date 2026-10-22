import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, MessageSquarePlus, UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { complaintsApi } from '../api';
import { complaintTone, formatComplaintDate } from '../utils';

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{value || '-'}</div>
    </div>
  );
}

export function ComplaintDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');

  const complaintQuery = useQuery({
    queryKey: ['complaints', id],
    queryFn: () => complaintsApi.get(id!),
    enabled: Boolean(id),
  });
  const commentsQuery = useQuery({
    queryKey: ['complaints', id, 'comments'],
    queryFn: () => complaintsApi.comments(id!),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['complaints'] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: () => complaintsApi.acknowledge(id!),
    onSuccess: invalidate,
  });
  const assignMutation = useMutation({
    mutationFn: () => complaintsApi.assign(id!, assignee),
    onSuccess: invalidate,
  });
  const commentMutation = useMutation({
    mutationFn: () => complaintsApi.addComment(id!, note, true),
    onSuccess: () => {
      setNote('');
      invalidate();
    },
  });
  const decisionMutation = useMutation({
    mutationFn: (
      action: 'resolve' | 'escalate' | 'close' | 'reopen' | 'cancel' | 'appeal',
    ) => complaintsApi.decide(id!, action, note || `Complaint ${action}`),
    onSuccess: invalidate,
  });

  const complaint = complaintQuery.data;
  if (complaintQuery.isLoading || !complaint) {
    return <Skeleton className="h-[640px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Complaints"
        title={complaint.complaint_no}
        description={complaint.subject}
        action={
          <Button asChild variant="outline">
            <Link to="/apps/complaints">Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Complaint Profile</CardTitle>
              <Badge
                variant="outline"
                className={complaintTone(complaint.status)}
              >
                {complaint.status}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Detail label="Category" value={complaint.category} />
              <Detail label="Priority" value={complaint.priority} />
              <Detail label="Channel" value={complaint.reported_channel} />
              <Detail
                label="Acknowledgement Due"
                value={formatComplaintDate(complaint.acknowledgement_due_at)}
              />
              <Detail
                label="Resolution Due"
                value={formatComplaintDate(complaint.resolution_due_at)}
              />
              <Detail
                label="Customer Acceptance"
                value={complaint.customer_acceptance_status}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolution Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>{complaint.description}</p>
              <Detail label="Resolution" value={complaint.resolution} />
              <Detail label="Root Cause" value={complaint.root_cause} />
              <Detail
                label="Corrective Action"
                value={complaint.corrective_action}
              />
              <Detail
                label="Preventive Action"
                value={complaint.preventive_action}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(commentsQuery.data ?? []).map((comment) => (
                <div key={comment.id} className="border-b pb-3 last:border-b-0">
                  <div className="text-sm text-slate-700">{comment.body}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatComplaintDate(comment.created_at)} ·{' '}
                    {comment.is_customer_visible
                      ? 'Customer visible'
                      : 'Internal'}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => acknowledgeMutation.mutate()}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Acknowledge
              </Button>
              <Input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                placeholder="Assigned user ID"
              />
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={!assignee}
                onClick={() => assignMutation.mutate()}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign
              </Button>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Comment or decision reason"
              />
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={!note}
                onClick={() => commentMutation.mutate()}
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Add customer-visible comment
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    'resolve',
                    'escalate',
                    'close',
                    'reopen',
                    'cancel',
                    'appeal',
                  ] as const
                ).map((action) => (
                  <Button
                    key={action}
                    variant="ghost"
                    onClick={() => decisionMutation.mutate(action)}
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
