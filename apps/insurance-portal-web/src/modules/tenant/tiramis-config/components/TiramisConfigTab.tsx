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
  tiramis_service_api_key: z.string().optional().or(z.literal('')),
  use_as_target_environment: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

type ApiErrorLike = { response?: { data?: { message?: string } } };

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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_code: config?.companyCode ?? '',
      insurer_company_code: config?.insurerCompanyCode ?? '',
      client_code: config?.clientCode ?? '',
      system_code: config?.systemCode ?? '',
      system_name: config?.systemName ?? '',
      base_url: config?.baseUrl ?? '',
      source_service: config?.sourceService ?? '',
      callback_url: config?.callbackUrl ?? '',
      tiramis_service_api_key: '',
      use_as_target_environment: config?.isTargetEnvironment ?? false,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      tiramisConfigApi.upsertMyConfiguration(environment, {
        company_code: values.company_code,
        insurer_company_code: values.insurer_company_code || undefined,
        client_code: values.client_code || undefined,
        system_code: values.system_code,
        system_name: values.system_name || undefined,
        base_url: values.base_url || undefined,
        source_service: values.source_service || undefined,
        callback_url: values.callback_url || undefined,
        tiramis_service_api_key:
          values.tiramis_service_api_key || undefined,
        use_as_target_environment: values.use_as_target_environment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tiramis-my-configurations'],
      });
      toast.success(`${environment.toUpperCase()} configuration saved`);
      setEditing(false);
    },
    onError: (error: ApiErrorLike) =>
      toast.error(
        error?.response?.data?.message ?? 'Unable to save configuration',
      ),
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

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base capitalize">
            {environment} environment
          </CardTitle>
          <CardDescription>
            {environment === 'live'
              ? 'Production TIRAMIS credentials used for real submissions.'
              : 'Sandbox TIRAMIS credentials used for testing.'}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          {config?.isTargetEnvironment && (
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
                            config?.serviceApiKeyMasked ||
                            'Paste tms_ API key'
                          }
                          {...field}
                        />
                      </FormControl>
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
                      <FormLabel>TIRAMIS_TARGET_ENV</FormLabel>
                      <p className="text-sm text-slate-500">
                        Overrides TIRAMIS_TARGET_ENV for this company.
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
                {config?.baseUrl ?? 'Global default'}
              </div>
              <div>
                <span className="text-slate-500">Source Service:</span>{' '}
                {config?.sourceService ?? 'Global default'}
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
              {config?.validationMessage && (
                <div className="col-span-2 text-slate-500">
                  Last validation message: {config.validationMessage}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
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

  return (
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
  );
}
