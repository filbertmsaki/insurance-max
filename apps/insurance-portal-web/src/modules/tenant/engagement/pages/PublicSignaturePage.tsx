import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function PublicSignaturePage() {
  const { token = '' } = useParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  const query = useQuery({
    queryKey: ['public-signature', token],
    queryFn: () => engagementApi.getPublicSignature(token),
    enabled: Boolean(token),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: 'SIGN' | 'DECLINE') =>
      engagementApi.respondPublicSignature(token, {
        decision,
        name,
        decline_reason: declineReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-signature', token] });
    },
  });

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Document Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {query.data ? (
              <>
                <Badge
                  variant="outline"
                  className={statusTone(query.data.request.status)}
                >
                  {query.data.request.status}
                </Badge>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">Signer</div>
                    <div className="text-sm font-medium text-slate-900">
                      {query.data.participant.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Request</div>
                    <div className="text-sm font-medium text-slate-900">
                      {query.data.request.request_no}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Document</div>
                    <div className="text-sm font-medium text-slate-900">
                      {query.data.document?.title ?? 'Document'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Expires</div>
                    <div className="text-sm font-medium text-slate-900">
                      {formatDateTime(query.data.request.expires_at)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-signature-name">Name</Label>
                  <Input
                    id="public-signature-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={query.data.participant.name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-signature-decline">
                    Decline reason
                  </Label>
                  <Textarea
                    id="public-signature-decline"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => respondMutation.mutate('SIGN')}>
                    Sign document
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => respondMutation.mutate('DECLINE')}
                  >
                    Decline
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">
                Signature token not found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
