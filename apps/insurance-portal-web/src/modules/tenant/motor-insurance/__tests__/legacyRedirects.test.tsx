import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderLegacyMotorRedirects } from '../legacyRedirects';

function Landing() {
  const location = useLocation();
  return <div data-testid="landing">{location.pathname + location.search}</div>;
}

function landAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {renderLegacyMotorRedirects()}
        {/* Generic line route, as in the Underwrite module: must lose. */}
        <Route
          path="/apps/underwrite/:line/quotations/:id"
          element={<div data-testid="landing">old page</div>}
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId('landing').textContent;
}

describe('MF-7 legacy Motor/Fleet redirects', () => {
  it.each([
    ['/apps/underwrite/motor/quotations', '/apps/motor/quotations'],
    [
      '/apps/underwrite/fleet/quotations/new',
      '/apps/motor/quotations/new?type=fleet',
    ],
    [
      '/apps/underwrite/motor/quotations/new',
      '/apps/motor/quotations/new?type=single',
    ],
    ['/apps/underwrite/fleet/quotations/q-1', '/apps/motor/quotations/q-1'],
    [
      '/apps/underwrite/motor/quotations/q-1/edit',
      '/apps/motor/quotations/q-1/edit',
    ],
    ['/apps/underwrite/fleet/policies', '/apps/motor/policies'],
    ['/apps/underwrite/fleet/policies/p-1', '/apps/motor/policies/p-1'],
    [
      '/apps/underwrite/fleet/policies/p-1/endorsements/e-1',
      '/apps/motor/policies/p-1/endorsements/e-1',
    ],
    [
      '/apps/underwrite/motor/policies/p-1/cancellations/new',
      '/apps/motor/policies/p-1/cancellations/new',
    ],
    [
      '/apps/underwrite/motor/policies/p-1/renewals/r-1',
      '/apps/motor/policies/p-1/renewals/r-1',
    ],
    [
      '/apps/underwrite/fleet/renewals',
      '/apps/motor/transactions?tab=renewals',
    ],
    [
      '/apps/underwrite/motor/tira-failed',
      '/apps/motor/transactions?tab=tira-failed',
    ],
  ])('redirects %s to %s', (from, to) => {
    expect(landAt(from)).toBe(to);
  });

  it('keeps the query string', () => {
    expect(
      landAt(
        '/apps/underwrite/fleet/policies/p-1/endorsements/new?type=FLEET_ADD_VEHICLE',
      ),
    ).toBe('/apps/motor/policies/p-1/endorsements/new?type=FLEET_ADD_VEHICLE');
  });

  it.each([
    '/apps/underwrite/motor/vehicles',
    '/apps/underwrite/fleet/fleets',
    '/apps/underwrite/motor/customers',
    '/apps/underwrite/fleet/dashboard',
    '/apps/underwrite/non-motor/quotations',
  ])('does not redirect %s', (url) => {
    expect(landAt(url)).toBe(url);
  });
});
