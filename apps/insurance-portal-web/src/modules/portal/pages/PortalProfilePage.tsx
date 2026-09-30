import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { portalApi, type PortalAudience } from '../api';

export function PortalProfilePage({ audience }: { audience: PortalAudience }) {
  const label = audience === 'customer' ? 'Customer' : 'Intermediary';
  const profileQuery = useQuery({
    queryKey: ['portal', audience, 'profile'],
    queryFn: () => portalApi.getProfile(audience),
  });

  const fields =
    audience === 'customer'
      ? [
          ['Display name', profileQuery.data?.display_name ?? 'Not set'],
          ['Customer number', profileQuery.data?.customer_no ?? 'Not set'],
          ['Customer type', profileQuery.data?.customer_type ?? 'Not set'],
          ['Email', profileQuery.data?.email ?? 'Not set'],
          ['Phone', profileQuery.data?.phone ?? 'Not set'],
          ['Alternate phone', profileQuery.data?.alternate_phone ?? 'Not set'],
          ['Region', profileQuery.data?.region ?? 'Not set'],
          ['District', profileQuery.data?.district ?? 'Not set'],
          ['Street', profileQuery.data?.street ?? 'Not set'],
          ['Postal address', profileQuery.data?.postal_address ?? 'Not set'],
          ['KYC status', profileQuery.data?.kyc_status ?? 'Not set'],
          ['Status', profileQuery.data?.status ?? 'Not set'],
        ]
      : [
          ['Name', profileQuery.data?.name ?? 'Not set'],
          ['Company type', profileQuery.data?.company_type ?? 'Not set'],
          ['Email', profileQuery.data?.contact_email ?? 'Not set'],
          ['Phone', profileQuery.data?.contact_phone ?? 'Not set'],
          ['Website', profileQuery.data?.website ?? 'Not set'],
          ['Slug', profileQuery.data?.slug ?? 'Not set'],
          [
            'TIRA license number',
            profileQuery.data?.tira_license_number ?? 'Not set',
          ],
          [
            'TIRA license status',
            profileQuery.data?.tira_license_status ?? 'Not set',
          ],
          [
            'Address',
            profileQuery.data?.address
              ? JSON.stringify(profileQuery.data.address)
              : 'Not set',
          ],
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer portal"
        title={`${label} Profile`}
        description="Reference details currently exposed through the portal account."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Profile details</CardTitle>
        </CardHeader>
        <CardContent>
          {profileQuery.isError ? (
            <ErrorState
              description="Portal profile data could not be loaded."
              onRetry={() => profileQuery.refetch()}
            />
          ) : (
            <dl className="grid gap-4 md:grid-cols-2">
              {fields.map(([labelText, value]) => (
                <div
                  key={labelText}
                  className="rounded-lg border border-slate-200 px-4 py-3"
                >
                  <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    {labelText}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900 break-words">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
