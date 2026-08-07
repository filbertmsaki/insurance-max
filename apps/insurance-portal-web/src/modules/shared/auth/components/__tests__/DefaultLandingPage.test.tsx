import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import { DefaultLandingPage } from '../DefaultLandingPage';

function renderWithRoutes() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DefaultLandingPage />} />
        <Route path="/dashboard" element={<div>internal-dashboard</div>} />
        <Route path="/customer/dashboard" element={<div>customer-dashboard</div>} />
        <Route
          path="/intermediary/dashboard"
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
        permissions: ['portal:customer-access'],
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

    expect(await screen.findByText('intermediary-dashboard')).toBeInTheDocument();
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
});
