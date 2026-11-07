import { Route } from 'react-router-dom';
import {
  LegacyRedirect,
  type LegacyRedirectParams as Params,
} from './components/LegacyRedirect';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import type { MotorInsuranceType } from './api';
import { motorInsurancePaths, type MotorTransactionTab } from './paths';

const TYPE: Record<'motor' | 'fleet', MotorInsuranceType> = {
  motor: 'single',
  fleet: 'fleet',
};

const TABS: Array<[keyof typeof underwritePaths, MotorTransactionTab]> = [
  ['endorsements', 'endorsements'],
  ['cancellations', 'cancellations'],
  ['renewals', 'renewals'],
  ['tiraPending', 'tira-pending'],
  ['tiraFailed', 'tira-failed'],
];

/**
 * MF-7: old Motor and Fleet quotation, policy and transaction URLs (deep
 * links, bookmarks, e-mails) open the same records in the Motor Insurance
 * module. Line dashboards, customers and the vehicle/fleet registers are not
 * redirected: they keep their existing pages.
 */
export function renderLegacyMotorRedirects() {
  return (['motor', 'fleet'] as const).flatMap((slug) => {
    const line = slug as UnderwriteLineSlug;
    const routes: Array<[string, (params: Params) => string]> = [
      [underwritePaths.quotations(line), () => motorInsurancePaths.quotations],
      [
        underwritePaths.quotationCreate(line),
        () => motorInsurancePaths.quotationCreate(TYPE[slug]),
      ],
      [
        underwritePaths.quotationDetail(line, ':id'),
        (p) => motorInsurancePaths.quotationDetail(p.id!),
      ],
      [
        underwritePaths.quotationEdit(line, ':id'),
        (p) => motorInsurancePaths.quotationEdit(p.id!),
      ],
      [underwritePaths.policies(line), () => motorInsurancePaths.policies],
      [
        underwritePaths.policyDetail(line, ':id'),
        (p) => motorInsurancePaths.policyDetail(p.id!),
      ],
      [
        underwritePaths.policyEndorsementCreate(line, ':policyId'),
        (p) => motorInsurancePaths.policyEndorsementCreate(p.policyId!),
      ],
      [
        underwritePaths.policyEndorsementEdit(
          line,
          ':policyId',
          ':endorsementId',
        ),
        (p) =>
          motorInsurancePaths.policyEndorsementEdit(
            p.policyId!,
            p.endorsementId!,
          ),
      ],
      [
        underwritePaths.policyCancellationCreate(line, ':policyId'),
        (p) => motorInsurancePaths.policyCancellationCreate(p.policyId!),
      ],
      [
        underwritePaths.policyCancellationDetail(
          line,
          ':policyId',
          ':cancellationId',
        ),
        (p) =>
          motorInsurancePaths.policyCancellationDetail(
            p.policyId!,
            p.cancellationId!,
          ),
      ],
      [
        underwritePaths.policyRenewalDetail(line, ':policyId', ':renewalId'),
        (p) =>
          motorInsurancePaths.policyRenewalDetail(p.policyId!, p.renewalId!),
      ],
      ...TABS.map(
        ([key, tab]) =>
          [
            (underwritePaths[key] as (l: UnderwriteLineSlug) => string)(line),
            () => motorInsurancePaths.transactions(tab),
          ] as [string, (params: Params) => string],
      ),
    ];

    return routes.map(([path, to]) => (
      <Route
        key={`legacy:${path}`}
        path={path}
        element={<LegacyRedirect to={to} />}
      />
    ));
  });
}
