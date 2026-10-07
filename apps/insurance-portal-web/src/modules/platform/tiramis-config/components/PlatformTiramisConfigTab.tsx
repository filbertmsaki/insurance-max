import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  platformTiramisConfigApi,
  type PlatformTiramisConfiguration,
} from '../api/tiramis-config';

const schema = z.object({
  company_code: z.string().min(1, 'Required').max(30),
  insurer_company_code: z.string().max(30).optional().or(z.literal('')),
  client_code: z.string().max(60).optional().or(z.literal('')),
  client_key: z.string().max(500).optional().or(z.literal('')),
  system_code: z.string().min(1, 'Required').max(100),
  system_name: z.string().max(150).optional().or(z.literal('')),
  base_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  source_service: z.string().max(100).optional().or(z.literal('')),
  callback_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  tiramis_service_api_key: z.string().max(500).optional().or(z.literal('')),
  allow_expired_certificates: z.boolean().optional(),
  use_as_target_environment: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

type ApiErrorLike = {
  response?: { data?: { error?: { message?: string }; message?: string } };
};

function getApiErrorMessage(error: ApiErrorLike | Error): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  return error.response?.data?.error?.message ?? error.response?.data?.message;
}

function buildDefaultValues(
  environment: 'test' | 'live',
  config?: PlatformTiramisConfiguration,
): FormValues {
  return {
    company_code: config?.companyCode ?? '',
    insurer_company_code: config?.insurerCompanyCode ?? '',
    client_code: config?.clientCode ?? '',
    client_key: '',
    system_code: config?.systemCode ?? '',
    system_name: config?.systemName ?? '',
    base_url: config?.baseUrl ?? config?.effectiveBaseUrl ?? '',
    source_service:
      config?.sourceService ?? config?.effectiveSourceService ?? '',
    callback_url: config?.callbackUrl ?? config?.effectiveCallbackUrl ?? '',
    tiramis_service_api_key: '',
    allow_expired_certificates: config?.allowExpiredCertificates ?? false,
    use_as_target_environment:
      config?.isTargetEnvironment ??
      config?.effectiveTargetEnvironment === environment,
  };
}

function ValidationBadge({
  status,
}: {
  status: PlatformTiramisConfiguration['validationStatus'];
}) {
  if (status === 'VALID') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Validated
      </Badge>
    );
  }
  if (status === 'INVALID') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        <XCircle className="mr-1 h-3 w-3" /> Invalid
      </Badge>
    );
  }
  return <Badge variant="outline">Not validated</Badge>;
}

