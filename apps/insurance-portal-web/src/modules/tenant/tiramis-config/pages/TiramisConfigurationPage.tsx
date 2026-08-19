import { PageHeader } from '@/components/shared/PageHeader';
import { TiramisConfigTab } from '../components/TiramisConfigTab';

export function TiramisConfigurationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="TIRAMIS Configuration"
        description="View this company's TIRAMIS connection status. Configuration is managed by your platform administrator."
        breadcrumbs={['TIRAMIS', 'Configuration']}
      />
      <TiramisConfigTab />
    </div>
  );
}
