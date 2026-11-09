import { createRoutesFromElements, matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderUnderwriteRoutes } from '@/modules/tenant/underwrite/routes';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { renderMotorInsuranceRoutes } from '../routes';
import { LegacyRedirect } from '../components/LegacyRedirect';

const underwrite = createRoutesFromElements(renderUnderwriteRoutes());
const motor = createRoutesFromElements(renderMotorInsuranceRoutes());
describe('Permanent unified Motor Insurance routes', () => {
  it('retires the standalone TIRAMIS exceptions page', () => {
    const match = matchRoutes(motor, '/apps/motor/tira-failed')?.at(-1);
    expect(match?.route.element).toHaveProperty(
      'props.to',
      '/apps/motor/quotations?tira_status=FAILED',
    );
  });
  for (const line of ['motor', 'fleet'] as const) {
    it.each([
      'customers',
      'customers/new',
      'customers/c-1',
      'customers/c-1/edit',
      'quotations',
      'quotations/new',
      'quotations/q-1',
      'quotations/q-1/edit',
      'policies',
      'policies/p-1',
      'policies/p-1/endorsements/new',
      'policies/p-1/endorsements/e-1',
      'policies/p-1/cancellations/new',
      'policies/p-1/cancellations/c-1',
      'policies/p-1/renewals/r-1',
      'endorsements',
      'cancellations',
      'renewals',
      'tira-pending',
      'tira-failed',
    ])(line + ': %s has no standalone legacy page', (suffix) => {
      const url = '/apps/underwrite/' + line + '/' + suffix;
      expect(matchRoutes(underwrite, url)).toBeNull();
      const match = matchRoutes(motor, url)?.at(-1);
      expect(match?.route.element).toHaveProperty('type', LegacyRedirect);
    });
    it(line + ': generates canonical business links', () => {
      expect(underwritePaths.quotations(line)).toBe('/apps/motor/quotations');
      expect(underwritePaths.policyDetail(line, 'p-1')).toBe(
        '/apps/motor/policies/p-1',
      );
      expect(underwritePaths.endorsements(line)).toBe(
        '/apps/motor/endorsements',
      );
    });
  }
  it.each(['', '/new', '/fleet-1', '/fleet-1/edit'])(
    'retires the standalone fleet register %s',
    (suffix) => {
      const url = '/apps/underwrite/fleet/fleets' + suffix;
      expect(matchRoutes(underwrite, url)).toBeNull();
      expect(matchRoutes(motor, url)?.at(-1)?.route.element).toHaveProperty(
        'type',
        LegacyRedirect,
      );
    },
  );
  it.each([
    'quotations',
    'quotations/new',
    'quotations/q-1',
    'policies',
    'policies/p-1',
    'endorsements',
    'cancellations',
    'renewals',
    'tira-pending',
  ])('preserves Non-Motor %s', (suffix) => {
    expect(
      matchRoutes(underwrite, '/apps/underwrite/non-motor/' + suffix),
    ).not.toBeNull();
  });
});
