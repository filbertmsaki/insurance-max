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
      eyebrow="Motor Insurance"
      title="Policies"
      description="Single Motor and Fleet policies in one register."
      queryKey={motorInsuranceKeys.policies()}
      fetcher={(params, signal) =>
        motorInsuranceApi.getPolicies(
          params as Parameters<typeof motorInsuranceApi.getPolicies>[0],
          signal,
        )
      }
      typeChips={[
        { value: '', label: 'All' },
        { value: 'single', label: 'Single' },
        { value: 'fleet', label: 'Fleet' },
      ]}
      detailHref={motorInsurancePaths.policyDetail}
    />
  );
}
