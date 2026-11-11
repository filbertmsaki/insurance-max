import { PolicyRegister } from '@/modules/tenant/policies/components/PolicyRegister';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { motorInsurancePaths } from '../paths';

/**
 * Motor Insurance policy register. Type comes from the stored
 * `business_line`, never from the vehicle count: a fleet reduced to one
 * vehicle is still a fleet.
 */
export function MotorInsurancePoliciesPage() {
  return (
    <PolicyRegister
      title="Policies"
      description="Single Motor and Fleet policies in one register."
      breadcrumb={[
        { label: 'Motor Insurance', href: motorInsurancePaths.root },
        { label: 'Policies' },
      ]}
      queryKey={motorInsuranceKeys.policies()}
      stateKey="motor-policies"
      fetcher={(params, signal) =>
        motorInsuranceApi.getPolicies(
          params as Parameters<typeof motorInsuranceApi.getPolicies>[0],
          signal,
        )
      }
      typeChips={[
        { id: 'all', label: 'All' },
        { id: 'single', label: 'Single' },
        { id: 'fleet', label: 'Fleet' },
      ]}
      detailHref={motorInsurancePaths.policyDetail}
    />
  );
}