function EnvironmentPanel({
  companyId,
  environment,
  config,
}: {
  companyId: string;
  environment: 'test' | 'live';
  config?: PlatformTiramisConfiguration;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!config);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const queryKey = ['platform-tiramis-configurations', companyId];
  const requiresApiKeyRecovery = config?.apiKeyStatus === 'RECOVERY_REQUIRED';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaultValues(environment, config),
  });

  const saveMutation = useMutation({
    mutationFn: ({
      values,
      force,
    }: {
      values: FormValues;
      force?: boolean;
    }) => {
      const confirmed =
        !values.use_as_target_environment ||
        environment !== 'live' ||
        window.confirm('Switch active TIRAMIS environment to LIVE/PRODUCTION?');

      if (!confirmed) {
        return Promise.reject(new Error('LIVE activation was cancelled'));
      }

      return platformTiramisConfigApi.upsertConfiguration(
        companyId,
        environment,
        {
          company_code: values.company_code,
          insurer_company_code: values.insurer_company_code || undefined,
          client_code: values.client_code || undefined,
          client_key: values.client_key || undefined,
          system_code: values.system_code,
          system_name: values.system_name || undefined,
          base_url: values.base_url || undefined,
          source_service: values.source_service || undefined,
          callback_url: values.callback_url || undefined,
          tiramis_service_api_key: values.tiramis_service_api_key || undefined,
          allow_expired_certificates:
            values.allow_expired_certificates ?? false,
          use_as_target_environment: values.use_as_target_environment,
          confirm_live_activation:
            values.use_as_target_environment && environment === 'live'
              ? true
              : undefined,
          force_activation:
            values.use_as_target_environment && force ? true : undefined,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${environment.toUpperCase()} configuration saved`);
      setEditing(false);
    },
    onError: (error: ApiErrorLike | Error, variables) => {
      if (error instanceof Error && error.message.includes('cancelled')) {
        return;
      }
      const message =
        getApiErrorMessage(error) ?? 'Unable to save configuration';
      if (
        variables.values.use_as_target_environment &&
        !variables.force &&
        window.confirm(
          `${message}\n\nSave the configuration and force this environment active anyway despite the validation error?`,
        )
      ) {
        saveMutation.mutate({ values: variables.values, force: true });
        return;
      }
      toast.error(message);
    },
  });

  const validateMutation = useMutation({
    mutationFn: () =>
      platformTiramisConfigApi.validateConfiguration(companyId, environment, {
        allow_expired_certificates:
          form.getValues('allow_expired_certificates') ?? false,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      if (result.valid && result.warnings?.length) {
        toast.warning(
          result.message ?? 'Configuration validated with warnings',
        );
      } else if (result.valid) {
        toast.success(result.message ?? 'Configuration validated successfully');
      } else {
        toast.error(result.message ?? 'Configuration failed validation');
      }
    },
    onError: (error: ApiErrorLike) =>
      toast.error(
        error?.response?.data?.message ?? 'Unable to validate configuration',
      ),
  });

  const activateMutation = useMutation({
    mutationFn: (force?: boolean) => {
      const confirmed =
        environment !== 'live' ||
        window.confirm('Switch active TIRAMIS environment to LIVE/PRODUCTION?');

      if (!confirmed) {
        return Promise.reject(new Error('LIVE activation was cancelled'));
      }

      return platformTiramisConfigApi.activateConfiguration(
        companyId,
        environment,
        {
          confirm_live_activation: environment === 'live' ? true : undefined,
          force_activation: force ? true : undefined,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(
        `${environment === 'live' ? 'LIVE/PRODUCTION' : 'TEST/UAT'} is now active`,
      );
    },
    onError: (error: ApiErrorLike | Error, force) => {
      if (error instanceof Error && error.message.includes('cancelled')) {
        return;
      }
      const message =
        getApiErrorMessage(error) ?? 'Unable to switch environment';
      if (
        !force &&
        window.confirm(
          `${message}\n\nForce this environment active anyway despite the validation error?`,
        )
      ) {
        activateMutation.mutate(true);
        return;
      }
      toast.error(message);
    },
  });

  const generateApiKeyMutation = useMutation({
    mutationFn: () =>
      platformTiramisConfigApi.generateApiKey(companyId, environment),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      setGeneratedApiKey(result.generatedApiKey ?? null);
      toast.success(
        `${environment === 'live' ? 'Live/Production' : 'Test/UAT'} API key ${requiresApiKeyRecovery ? 'recovered' : 'generated'}`,
      );
    },
    onError: (error: ApiErrorLike) =>
      toast.error(
        error?.response?.data?.message ??
          (requiresApiKeyRecovery
            ? 'Unable to recover API key'
            : 'Unable to generate API key'),
      ),
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base capitalize">
            {environment === 'live'
              ? 'Live/Production environment'
              : 'Test/UAT environment'}
          </CardTitle>
          <CardDescription>
            {environment === 'live'
              ? 'Production TIRAMIS credentials used for real submissions.'
              : 'Sandbox TIRAMIS credentials used for testing.'}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          {(config?.isTargetEnvironment ||
            config?.effectiveTargetEnvironment === environment) && (
            <Badge variant="secondary">Active target</Badge>
          )}
          {config && <ValidationBadge status={config.validationStatus} />}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <Form {...form}>
            <form
              onSubmit={(event) => {
                void form.handleSubmit((values) => {
                  saveMutation.mutate({ values });
                })(event);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="company_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Code</FormLabel>
                      <FormControl>
                        <Input placeholder="INS001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insurer_company_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurer Company Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Optional, defaults to company code"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIRA Client Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder={
                            config
                              ? 'Leave blank to keep the current TIRA client key'
                              : 'Paste the client key issued by TIRA'
                          }
                          {...field}
                        />
                      </FormControl>
                      <p className="mt-1 text-xs text-slate-500">
                        The secret TIRA issued for this company/environment —
                        required the first time this environment is linked.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="callback_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Callback URL (optional, informational)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://…" {...field} />
                      </FormControl>
                      <p className="mt-1 text-xs text-slate-500">
                        Portal-local reference only — TIRA's actual callback
                        endpoint is configured on TIRAMIS itself, not here.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="base_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIRAMIS_SERVICE_BASE_URL (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://api.example.com/tiramis-api"
                          {...field}
                        />
                      </FormControl>
                      <p className="mt-1 text-xs text-slate-500">
                        Where the portal sends its own requests to the TIRAMIS
                        service — leave blank to use the platform default.
                        Unrelated to which TIRA gateway TIRAMIS itself connects
                        to.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source_service"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIRAMIS_SOURCE_SERVICE</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="insurance-portal-service"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tiramis_service_api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIRAMIS Service API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder={
                            config?.serviceApiKeyMasked
                              ? `Current: ${config.serviceApiKeyMasked} (leave blank to keep)`
                              : `Paste the ${environment === 'live' ? 'Live' : 'Test'} API key`
                          }
                          {...field}
                        />
                      </FormControl>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        <KeyRound className="h-3.5 w-3.5" />
                        Leave blank to keep the current key unchanged.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="use_as_target_environment"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                    <div>
                      <FormLabel>Target Environment</FormLabel>
                      <p className="text-sm text-slate-500">
                        Makes this environment the active portal-to-TIRAMIS
                        connection for this company.
                      </p>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={!!field.value}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allow_expired_certificates"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <FormLabel>Allow Expired Certificates</FormLabel>
                      <p className="text-sm text-amber-900">
                        Bypasses expiry-date checks for the TIRA public and
                        client private certificates in this environment. Invalid
                        or unreadable certificates still fail. Use temporarily
                        while waiting for certificate renewal.
                      </p>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={!!field.value}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                {config && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save configuration'}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <div>
                <span className="text-slate-500">Company Code:</span>{' '}
                {config?.companyCode}
              </div>
              <div>
                <span className="text-slate-500">Insurer Code:</span>{' '}
                {config?.insurerCompanyCode ?? '—'}
              </div>
              <div>
                <span className="text-slate-500">System Code:</span>{' '}
                {config?.systemCode ?? '—'}
              </div>
              <div>
                <span className="text-slate-500">System Name:</span>{' '}
                {config?.systemName ?? '—'}
              </div>
              <div>
                <span className="text-slate-500">Service URL:</span>{' '}
                {config?.baseUrl ??
                  config?.effectiveBaseUrl ??
                  'Global default'}
              </div>
              <div>
                <span className="text-slate-500">Source Service:</span>{' '}
                {config?.sourceService ??
                  config?.effectiveSourceService ??
                  'Global default'}
              </div>
              <div>
                <span className="text-slate-500">API Key:</span>{' '}
                {config?.serviceApiKeyMasked ? (
                  <span className="inline-flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    {config.serviceApiKeyMasked}
                  </span>
                ) : (
                  'Not configured'
                )}
              </div>
              {requiresApiKeyRecovery && (
                <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
                  The stored API key cannot be decrypted with the current
                  encryption key. Recovering it replaces the old key using the
                  configured TIRAMIS bootstrap credential.
                </div>
              )}
              <div>
                <span className="text-slate-500">Key Environment:</span>{' '}
                {config?.environmentLabel ??
                  (environment === 'live' ? 'Live/Production' : 'Test/UAT')}
              </div>
              <div>
                <span className="text-slate-500">API Key Status:</span>{' '}
                {config?.apiKeyStatus ?? 'NOT_CONFIGURED'}
              </div>
              <div>
                <span className="text-slate-500">Expired Cert Override:</span>{' '}
                {config?.allowExpiredCertificates ? 'Enabled' : 'Disabled'}
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">
                  Callback URL (portal note, not TIRA's actual config):
                </span>{' '}
                {config?.serviceCallbackUrl ??
                  config?.effectiveCallbackUrl ??
                  config?.callbackUrl ??
                  'Not configured'}
                {config?.isActiveCallback ? (
                  <Badge className="ml-2" variant="secondary">
                    Active callback
                  </Badge>
                ) : null}
              </div>
              {config?.validationMessage && (
                <div className="col-span-2 text-slate-500">
                  Last validation message: {config.validationMessage}
                </div>
              )}
            </div>
            {generatedApiKey && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="font-medium text-amber-900">
                  New API key, shown once
                </div>
                <div className="mt-1 break-all font-mono text-amber-950">
                  {generatedApiKey}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  form.reset(buildDefaultValues(environment, config));
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                {validateMutation.isPending ? 'Validating…' : 'Validate'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (
                    requiresApiKeyRecovery &&
                    !window.confirm(
                      'Recover this API key? The unreadable stored key will be replaced and cannot be restored.',
                    )
                  ) {
                    return;
                  }
                  generateApiKeyMutation.mutate();
                }}
                disabled={generateApiKeyMutation.isPending}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                {generateApiKeyMutation.isPending
                  ? requiresApiKeyRecovery
                    ? 'Recovering...'
                    : 'Generating...'
                  : requiresApiKeyRecovery
                    ? 'Recover API Key'
                    : config?.serviceApiKeyConfigured
                      ? 'Regenerate API Key'
                      : 'Generate API Key'}
              </Button>
              {!config?.isTargetEnvironment && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => activateMutation.mutate(undefined)}
                  disabled={activateMutation.isPending}
                >
                  {activateMutation.isPending
                    ? 'Switching...'
                    : `Switch to ${environment === 'live' ? 'LIVE' : 'TEST'}`}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Platform-admin view for linking a specific company to TIRAMIS — full
 * configuration, key generation/rotation, validation, and environment
 * activation, acting on behalf of the company.
 */
export function PlatformTiramisConfigTab({ companyId }: { companyId: string }) {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['platform-tiramis-configurations', companyId],
    queryFn: () => platformTiramisConfigApi.getConfigurations(companyId),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const testConfig = configs?.find((c) => c.environment === 'test');
  const liveConfig = configs?.find((c) => c.environment === 'live');
  const activeConfig = configs?.find((c) => c.isTargetEnvironment);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-600">
          Current TIRAMIS Environment
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-900">
          {activeConfig?.environment === 'live'
            ? 'LIVE / PRODUCTION'
            : activeConfig?.environment === 'test'
              ? 'TEST / UAT'
              : 'Not selected'}
        </div>
        {activeConfig?.serviceCallbackUrl ? (
          <div className="mt-2 text-sm text-slate-600">
            Callback URL note: {activeConfig.serviceCallbackUrl}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EnvironmentPanel
          companyId={companyId}
          environment="test"
          config={testConfig}
        />
        <EnvironmentPanel
          companyId={companyId}
          environment="live"
          config={liveConfig}
        />
      </div>
    </div>
  );
}
