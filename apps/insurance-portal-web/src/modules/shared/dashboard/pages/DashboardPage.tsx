import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
  Landmark,
  Monitor,
  ShieldCheck,
  Smartphone,
  Users,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { usersApi } from '@/modules/tenant/users/api/users';
import { sessionsApi } from '@/modules/shared/sessions/api/sessions';
import { devicesApi } from '@/modules/shared/devices/api/devices';
import { apiClientsApi } from '@/modules/platform/api-clients/api/api-clients';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { phase16Api } from '@/modules/tenant/phase16/api/phase16';

function formatWidgetValue(
  value: string | null | undefined,
  unit: string | undefined,
) {
  if (value === null || value === undefined) {
    return 'Unavailable';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  if (unit === 'MONEY') {
    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (unit === 'PERCENTAGE') {
    return `${numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isPlatformAccount = user?.scope === 'platform';
  const canViewExecutive =
    user?.permissions?.includes('dashboard:overview') ||
    user?.permissions?.includes('dashboards:executive:read');
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', { page: 1, limit: 1 }],
    queryFn: () => usersApi.getUsers({ page: 1, limit: 1 }),
  });
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.getSessions,
  });
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  });
  const { data: apiClients, isLoading: apiClientsLoading } = useQuery({
    queryKey: ['api-clients', { page: 1, limit: 1 }],
    queryFn: () => apiClientsApi.getApiClients({ page: 1, limit: 1 }),
    enabled: isPlatformAccount,
  });
  const executiveQuery = useQuery({
    queryKey: ['phase16', 'dashboard', 'executive'],
    queryFn: phase16Api.getExecutiveDashboard,
    enabled: !isPlatformAccount && Boolean(canViewExecutive),
  });

  const activeSessions = sessions?.length;
  const trustedDevices = devices?.filter((d) => d.trusted).length;
  const activeClients = apiClients?.data?.filter(
    (c) => c.status === 'active',
  ).length;
  const executiveWidgets = useMemo(
    () => executiveQuery.data?.widgets ?? [],
    [executiveQuery.data],
  );
  const quickLinks = [
    {
      title: 'Analytics Metrics',
      description: 'Explore formula-backed metrics with freshness and comparisons.',
      icon: BarChart3,
      to: '/analytics/metrics',
    },
    {
      title: 'Reporting Workbench',
      description: 'Run registered reports, inspect jobs, and manage schedules.',
      icon: FileSpreadsheet,
      to: '/reports',
    },
    {
      title: 'Regulatory Compliance',
      description: 'Review calendars, returns, levy assessments, and evidence.',
      icon: Landmark,
      to: '/regulatory',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurance operations"
        title="Dashboard"
        description={'Welcome back, ' + user?.email}
      />

      {!isPlatformAccount && canViewExecutive ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {executiveWidgets.map((widget) => (
              <DashboardCard
                key={widget.code}
                icon={ShieldCheck}
                title={widget.name ?? widget.code}
                value={
                  widget.status === 'AVAILABLE'
                    ? formatWidgetValue(widget.data?.value, widget.data?.unit)
                    : widget.status === 'NO_DATA'
                      ? 'No data'
                      : 'Unavailable'
                }
                loading={executiveQuery.isLoading}
                description={
                  <div className="space-y-1">
                    <p>Status: {widget.status}</p>
                    <p>
                      Freshness: {widget.freshness?.status ?? 'UNAVAILABLE'}
                    </p>
                    {widget.data?.formulaVersion ? (
                      <p>Formula version: v{widget.data.formulaVersion}</p>
                    ) : null}
                  </div>
                }
                status={
                  <Badge variant="outline">
                    {widget.freshness?.status ?? widget.status}
                  </Badge>
                }
              />
            ))}
          </div>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Dashboard freshness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Widgets use the same metric catalogue as analytics and reporting.
                Disabled or unavailable modules are shown as unavailable instead of zero.
              </p>
              <div className="flex flex-wrap gap-2">
                {executiveWidgets.map((widget) => (
                  <Badge key={widget.code} variant="outline">
                    {widget.name ?? widget.code}: {widget.freshness?.status ?? widget.status}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : !isPlatformAccount ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Executive dashboard access is restricted</AlertTitle>
          <AlertDescription>
            This account does not currently have `dashboard:overview` or
            `dashboards:executive:read`. The Phase 16 workspaces below are still
            available based on your permissions.
          </AlertDescription>
        </Alert>
      ) : null}

      {(isPlatformAccount || !canViewExecutive) && (
        <div
          className={
            'grid grid-cols-1 gap-4 sm:grid-cols-2 ' +
            (isPlatformAccount ? 'lg:grid-cols-4' : 'lg:grid-cols-3')
          }
        >
          <DashboardCard
            icon={Users}
            title="Total Users"
            value={users?.pagination?.total ?? 0}
            loading={usersLoading}
            description="Accounts in the current workspace"
          />
          <DashboardCard
            icon={Monitor}
            title="Active Sessions"
            value={activeSessions ?? 0}
            loading={sessionsLoading}
            description="Sessions that are currently active"
          />
          <DashboardCard
            icon={Smartphone}
            title="Trusted Devices"
            value={trustedDevices ?? 0}
            loading={devicesLoading}
            description="Trusted devices available to users"
          />
          {isPlatformAccount && (
            <DashboardCard
              icon={Key}
              title="Active API Clients"
              value={activeClients ?? 0}
              loading={apiClientsLoading}
              description="Active credentials for integrations"
            />
          )}
        </div>
      )}

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Phase 16 Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Card key={link.to} className="rounded-lg border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <link.icon className="h-4 w-4 text-blue-600" />
                  {link.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">{link.description}</p>
                <Button variant="outline" onClick={() => navigate(link.to)}>
                  Open
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Operational baseline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active sessions
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {activeSessions ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Trusted devices
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {trustedDevices ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Workspace users
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {users?.pagination?.total ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
