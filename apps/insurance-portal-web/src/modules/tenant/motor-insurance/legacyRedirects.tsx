import { Route } from 'react-router-dom';
import {
  LegacyRedirect,
  type LegacyRedirectParams as Params,
} from './components/LegacyRedirect';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import type { MotorInsuranceType } from './api';
import { motorInsurancePaths, type MotorTransactionTab } from './paths';

// Compatibility aliases only: these paths never render a legacy page.
const legacyPaths = {
  customers: (line: string) => `/apps/underwrite/${line}/customers`,
  customerCreate: (line: string) => `/apps/underwrite/${line}/customers/new`,
  customerDetail: (line: string, id: string) =>
    `/apps/underwrite/${line}/customers/${id}`,
  customerEdit: (line: string, id: string) =>
    `/apps/underwrite/${line}/customers/${id}/edit`,

  quotations: (line: string) => `/apps/underwrite/${line}/quotations`,
  quotationCreate: (line: string) => `/apps/underwrite/${line}/quotations/new`,
  quotationDetail: (line: string, id: string) =>
    `/apps/underwrite/${line}/quotations/${id}`,
  quotationEdit: (line: string, id: string) =>
    `/apps/underwrite/${line}/quotations/${id}/edit`,
  policies: (line: string) => `/apps/underwrite/${line}/policies`,
  policyDetail: (line: string, id: string) =>
    `/apps/underwrite/${line}/policies/${id}`,
  policyEndorsementCreate: (line: string, policyId: string) =>
    `/apps/underwrite/${line}/policies/${policyId}/endorsements/new`,
  policyEndorsementEdit: (
    line: string,
    policyId: string,
    endorsementId: string,
  ) =>
    `/apps/underwrite/${line}/policies/${policyId}/endorsements/${endorsementId}`,
  policyCancellationCreate: (line: string, policyId: string) =>
    `/apps/underwrite/${line}/policies/${policyId}/cancellations/new`,
  policyCancellationDetail: (
    line: string,
    policyId: string,
    cancellationId: string,
  ) =>
    `/apps/underwrite/${line}/policies/${policyId}/cancellations/${cancellationId}`,
  policyRenewalDetail: (line: string, policyId: string, renewalId: string) =>
    `/apps/underwrite/${line}/policies/${policyId}/renewals/${renewalId}`,
  endorsements: (line: string) => `/apps/underwrite/${line}/endorsements`,
  cancellations: (line: string) => `/apps/underwrite/${line}/cancellations`,
  renewals: (line: string) => `/apps/underwrite/${line}/renewals`,
  tiraPending: (line: string) => `/apps/underwrite/${line}/tira-pending`,
  tiraFailed: (line: string) => `/apps/underwrite/${line}/tira-failed`,
};

const TYPE: Record<'motor' | 'fleet', MotorInsuranceType> = {
  motor: 'single',
  fleet: 'fleet',
};

const TABS: Array<[keyof typeof legacyPaths, MotorTransactionTab]> = [
  ['endorsements', 'endorsements'],
  ['cancellations', 'cancellations'],
  ['renewals', 'renewals'],
  ['tiraPending', 'tira-pending'],
];

/**
 * MF-7: old Motor and Fleet quotation, policy and transaction URLs (deep
 * links, bookmarks, e-mails) open the same records in the Motor Insurance
 * module. Customer URLs use the shared customer pages, and retired fleet-register
 * URLs open Fleet quotations. Line dashboards and the vehicle register remain.
 */
export function renderLegacyMotorRedirects() {
  return (['motor', 'fleet'] as const).flatMap((slug) => {
    const line = slug as UnderwriteLineSlug;
    const routes: Array<[string, (params: Params) => string]> = [
      [
        legacyPaths.tiraFailed(line),
        () => motorInsurancePaths.failedSubmissions,
      ],
      [legacyPaths.customers(line), () => motorInsurancePaths.customers],
      [
        legacyPaths.customerCreate(line),
        () => motorInsurancePaths.customerCreate,
      ],
      [
        legacyPaths.customerDetail(line, ':id'),
        (p) => motorInsurancePaths.customerDetail(p.id!),
      ],
      [
        legacyPaths.customerEdit(line, ':id'),
        (p) => motorInsurancePaths.customerEdit(p.id!),
      ],
      [legacyPaths.quotations(line), () => motorInsurancePaths.quotations],
      [
        legacyPaths.quotationCreate(line),
        () => motorInsurancePaths.quotationCreate(TYPE[slug]),
      ],
      [
        legacyPaths.quotationDetail(line, ':id'),
        (p) => motorInsurancePaths.quotationDetail(p.id!),
      ],
      [
        legacyPaths.quotationEdit(line, ':id'),
        (p) => motorInsurancePaths.quotationEdit(p.id!),
      ],
      [legacyPaths.policies(line), () => motorInsurancePaths.policies],
      [
        legacyPaths.policyDetail(line, ':id'),
        (p) => motorInsurancePaths.policyDetail(p.id!),
      ],
      [
        legacyPaths.policyEndorsementCreate(line, ':policyId'),
        (p) => motorInsurancePaths.policyEndorsementCreate(p.policyId!),
      ],
      [
        legacyPaths.policyEndorsementEdit(line, ':policyId', ':endorsementId'),
        (p) =>
          motorInsurancePaths.policyEndorsementEdit(
            p.policyId!,
            p.endorsementId!,
          ),
      ],
      [
        legacyPaths.policyCancellationCreate(line, ':policyId'),
        (p) => motorInsurancePaths.policyCancellationCreate(p.policyId!),
      ],
      [
        legacyPaths.policyCancellationDetail(
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
        legacyPaths.policyRenewalDetail(line, ':policyId', ':renewalId'),
        (p) =>
          motorInsurancePaths.policyRenewalDetail(p.policyId!, p.renewalId!),
      ],
      ...TABS.map(
        ([key, tab]) =>
          [
            (legacyPaths[key] as (l: UnderwriteLineSlug) => string)(line),
            () => motorInsurancePaths.transactions(tab),
          ] as [string, (params: Params) => string],
      ),
    ];

    // The standalone fleet register UI is retired. Old bookmarks open fleet quotations.
    if (slug === 'fleet') {
      for (const suffix of ['', '/new', '/:id', '/:id/edit']) {
        routes.push([
          `/apps/underwrite/fleet/fleets${suffix}`,
          () => motorInsurancePaths.quotations + '?type=fleet',
        ]);
      }
    }
    return routes.map(([path, to]) => (
      <Route
        key={`legacy:${path}`}
        path={path}
        element={<LegacyRedirect to={to} />}
      />
    ));
  });
}
