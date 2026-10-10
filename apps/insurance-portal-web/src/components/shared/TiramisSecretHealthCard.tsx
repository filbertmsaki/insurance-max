import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/** Per-company secrets stored by TIRAMIS. The TIRA client key and certificate
 * passwords are platform-wide (TIRAMIS environment) and are not stored here. */
export type TiramisSecretName = 'portalWebhookApiKey';

export type TiramisSecretStatus =
  | 'MISSING'
  | 'PLAINTEXT'
  | 'OK'
  | 'PREVIOUS_KEY'
  | 'UNREADABLE';

export interface TiramisSecretHealth {
  configurationId: string;
  environment: string;
  companyCode?: string;
  systemCode?: string | null;
  healthy: boolean;
  webhookKeyReissued?: boolean;
  secrets: Array<{
    name: TiramisSecretName;
    label: string;
    status: TiramisSecretStatus;
  }>;
  /** Platform-wide secrets read from the TIRAMIS server environment. */
  systemSecrets?: Array<{
    name: string;
    label: string;
    source: string;
    status: 'OK' | 'MISSING';
  }>;
}

export type TiramisSecretReplacements = Partial<
  Record<TiramisSecretName, string>
>;

const STATUS_BADGE: Record<
  TiramisSecretStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }
> = {
  OK: { label: 'OK', variant: 'success' },
  PREVIOUS_KEY: { label: 'Old key — repair', variant: 'warning' },
  PLAINTEXT: { label: 'Unencrypted — repair', variant: 'warning' },
  MISSING: { label: 'Missing', variant: 'muted' },
  UNREADABLE: { label: 'Unreadable', variant: 'danger' },
};

function errorMessage(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  if (typeof response === 'string') return response;
  return error instanceof Error ? error.message : fallback;
}

/**
 * Shows whether TIRAMIS can still decrypt each stored secret with its
 * current TIRAMIS_SECRET_ENCRYPTION_KEY, and repairs them in one click.
 * When `allowReplacements` is set (platform admins), the portal
 * webhook key can be re-entered here; otherwise it is reissued on repair.
 * Platform-wide TIRA secrets are shown read-only.
 */
export function TiramisSecretHealthCard({
  scopeKey,
  environment,
  fetchHealth,
  repair,
  allowReplacements = false,
}: {
  scopeKey: string;
  environment: 'test' | 'live';
  fetchHealth: () => Promise<TiramisSecretHealth>;
  repair: (
    replacements: TiramisSecretReplacements,
  ) => Promise<TiramisSecretHealth>;
  allowReplacements?: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['tiramis-secret-health', scopeKey, environment];
  const [replacements, setReplacements] = useState<TiramisSecretReplacements>(
    {},
  );

  const health = useQuery({
    queryKey,
    queryFn: fetchHealth,
    retry: false,
  });

  const repairMutation = useMutation({
    mutationFn: () => repair(replacements),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setReplacements({});
      const stillBroken = result.secrets.filter(
        (secret) => secret.status === 'UNREADABLE',
      );
      if (stillBroken.length === 0) {
        toast.success(
          result.webhookKeyReissued
            ? 'Secrets repaired and the webhook key was reissued.'
            : 'Secrets repaired.',
        );
      } else {
        toast.warning(
          `Repaired what could be read. Still unreadable: ${stillBroken
            .map((secret) => secret.label)
            .join(', ')}.`,
        );
      }
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, 'Could not repair TIRAMIS secrets.'));
    },
  });

  const secrets = health.data?.secrets ?? [];
  const systemSecrets = health.data?.systemSecrets ?? [];
  const needsRepair = secrets.some((secret) => secret.status !== 'OK');
  const hasReplacement = Object.values(replacements).some((value) =>
    value?.trim(),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Stored secrets (
            {environment.toUpperCase()})
          </CardTitle>
          <Badge
            variant={
              health.isLoading
                ? 'muted'
                : health.isError
                  ? 'danger'
                  : needsRepair
                    ? 'warning'
                    : 'success'
            }
          >
            {health.isLoading
              ? 'Checking'
              : health.isError
                ? 'Check failed'
                : needsRepair
                  ? 'Needs repair'
                  : 'Healthy'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {health.isError ? (
          <p className="text-red-700">
            {errorMessage(
              health.error,
              'Could not read secret health from TIRAMIS.',
            )}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {secrets.map((secret) => {
              const badge = STATUS_BADGE[secret.status];
              const canReplace =
                allowReplacements &&
                (secret.status === 'UNREADABLE' || secret.status === 'MISSING');

              return (
                <li key={secret.name} className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{secret.label}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  {canReplace && (
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder={`Re-enter the ${secret.label.toLowerCase()}`}
                      value={
                        replacements[
                          secret.name as keyof TiramisSecretReplacements
                        ] ?? ''
                      }
                      onChange={(event) =>
                        setReplacements((current) => ({
                          ...current,
                          [secret.name]: event.target.value,
                        }))
                      }
                    />
                  )}
                  {!allowReplacements && secret.status === 'UNREADABLE' && (
                    <p className="text-xs text-slate-500">
                      A platform administrator must re-enter this value.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!health.isError && systemSecrets.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">
              Platform-wide TIRA secrets (TIRAMIS environment, read-only)
            </p>
            <ul className="divide-y rounded-md border">
              {systemSecrets.map((secret) => (
                <li
                  key={secret.name}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <span>
                    {secret.label}{' '}
                    <code className="text-xs text-slate-500">
                      {secret.source}
                    </code>
                  </span>
                  <Badge
                    variant={secret.status === 'OK' ? 'success' : 'danger'}
                  >
                    {secret.status === 'OK' ? 'OK' : 'Missing'}
                  </Badge>
                </li>
              ))}
            </ul>
            {systemSecrets.some((secret) => secret.status !== 'OK') && (
              <p className="text-xs text-slate-500">
                Missing platform secrets must be set in the TIRAMIS server
                environment; they cannot be entered per company.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => repairMutation.mutate()}
            disabled={
              repairMutation.isPending ||
              health.isLoading ||
              health.isError ||
              (!needsRepair && !hasReplacement)
            }
          >
            {repairMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="mr-2 h-4 w-4" />
            )}
            {repairMutation.isPending ? 'Repairing…' : 'Repair secrets'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Re-check
          </Button>
        </div>
        <p className="text-slate-600">
          Use this after TIRAMIS_SECRET_ENCRYPTION_KEY changes. Repair
          re-encrypts every secret TIRAMIS can still read with its current key
          and reissues the portal webhook key. Values it can no longer read are
          left untouched until they are re-entered.
        </p>
      </CardContent>
    </Card>
  );
}
