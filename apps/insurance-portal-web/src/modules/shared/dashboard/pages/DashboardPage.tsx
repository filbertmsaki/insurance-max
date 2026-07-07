import { useQuery } from '@tanstack/react-query'
import { Users, Monitor, Smartphone, Key, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { usersApi } from '@/modules/tenant/users/api/users'
import { sessionsApi } from '@/modules/shared/sessions/api/sessions'
import { devicesApi } from '@/modules/shared/devices/api/devices'
import { apiClientsApi } from '@/modules/platform/api-clients/api/api-clients'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | undefined
  loading: boolean
  color: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-3xl font-bold text-slate-900">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  )
}

const recentActivity = [
  { id: 1, action: 'User login', description: 'admin@example.com signed in', time: '2 minutes ago' },
  { id: 2, action: 'API Client created', description: 'New API client "mobile-app" was created', time: '1 hour ago' },
  { id: 3, action: 'Role assigned', description: 'COMPANY_ADMIN role assigned to user', time: '3 hours ago' },
  { id: 4, action: 'Device trusted', description: 'MacBook Pro trusted on account', time: '1 day ago' },
  { id: 5, action: 'Password changed', description: 'Account password was updated', time: '2 days ago' },
]

export function DashboardPage() {
  const { user } = useAuthStore()
  const isPlatformAccount = user?.scope === 'platform'

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', { page: 1, limit: 1 }],
    queryFn: () => usersApi.getUsers({ page: 1, limit: 1 }),
  })

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.getSessions,
  })

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
  })

  const { data: apiClients, isLoading: apiClientsLoading } = useQuery({
    queryKey: ['api-clients', { page: 1, limit: 1 }],
    queryFn: () => apiClientsApi.getApiClients({ page: 1, limit: 1 }),
    enabled: isPlatformAccount,
  })

  const activeSessions = sessions?.filter((s) => !s.revoked).length
  const trustedDevices = devices?.filter((d) => d.trusted).length
  const activeClients = apiClients?.data?.filter((c) => c.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.email}`}
      />

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 ${isPlatformAccount ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard
          icon={Users}
          label="Total Users"
          value={users?.pagination?.total}
          loading={usersLoading}
          color="bg-blue-500"
        />
        <StatCard
          icon={Monitor}
          label="Active Sessions"
          value={activeSessions}
          loading={sessionsLoading}
          color="bg-green-500"
        />
        <StatCard
          icon={Smartphone}
          label="Trusted Devices"
          value={trustedDevices}
          loading={devicesLoading}
          color="bg-purple-500"
        />
        {isPlatformAccount ? (
          <StatCard
            icon={Key}
            label="Active API Clients"
            value={activeClients}
            loading={apiClientsLoading}
            color="bg-amber-500"
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className="h-2 w-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
