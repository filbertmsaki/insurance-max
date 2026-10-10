import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, XCircle } from 'lucide-react';
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
  tiramisConfigApi,
  type CompanyTiramisConfiguration,
} from '../api/tiramis-config';

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
}: {
  environment: 'test' | 'live';
  config?: CompanyTiramisConfiguration;
}) {
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
        {config ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            <div>
              <span className="text-slate-500">Company Code:</span>{' '}
              {config.companyCode}
            </div>
            <div>
              <span className="text-slate-500">Insurer Code:</span>{' '}
              {config.insurerCompanyCode ?? '—'}
            </div>
            <div>
              <span className="text-slate-500">API Key:</span>{' '}
              {config.serviceApiKeyMasked ? (
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  {config.serviceApiKeyMasked}
                </span>
              ) : (
                'Not configured'
              )}
            </div>
            <div>
              <span className="text-slate-500">API Key Status:</span>{' '}
              {config.apiKeyStatus ?? 'NOT_CONFIGURED'}
            </div>
            {config.validationMessage && (
              <div className="col-span-2 text-slate-500">
                Last validation message: {config.validationMessage}
              </div>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">
            Not yet configured. Contact your platform administrator to link this
            environment to TIRAMIS.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Read-only, zero-configuration view of the company's TIRAMIS connection
 * status. Linking/generating/rotating the API key and activating an
 * environment is done by a platform administrator on the company's behalf.
 */
export function TiramisConfigTab() {
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
        <p className="mt-2 text-xs text-slate-500">
          This connection is managed by your platform administrator.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EnvironmentPanel environment="test" config={testConfig} />
        <EnvironmentPanel environment="live" config={liveConfig} />
      </div>
    </div>
  );
}
