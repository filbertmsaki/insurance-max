import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function SignatureRequestDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState('No longer required');
  const [issuedTokens, setIssuedTokens] = useState<
    Array<{ participant_id: string; name: string; token: string }>
  >([]);

  const requestQuery = useQuery({
    queryKey: ['engagement', 'signature-request', id],
    queryFn: () => engagementApi.getSignatureRequest(id),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['engagement', 'signature-request', id],
    });
    queryClient.invalidateQueries({
      queryKey: ['engagement', 'signature-requests'],
    });
  };

  const sendMutation = useMutation({
    mutationFn: () => engagementApi.sendSignatureRequest(id),
    onSuccess: (data) => {
      setIssuedTokens(data.issued_tokens);
      toast.success('Signature request sent');
      refresh();
    },
  });

  const remindMutation = useMutation({
    mutationFn: () => engagementApi.remindSignatureRequest(id),
    onSuccess: refresh,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => engagementApi.reconcileSignatureRequest(id),
    onSuccess: refresh,
  });

  const cancelMutation = useMutation({
    mutationFn: () => engagementApi.cancelSignatureRequest(id, cancelReason),
    onSuccess: refresh,
  });

  const request = requestQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title={request?.request_no ?? 'Signature request'}
        description="Participants, public signing tokens, and request events."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => sendMutation.mutate()}>
              Send
            </Button>
            <Button variant="outline" onClick={() => remindMutation.mutate()}>
              Remind
            </Button>
            <Button
              variant="outline"
              onClick={() => reconcileMutation.mutate()}
            >
              Reconcile
            </Button>
          </div>
        }
      />

      {request ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Status', request.status],
              ['Provider', request.signature_provider],
              ['Created', formatDateTime(request.created_at)],
              ['Expires', formatDateTime(request.expires_at)],
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
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(request.participants ?? []).map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {participant.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {participant.email ??
                          participant.phone ??
                          participant.participant_type}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusTone(participant.status)}
                    >
                      {participant.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {issuedTokens.length ? (
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Public signing links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {issuedTokens.map((item) => (
                  <div
                    key={item.participant_id}
                    className="rounded-lg border border-slate-200 p-4 text-sm"
                  >
                    <div className="font-medium text-slate-900">
                      {item.name}
                    </div>
                    <div className="mt-1 break-all text-slate-600">
                      {window.location.origin}/signatures/respond/{item.token}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cancel request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Reason</Label>
                <Input
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => cancelMutation.mutate()}>
                Cancel request
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
