import { PolicyRegister } from '@/modules/tenant/policies/components/PolicyRegister';
import { underwriteApi } from '../api';
import { underwriteKeys, useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';

/** Non-Motor policy register on the shared policy list layout. */
function PoliciesList({ line }: { line: UnderwriteLineMeta }) {
  return (
    <PolicyRegister
      title={`${line.label} policies`}
      description={line.description}
      breadcrumb={[
        { label: line.label, href: underwritePaths.lineDashboard(line.slug) },
        { label: 'Policies' },
      ]}
      queryKey={underwriteKeys.policies(line.slug)}
      stateKey={`${line.slug}-policies`}
      fetcher={(params, signal) =>
        underwriteApi.getPolicies(line.slug, params, signal)
      }
      defaultLine="NON_MOTOR"
      detailHref={(id) => underwritePaths.policyDetail(line.slug, id)}
    />
  );
}

export function NonMotorPoliciesPage() {
  const line = useUnderwriteLineParam();
  return line?.line === 'NON_MOTOR' ? (
    <PoliciesList key={line.slug} line={line} />
  ) : null;
}
