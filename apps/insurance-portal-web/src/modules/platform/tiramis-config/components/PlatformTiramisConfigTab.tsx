import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useForm, useWatch } from 'react-hook-form';
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
import { TiramisSecretHealthCard } from '@/components/shared/TiramisSecretHealthCard';
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
  sale_point_code: z.string().max(12).optional().or(z.literal('')),
  tran_company_code: z.string().max(6).optional().or(z.literal('')),
  tiramis_service_api_key: z.string().max(500).optional().or(z.literal('')),
  use_as_target_environment: z.boolean().optional(),
  integration_permissions: z.array(
    z.enum(['submit', 'read_status', 'receive_notifications']),
  ),
  notification_events: z.array(z.string()),
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
    sale_point_code: '',
    tran_company_code: '',
    tiramis_service_api_key: '',
    use_as_target_environment:
      config?.isTargetEnvironment ??
      config?.effectiveTargetEnvironment === environment,
    integration_permissions: (config?.integrationPermissions ?? [
      'submit',
      'read_status',
      'receive_notifications',
    ]) as FormValues['integration_permissions'],
    notification_events: config?.notificationEvents ?? [
      'TIRAMIS_ACK_RECEIVED',
      'TIRAMIS_ACK_FAILED',
      'TIRAMIS_FINAL_RESPONSE_RECEIVED',
      'TIRAMIS_FINAL_SUCCESS',
      'TIRAMIS_FINAL_FAILED',
      'TIRAMIS_FINAL_CALLBACK_OVERDUE',
      'TIRAMIS_RESPONSE_ACK_SENT',
      'TIRAMIS_CALLBACK_REJECTED',
      'TIRAMIS_SUBMISSION_FAILED',
    ],
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
  const [allowedIpsInput, setAllowedIpsInput] = useState('');
  const [allowExpiredOnce, setAllowExpiredOnce] = useState(false);
  const queryKey = ['platform-tiramis-configurations', companyId];
  const requiresApiKeyRecovery = config?.apiKeyStatus === 'RECOVERY_REQUIRED';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaultValues(environment, config),
  });
  const integrationPermissions = useWatch({
    control: form.control,
    name: 'integration_permissions',
  });
  const notificationEvents = useWatch({
    control: form.control,
    name: 'notification_events',
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
          sale_point_code: values.sale_point_code || undefined,
          tran_company_code: values.tran_company_code || undefined,
          tiramis_service_api_key: values.tiramis_service_api_key || undefined,
          integration_permissions: values.integration_permissions,
          notification_events: values.notification_events,
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
        allow_expired_certificates: allowExpiredOnce,
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
    mutationFn: () => {
      const allowedIps = [
        ...new Set(
          allowedIpsInput
            .split(/[\s,;]+/)
            .map((ip) => ip.trim())
            .filter(Boolean),
        ),
      ];
      if (!allowedIps.length)
        throw new Error(
          'Enter at least one public egress IP address for this portal system.',
        );
      return platformTiramisConfigApi.generateApiKey(
        companyId,
        environment,
        allowedIps,
      );
    },
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
                  name="sale_point_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Sale Point Code (optional)</FormLabel>
                      <FormControl>
                        <Input maxLength={12} {...field} />
                      </FormControl>
                      <p className="mt-1 text-xs text-slate-500">
                        Used only when a request has no branch sale point.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tran_company_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Company Code (optional)</FormLabel>
                      <FormControl>
                        <Input
                          maxLength={6}
                          placeholder="Defaults to insurer company code"
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
                <div className="col-span-2 rounded-md border p-3 space-y-3">
                  <div className="font-medium">Integration permissions</div>
                  {(
                    [
                      ['submit', 'Submit requests'],
                      ['read_status', 'Read status and history'],
                      [
                        'receive_notifications',
                        'Receive callback notifications',
                      ],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={integrationPermissions.includes(value)}
                        onChange={(event) => {
                          const current = form.getValues(
                            'integration_permissions',
                          );
                          form.setValue(
                            'integration_permissions',
                            event.target.checked
                              ? [...current, value]
                              : current.filter((item) => item !== value),
                          );
                        }}
                      />
                      {label}
                    </label>
                  ))}
                  <div className="pt-2 border-t font-medium">
                    Notification events
                  </div>
                  {[
                    'TIRAMIS_ACK_RECEIVED',
                    'TIRAMIS_ACK_FAILED',
                    'TIRAMIS_FINAL_RESPONSE_RECEIVED',
                    'TIRAMIS_FINAL_SUCCESS',
                    'TIRAMIS_FINAL_FAILED',
                    'TIRAMIS_FINAL_CALLBACK_OVERDUE',
                    'TIRAMIS_RESPONSE_ACK_SENT',
                    'TIRAMIS_CALLBACK_REJECTED',
                    'TIRAMIS_SUBMISSION_FAILED',
                  ].map((eventType) => (
                    <label
                      key={eventType}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={notificationEvents.includes(eventType)}
                        disabled={
                          !integrationPermissions.includes(
                            'receive_notifications',
                          )
                        }
                        onChange={(event) => {
                          const current = form.getValues('notification_events');
                          form.setValue(
                            'notification_events',
                            event.target.checked
                              ? [...current, eventType]
                              : current.filter((item) => item !== eventType),
                          );
                        }}
                      />
                      {eventType
                        .replace('TIRAMIS_', '')
                        .replaceAll('_', ' ')
                        .toLowerCase()}
                    </label>
                  ))}
                </div>
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
                <span className="text-slate-500">Service URL:</span>{' '}
                {config?.effectiveBaseUrl ?? 'Global default'}
              </div>
              <div>
                <span className="text-slate-500">Source Service:</span>{' '}
                {config?.effectiveSourceService ?? 'Global default'}
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
                  signed-in platform administrator session.
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
                <span className="text-slate-500">Notification credential:</span>{' '}
                {config?.notificationCredentialStatus ?? 'Not checked'}
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
            <div className="max-w-xl space-y-1">
              <label
                className="text-sm font-medium"
                htmlFor={`tiramis-allowed-ips-${environment}`}
              >
                Allowed portal server IP addresses
              </label>
              <Input
                id={`tiramis-allowed-ips-${environment}`}
                value={allowedIpsInput}
                onChange={(event) => setAllowedIpsInput(event.target.value)}
                placeholder="203.0.113.10, 203.0.113.11"
                aria-describedby={`tiramis-allowed-ips-help-${environment}`}
              />
              <p
                id={`tiramis-allowed-ips-help-${environment}`}
                className="text-xs text-slate-500"
              >
                Enter every public NAT egress IP used by this portal system,
                separated by commas or spaces.
              </p>
            </div>
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={allowExpiredOnce}
                onChange={(event) => setAllowExpiredOnce(event.target.checked)}
              />
              <span>
                Allow expired certificates for the next validation only. Not
                stored; invalid or unreadable certificates still fail.
              </span>
            </label>
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
 * Read-only view of the platform-wide TIRA system identity (TIRAMIS server
 * environment). Shared by every company; never edited per company.
 */
function SystemIdentityPanel({
  companyId,
  environment,
}: {
  companyId: string;
  environment: 'test' | 'live';
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-tiramis-system-identity', companyId, environment],
    queryFn: () =>
      platformTiramisConfigApi.getSystemIdentity(companyId, environment),
    retry: false,
  });

  const rows: Array<[string, string | null | undefined]> = [
    ['Client code', data?.clientCode],
    ['System code', data?.systemCode],
    ['System name', data?.systemName],
    ['TIRA base URL', data?.baseUrl],
    ['Callback URL', data?.callbackBaseUrl],
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          TIRA system identity (platform-wide) - {environment.toUpperCase()}
        </CardTitle>
        <CardDescription>
          These values come from the TIRAMIS server environment and are shared
          by all companies. They cannot be edited per company.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : isError ? (
          <p className="text-sm text-red-700">
            Could not load the TIRA system identity.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="break-all">
                <span className="text-slate-500">{label}:</span> {value || '-'}
              </div>
            ))}
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
      </div>
      <SystemIdentityPanel
        companyId={companyId}
        environment={activeConfig?.environment ?? 'test'}
      />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[testConfig, liveConfig]
          .filter((config) => config?.isActive)
          .map((config) => (
            <TiramisSecretHealthCard
              key={config!.environment}
              scopeKey={companyId}
              environment={config!.environment}
              allowReplacements
              fetchHealth={() =>
                platformTiramisConfigApi.getSecretHealth(
                  companyId,
                  config!.environment,
                )
              }
              repair={(replacements) =>
                platformTiramisConfigApi.repairSecrets(
                  companyId,
                  config!.environment,
                  replacements,
                )
              }
            />
          ))}
      </div>
    </div>
  );
}
