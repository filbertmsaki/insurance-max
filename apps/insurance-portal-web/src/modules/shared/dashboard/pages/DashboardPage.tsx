import { useQuery } from '@tanstack/react-query';
import { Users, Monitor, Smartphone, Key, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardCard } from '@/components/shared/DashboardCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { usersApi } from '@/modules/tenant/users/api/users';
import { sessionsApi } from '@/modules/shared/sessions/api/sessions';
import { devicesApi } from '@/modules/shared/devices/api/devices';
import { apiClientsApi } from '@/modules/platform/api-clients/api/api-clients';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const recentActivity = [
  {
    id: 1,
    action: 'User login',
    description: 'admin@example.com signed in',
    time: '2 minutes ago',
  },
  {
    id: 2,
    action: 'API Client created',
    description: 'New API client "mobile-app" was created',
    time: '1 hour ago',
  },
  {
    id: 3,
    action: 'Role assigned',
    description: 'COMPANY_ADMIN role assigned to user',
    time: '3 hours ago',
  },
  {
    id: 4,
    action: 'Device trusted',
    description: 'MacBook Pro trusted on account',
    time: '1 day ago',
  },
  {
    id: 5,
    action: 'Password changed',
    description: 'Account password was updated',
    time: '2 days ago',
  },
];

export function DashboardPage() {
  const { user } = useAuthStore();
  const isPlatformAccount = user?.scope === 'platform';
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

  const activeSessions = sessions?.length;
  const trustedDevices = devices?.filter((d) => d.trusted).length;
  const activeClients = apiClients?.data?.filter(
    (c) => c.status === 'active',
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow="Insurance operations"
        title="Dashboard"
        description={'Welcome back, ' + user?.email}
      />
      <div
        className={
          'mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 ' +
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
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" aria-hidden="true" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0"
              >
                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {item.action}
                  </p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-slate-400">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
