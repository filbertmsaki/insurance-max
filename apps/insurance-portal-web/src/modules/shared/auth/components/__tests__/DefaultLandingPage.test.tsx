import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { legacyAppRedirect } from '@/modules/shared/auth/app-paths';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import { DefaultLandingPage } from '../DefaultLandingPage';

function renderWithRoutes() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DefaultLandingPage />} />
        <Route path="/apps/dashboard" element={<div>internal-dashboard</div>} />
        <Route
          path="/apps/customer/dashboard"
          element={<div>customer-dashboard</div>}
        />
        <Route
          path="/apps/intermediary/dashboard"
          element={<div>intermediary-dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({
    user: null,
    authorizationContext: null,
  });
});

describe('DefaultLandingPage', () => {
  it('routes customer portal users to the customer dashboard', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'customer@example.com',
        scope: 'company',
        userType: 'CUSTOMER',
        companyId: 'company-1',
        roles: [],
        permissions: [],
      },
      authorizationContext: null,
    });

    renderWithRoutes();

    expect(await screen.findByText('customer-dashboard')).toBeInTheDocument();
  });

  it('routes standalone customer-scope users to the customer dashboard', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-standalone',
        email: 'standalone@example.com',
        scope: 'customer',
        userType: 'CUSTOMER',
        roles: [],
        permissions: [],
      },
      authorizationContext: null,
    });

    renderWithRoutes();

    expect(await screen.findByText('customer-dashboard')).toBeInTheDocument();
  });

  it('routes intermediary portal users to the intermediary dashboard', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-2',
        email: 'broker@example.com',
        scope: 'company',
        userType: 'BROKER',
        companyId: 'company-2',
        roles: [],
        permissions: ['portal:intermediary-access'],
      },
      authorizationContext: null,
    });

    renderWithRoutes();

    expect(
      await screen.findByText('intermediary-dashboard'),
    ).toBeInTheDocument();
  });

  it('falls back to the internal dashboard for non-portal users', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-3',
        email: 'staff@example.com',
        scope: 'company',
        userType: 'STAFF',
        companyId: 'company-3',
        roles: [],
        permissions: ['users:read'],
      },
      authorizationContext: null,
    });

    renderWithRoutes();

    expect(await screen.findByText('internal-dashboard')).toBeInTheDocument();
  });

  it('forwards pre-/apps links to their /apps location', async () => {
    function Probe() {
      const { pathname, search } = useLocation();
      return <div>{`at ${pathname}${search}`}</div>;
    }
    render(
      <MemoryRouter initialEntries={['/claims/claim-1?tab=documents']}>
        <Routes>
          <Route path="/apps/*" element={<Probe />} />
          <Route path="*" element={<DefaultLandingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('at /apps/claims/claim-1?tab=documents'),
    ).toBeInTheDocument();
  });

  it('does not treat public paths as legacy app links', () => {
    expect(legacyAppRedirect('/claim-help')).toBeNull();
    expect(legacyAppRedirect('/unknown-page')).toBeNull();
    expect(legacyAppRedirect('/finance/payments')).toBe(
      '/apps/finance/payments',
    );
  });
});
