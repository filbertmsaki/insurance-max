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
  tiramisConfigApi,
  type CompanyTiramisConfiguration,
} from '../api/tiramis-config';

const schema = z.object({
  company_code: z.string().min(1, 'Required').max(30),
  insurer_company_code: z.string().max(30).optional().or(z.literal('')),
  client_code: z.string().max(60).optional().or(z.literal('')),
  system_code: z.string().min(1, 'Required').max(100),
  system_name: z.string().max(150).optional().or(z.literal('')),
  base_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  source_service: z.string().max(100).optional().or(z.literal('')),
  callback_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  use_as_target_environment: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

type ApiErrorLike = { response?: { data?: { message?: string } } };

function buildDefaultValues(
  environment: 'test' | 'live',
  config?: CompanyTiramisConfiguration,
): FormValues {
  return {
    company_code: config?.companyCode ?? '',
    insurer_company_code: config?.insurerCompanyCode ?? '',
    client_code: config?.clientCode ?? '',
    system_code: config?.systemCode ?? '',
    system_name: config?.systemName ?? '',
    base_url: config?.baseUrl ?? config?.effectiveBaseUrl ?? '',
    source_service:
      config?.sourceService ?? config?.effectiveSourceService ?? '',
    callback_url: config?.callbackUrl ?? config?.effectiveCallbackUrl ?? '',
    use_as_target_environment:
      config?.isTargetEnvironment ??
      config?.effectiveTargetEnvironment === environment,
  };
}

function ValidationBadge({
  status,
}: {
  status: CompanyTiramisConfiguration['validationStatus'];
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
  environment,
  config,
  canEdit,
}: {
  environment: 'test' | 'live';
  config?: CompanyTiramisConfiguration;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!config);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaultValues(environment, config),
  });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const confirmed =
        !values.use_as_target_environment ||
        environment !== 'live' ||
        window.confirm('Switch active TIRAMIS environment to LIVE/PRODUCTION?');

      if (!confirmed) {
        return Promise.reject(new Error('LIVE activation was cancelled'));
      }

      return tiramisConfigApi.upsertMyConfiguration(environment, {
        company_code: values.company_code,
        insurer_company_code: values.insurer_company_code || undefined,
        client_code: values.client_code || undefined,
        system_code: values.system_code,
        system_name: values.system_name || undefined,
        base_url: values.base_url || undefined,
        source_service: values.source_service || undefined,
        callback_url: values.callback_url || undefined,
        use_as_target_environment: values.use_as_target_environment,
        confirm_live_activation:
          values.use_as_target_environment && environment === 'live'
            ? true
            : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tiramis-my-configurations'],
      });
      toast.success(`${environment.toUpperCase()} configuration saved`);
      setEditing(false);
    },
    onError: (error: ApiErrorLike | Error) => {
      if (error instanceof Error && error.message.includes('cancelled')) {
        return;
      }
      toast.error(
        (error as ApiErrorLike)?.response?.data?.message ??
          'Unable to save configuration',
      );
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => tiramisConfigApi.validateMyConfiguration(environment),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['tiramis-my-configurations'],
      });
      if (result.valid) {
        toast.success('Configuration validated successfully');
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
    mutationFn: () => {
      const confirmed =
        environment !== 'live' ||
        window.confirm('Switch active TIRAMIS environment to LIVE/PRODUCTION?');

      if (!confirmed) {
        return Promise.reject(new Error('LIVE activation was cancelled'));
      }

      return tiramisConfigApi.activateMyConfiguration(environment, {
        confirm_live_activation: environment === 'live' ? true : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tiramis-my-configurations'],
      });
      toast.success(
        `${environment === 'live' ? 'LIVE/PRODUCTION' : 'TEST/UAT'} is now active`,
      );
    },
    onError: (error: ApiErrorLike | Error) => {
      if (error instanceof Error && error.message.includes('cancelled')) {
        return;
      }
      toast.error(
        (error as ApiErrorLike)?.response?.data?.message ??
          'Unable to switch environment',
      );
    },
  });

  const generateApiKeyMutation = useMutation({
    mutationFn: () => tiramisConfigApi.generateMyApiKey(environment),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['tiramis-my-configurations'],
      });
      setGeneratedApiKey(result.generatedApiKey ?? null);
      toast.success(
        `${environment === 'live' ? 'Live/Production' : 'Test/UAT'} API key generated`,
      );
    },
    onError: (error: ApiErrorLike) =>
      toast.error(
        error?.response?.data?.message ?? 'Unable to generate API key',
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
              onSubmit={form.handleSubmit((values) =>
                saveMutation.mutate(values),
              )}
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
                      <FormLabel>Callback URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="base_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIRAMIS_SERVICE_BASE_URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://ussdvd.alliance.co.tz/tiramis-api"
                          {...field}
                        />
                      </FormControl>
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
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    TIRAMIS Service API Key
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    <KeyRound className="h-3.5 w-3.5" />
                    {config?.serviceApiKeyMasked
                      ? `Current API Key: ${config.serviceApiKeyMasked}`
                      : `No ${environment === 'live' ? 'Live' : 'Test'} API key configured`}
                  </div>
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
              <div>
                <span className="text-slate-500">Key Environment:</span>{' '}
                {config?.environmentLabel ??
                  (environment === 'live' ? 'Live/Production' : 'Test/UAT')}
              </div>
              <div>
                <span className="text-slate-500">API Key Status:</span>{' '}
                {config?.apiKeyStatus ?? 'NOT_CONFIGURED'}
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">
                  Portal to TIRAMIS Callback:
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
            {canEdit && (
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
                  onClick={() => generateApiKeyMutation.mutate()}
                  disabled={generateApiKeyMutation.isPending}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  {generateApiKeyMutation.isPending
                    ? 'Generating...'
                    : config?.serviceApiKeyConfigured
                      ? 'Regenerate API Key'
                      : 'Generate API Key'}
                </Button>
                {!config?.isTargetEnvironment && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => activateMutation.mutate()}
                    disabled={activateMutation.isPending}
                  >
                    {activateMutation.isPending
                      ? 'Switching...'
                      : `Switch to ${environment === 'live' ? 'LIVE' : 'TEST'}`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TiramisConfigTab({ canEdit }: { canEdit: boolean }) {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['tiramis-my-configurations'],
    queryFn: tiramisConfigApi.getMyConfigurations,
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
            Active portal to TIRAMIS callback: {activeConfig.serviceCallbackUrl}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EnvironmentPanel
          environment="test"
          config={testConfig}
          canEdit={canEdit}
        />
        <EnvironmentPanel
          environment="live"
          config={liveConfig}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
