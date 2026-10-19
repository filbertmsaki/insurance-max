import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PublicLayout } from '@/modules/public/PublicShell';
import { usePageMeta } from '@/modules/public/usePageMeta';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function PublicSignaturePage() {
  usePageMeta(
    'Document signature | Insurance Max',
    'Review and respond to your document signature request.',
    true,
  );
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
    <PublicLayout>
      <main className="public-section">
        <div className="public-container public-document">
          <Card className="rounded-sm border-slate-200 shadow-none">
            <CardHeader>
              <h1>Document signature</h1>
            </CardHeader>
            <CardContent className="space-y-4">
              {respondMutation.isError && (
                <p role="alert">
                  Your response could not be saved. Please try again.
                </p>
              )}
              {respondMutation.isSuccess && (
                <p role="status">Your response has been recorded.</p>
              )}
              {query.isLoading ? (
                <p role="status">Loading signature request…</p>
              ) : query.isError ? (
                <div role="alert">
                  <p>
                    We could not load this request. Check your link or try
                    again.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => void query.refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : query.data ? (
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
                    <Button
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate('SIGN')}
                    >
                      Sign document
                    </Button>
                    <Button
                      variant="outline"
                      disabled={respondMutation.isPending}
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
      </main>
    </PublicLayout>
  );
}
