import { useQuery } from '@tanstack/react-query';
import { BellRing, Files, MessageSquareText, ShieldCheck } from 'lucide-react';

import { DashboardCard } from '@/components/shared/DashboardCard';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statusTone, formatDateTime } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

export function PortalDashboardPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const label = audience === 'customer' ? 'Customer' : 'Intermediary';
  const profileQuery = useQuery({
    queryKey: ['portal', audience, 'profile'],
    queryFn: () => portalApi.getProfile(audience),
  });
  const documentsQuery = useQuery({
    queryKey: ['portal', audience, 'documents'],
    queryFn: () => portalApi.listDocuments(audience),
  });
  const notificationsQuery = useQuery({
    queryKey: ['portal', audience, 'notifications'],
    queryFn: () => portalApi.listNotifications(audience),
  });
  const messagesQuery = useQuery({
    queryKey: ['portal', audience, 'messages'],
    queryFn: () => portalApi.listMessages(audience),
  });
  const signaturesQuery = useQuery({
    queryKey: ['portal', audience, 'signatures'],
    queryFn: () => portalApi.listSignatures(audience),
  });

  const unreadNotifications = (notificationsQuery.data ?? []).filter(
    (item) => !item.read_at,
  );
  const openThreads = (messagesQuery.data ?? []).filter(
    (item) => !item.closed_at,
  );
  const pendingSignatures = (signaturesQuery.data ?? []).filter((item) =>
    ['DRAFT', 'SENT', 'PARTIALLY_SIGNED'].includes(item.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title={`${label} Dashboard`}
        description="Documents, notifications, messages, and signatures available in your self-service workspace."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Visible documents"
          value={documentsQuery.data?.length ?? 0}
          icon={Files}
          loading={documentsQuery.isLoading}
          description="Files shared to this portal account."
        />
        <DashboardCard
          title="Unread notifications"
          value={unreadNotifications.length}
          icon={BellRing}
          loading={notificationsQuery.isLoading}
          description="Alerts still waiting for review."
        />
        <DashboardCard
          title="Open conversations"
          value={openThreads.length}
          icon={MessageSquareText}
          loading={messagesQuery.isLoading}
          description="Active threads you can reply to."
        />
        <DashboardCard
          title="Pending signatures"
          value={pendingSignatures.length}
          icon={ShieldCheck}
          loading={signaturesQuery.isLoading}
          description="Requests not yet completed."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notificationsQuery.isError ? (
              <ErrorState
                description="Recent portal alerts could not be loaded."
                onRetry={() => notificationsQuery.refetch()}
              />
            ) : unreadNotifications.length === 0 &&
              (notificationsQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No notifications"
                description="New alerts will appear here once they are published to your portal account."
              />
            ) : (
              (notificationsQuery.data ?? []).slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {item.title}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {item.message}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusTone(item.severity)}
                    >
                      {item.read_at ? 'READ' : item.severity}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatDateTime(item.created_at)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {profileQuery.isError ? (
              <ErrorState
                description="Portal profile data could not be loaded."
                onRetry={() => profileQuery.refetch()}
              />
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Account
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {profileQuery.data?.display_name ??
                      profileQuery.data?.name ??
                      profileQuery.data?.company_name ??
                      'Portal account'}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProfileItem
                    label="Email"
                    value={
                      profileQuery.data?.email ??
                      profileQuery.data?.contact_email ??
                      'Not set'
                    }
                  />
                  <ProfileItem
                    label="Phone"
                    value={
                      profileQuery.data?.phone ??
                      profileQuery.data?.contact_phone ??
                      'Not set'
                    }
                  />
                  <ProfileItem
                    label="Reference"
                    value={
                      profileQuery.data?.customer_no ??
                      profileQuery.data?.slug ??
                      'Not set'
                    }
                  />
                  <ProfileItem
                    label="Status"
                    value={
                      profileQuery.data?.status ??
                      profileQuery.data?.tira_license_status ??
                      'Not set'
                    }
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
