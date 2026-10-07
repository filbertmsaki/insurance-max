import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, RefreshCw, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { tiramisApi } from '../api';

export function TiramisWebhookDiagnosticsPage() {
  const [environment, setEnvironment] = useState<'test' | 'live'>('live');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ['tiramis', 'portal-webhook', environment];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => tiramisApi.getPortalWebhookDiagnostics(environment),
  });
  const test = useMutation({
    mutationFn: () => tiramisApi.testPortalWebhook(environment),
    onSuccess: (result) => {
      toast[result.success ? 'success' : 'error'](result.message);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Webhook connection test failed.',
      );
    },
  });
  const sync = useMutation({
    mutationFn: () => tiramisApi.syncPortalWebhookCredential(environment),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not sync the portal webhook credential.',
      );
    },
  });

  const copyUrl = async () => {
    if (!data?.webhookUrl) return;
    await navigator.clipboard.writeText(data.webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Webhook"
        description="Inspect the portal callback URL and test authenticated delivery from TIRAMIS."
        action={
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="flex gap-2" role="group" aria-label="TIRAMIS environment">
        {(['test', 'live'] as const).map((item) => (
          <Button
            key={item}
            variant={environment === item ? 'default' : 'outline'}
            onClick={() => setEnvironment(item)}
          >
            {item === 'live' ? 'Live' : 'Test'} environment
          </Button>
        ))}
      </div>

      {isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">
            Could not load webhook diagnostics. Check your TIRAMIS configuration
            access, then refresh.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Portal notification URL
                </CardTitle>
                <Badge variant={data?.configured ? 'success' : 'warning'}>
                  {isLoading
                    ? 'Loading'
                    : data?.configured
                      ? `${environment.toUpperCase()} configured`
                      : 'Not configured'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="break-all rounded-md border bg-slate-50 p-3 font-mono text-sm">
                {isLoading ? 'Loading URL…' : data?.webhookUrl || 'Unavailable'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void copyUrl()}
                  disabled={!data?.webhookUrl}
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? 'Copied' : 'Copy URL'}
                </Button>
                <Button
                  onClick={() => test.mutate()}
                  disabled={test.isPending || !data?.configured}
                >
                  {test.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {test.isPending ? 'Testing callback…' : 'Test from TIRAMIS'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => sync.mutate()}
                  disabled={sync.isPending || !data?.configured}
                >
                  {sync.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {sync.isPending ? 'Syncing key…' : 'Resync webhook key'}
                </Button>
              </div>
              <p className="text-sm text-slate-600">
                The test sends a harmless authenticated ping from TIRAMIS to
                this URL. It does not create a policy or submission and does not
                write a notification receipt.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest test result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {test.data ? (
                <>
                  <p className="flex items-center gap-2">
                    {test.data.success ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <span>{test.data.message}</span>
                  </p>
                  {test.data.httpStatus !== undefined && (
                    <p>HTTP status: {test.data.httpStatus}</p>
                  )}
                  {test.data.requestId && (
                    <p className="break-all font-mono text-xs">
                      Test request ID: {test.data.requestId}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-slate-500">
                  No test has been run in this session.
                </p>
              )}
              <p className="flex items-start gap-2 text-slate-500">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />A 401 points
                to a webhook API key problem. A 403 points to the API client
                scope. A network or timeout error suggests the portal URL is not
                reachable from the TIRAMIS host.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
