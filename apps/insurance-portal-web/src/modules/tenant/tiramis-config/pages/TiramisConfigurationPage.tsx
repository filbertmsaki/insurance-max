import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { TiramisConfigTab } from '../components/TiramisConfigTab';

export function TiramisConfigurationPage() {
  const { hasPermission } = useAuthStore();

  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Configuration"
        description="Manage the service URL, active environment and API key used by this company."
        breadcrumbs={['TIRAMIS', 'Configuration']}
      />
      <TiramisConfigTab
        canEdit={hasPermission('company-tiramis-config:update')}
      />
    </div>
  );
}
