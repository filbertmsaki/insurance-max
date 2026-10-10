import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTiramisIntegrationCompanies } from '../hooks';

/** Read-only summary of a company's platform-managed TIRA access. */
export function CompanyTiramisAccessCard({ companyId }: { companyId: string }) {
  const { data, isLoading, isError } = useTiramisIntegrationCompanies();
  const link = data?.find((row) => row.companyId === companyId)?.link ?? null;
  const status = link?.status;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">TIRAMIS access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : isError ? (
          <p className="text-muted-foreground">
            TIRAMIS access status is unavailable.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              Status:
              <Badge
                variant={
                  status === 'ACTIVE'
                    ? 'success'
                    : status === 'REVOKED'
                      ? 'danger'
                      : status === 'LINKED'
                        ? 'info'
                        : 'muted'
                }
              >
                {status ?? 'NOT LINKED'}
              </Badge>
            </div>
            {link && (
              <div className="text-muted-foreground">
                Insurer code: {link.insurerCompanyCode}
              </div>
            )}
            {status === 'REVOKED' && link?.revokeReason && (
              <div className="text-muted-foreground">
                Reason: {link.revokeReason}
              </div>
            )}
          </>
        )}
        <Link
          to="/platform/tiramis-integration"
          className="text-blue-600 hover:underline"
        >
          Manage in TIRAMIS Integration
        </Link>
      </CardContent>
    </Card>
  );
}
