import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { DashboardPage } from '../DashboardPage';
import type {
  DashboardCapabilitiesResponse,
  OverviewResponse,
} from '@/modules/shared/dashboard/api/dashboard';

const dashboardMocks = vi.hoisted(() => ({
  getCapabilities: vi.fn(),
  getOverview: vi.fn(),
  getSection: vi.fn(),
  getExecutiveDashboard: vi.fn(),
}));

vi.mock('@/modules/shared/dashboard/api/dashboard', async () => {
  const actual = await vi.importActual(
    '@/modules/shared/dashboard/api/dashboard',
  );

  return {
    ...actual,
    dashboardApi: {
      getCapabilities: dashboardMocks.getCapabilities,
      getOverview: dashboardMocks.getOverview,
      getSection: dashboardMocks.getSection,
    },
  };
});

vi.mock('@/modules/tenant/analytics/api', () => ({
  analyticsApi: {
    getExecutiveDashboard: dashboardMocks.getExecutiveDashboard,
  },
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function createCapabilities(
  overrides?: Partial<DashboardCapabilitiesResponse['sections']>,
): DashboardCapabilitiesResponse {
  return {
    organization: {
      company_id: 'company-1',
      company_name: 'Alliance',
      company_type: 'INSURANCE_COMPANY',
    },
    user: {
      user_id: 'user-1',
      user_type: 'STAFF',
      roles: ['UNDERWRITER'],
    },
    scope: {
      active_branch_id: 'branch-1',
      assigned_branch_ids: ['branch-1'],
      allowed_branch_ids: ['branch-1'],
      can_view_all_branches: false,
      own_records_only: false,
      can_view_carrier_portfolio: false,
      can_view_intermediary_portfolio: false,
    },
    sections: {
      overview: true,
      sales: true,
      policies: true,
      finance: true,
      commissions: true,
      tiramis: true,
      tasks: true,
      claims: false,
      reinsurance: true,
      endorsements: false,
      renewals: false,
      subscriptions: false,
      ...overrides,
    },
    navigation: [],
  };
}

function createOverview(
  capabilities: DashboardCapabilitiesResponse,
): OverviewResponse {
  return {
    context: {
      period: {
        from: '2026-08-01',
        to: '2026-08-14',
        group_by: 'DAY',
        timezone: 'Africa/Dar_es_Salaam',
      },
      filters: {
        branch_id: null,
        product_id: null,
        channel_type: null,
        currency: null,
        limit: 10,
      },
      scope: {
        company_id: 'company-1',
        active_branch_id: 'branch-1',
        allowed_branch_ids: ['branch-1'],
        can_view_all_branches: false,
        own_records_only: false,
      },
    },
    capabilities,
    kpis: {
      quotations: {
        total_quotations: 10,
        completed_quotations: 7,
        pending_approval: 2,
        awaiting_payment: 1,
        ready_for_tiramis: 1,
        failed_tiramis: 0,
        eligible_for_conversion: 8,
        converted_quotations: 5,
        conversion_rate: 62.5,
        quoted_premium: [{ currency: 'TZS', amount: '1000.00' }],
        can_view_partner_portfolio: false,
        company_type: 'INSURANCE_COMPANY',
      },
      policies: {
        total_policies: 15,
        active_policies: 11,
        expired_policies: 2,
        expiring_within_30_days: 3,
        pending_tiramis_sync: 1,
        total_premium: [{ currency: 'TZS', amount: '1500.00' }],
      },
      customers: {
        total_customers: 12,
        active_customers: 10,
      },
      finance: {
        total_invoices: 8,
        open_invoices: 3,
        overdue_invoices: 1,
        total_receipts: 5,
        invoiced_amount: [{ currency: 'TZS', amount: '900.00' }],
        outstanding_amount: [{ currency: 'TZS', amount: '250.00' }],
        collected_amount: [{ currency: 'TZS', amount: '650.00' }],
        finance_visibility_mode: 'ACTIVE_COMPANY_ONLY',
      },
      commissions: {
        total_transactions: 4,
        pending_transactions: 1,
        paid_transactions: 3,
        accrued_amount: [{ currency: 'TZS', amount: '100.00' }],
        paid_amount: [{ currency: 'TZS', amount: '80.00' }],
      },
      tiramis: {
        total_submissions: 6,
        successful_submissions: 4,
        pending_submissions: 1,
        failed_submissions: 1,
        retryable_submissions: 1,
      },
    },
    charts: {
      quotation_trend: [],
      quotation_statuses: [],
      policy_trend: [],
      policy_statuses: [],
      tiramis_statuses: [],
    },
    work_queues: [],
    alerts: [],
    generated_at: '2026-08-14T10:00:00.000Z',
  };
}

function createSalesSection() {
  return {
    context: {
      period: {
        from: '2026-08-01',
        to: '2026-08-14',
        group_by: 'DAY' as const,
        timezone: 'Africa/Dar_es_Salaam',
      },
      filters: {
        branch_id: null,
        product_id: null,
        channel_type: null,
        currency: null,
        limit: 10,
      },
      scope: {
        company_id: 'company-1',
        active_branch_id: 'branch-1',
        allowed_branch_ids: ['branch-1'],
        can_view_all_branches: false,
        own_records_only: false,
      },
    },
    kpis: {
      total_quotations: 18,
      completed_quotations: 12,
      pending_approval: 3,
      awaiting_payment: 2,
      ready_for_tiramis: 1,
      failed_tiramis: 0,
      eligible_for_conversion: 14,
      converted_quotations: 9,
      conversion_rate: 64.29,
      quoted_premium: [{ currency: 'TZS', amount: '1200.00' }],
      can_view_partner_portfolio: false,
      company_type: 'INSURANCE_COMPANY',
    },
    charts: {
      trend: [],
      status_breakdown: [],
    },
    generated_at: '2026-08-14T10:10:00.000Z',
  };
}

function createTiramisSection() {
  return {
    context: {
      period: {
        from: '2026-08-01',
        to: '2026-08-14',
        group_by: 'DAY' as const,
        timezone: 'Africa/Dar_es_Salaam',
      },
      filters: {
        branch_id: null,
        product_id: null,
        channel_type: null,
        currency: null,
        limit: 10,
      },
      scope: {
        company_id: 'company-1',
        active_branch_id: 'branch-1',
        allowed_branch_ids: ['branch-1'],
        can_view_all_branches: false,
        own_records_only: false,
      },
    },
    kpis: {
      total_submissions: 22,
      successful_submissions: 18,
      pending_submissions: 2,
      failed_submissions: 2,
      retryable_submissions: 1,
    },
    charts: {
      status_breakdown: [],
    },
    recent_failures: [],
    generated_at: '2026-08-14T10:20:00.000Z',
  };
}

function renderDashboard(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/apps/dashboard" element={<DashboardPage />} />
          <Route path="/apps/dashboard/:tab" element={<DashboardPage />} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage route tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'staff@example.com',
        scope: 'company',
        userType: 'STAFF',
        companyId: 'company-1',
        companyName: 'Alliance',
        roles: ['UNDERWRITER'],
        permissions: [
          'dashboard:overview',
          'dashboard:sales',
          'dashboard:tiramis',
        ],
      },
      authorizationContext: null,
    });
  });

  afterEach(() => {
    useAuthStore.setState({
      user: null,
      authorizationContext: null,
    });
  });

  it('loads the sales dashboard section for /dashboard/sales', async () => {
    const capabilities = createCapabilities();
    dashboardMocks.getCapabilities.mockResolvedValue(capabilities);
    dashboardMocks.getOverview.mockResolvedValue(createOverview(capabilities));
    dashboardMocks.getExecutiveDashboard.mockResolvedValue({
      widgets: [],
    });
    dashboardMocks.getSection.mockImplementation(async (section: string) => {
      if (section === 'sales') return createSalesSection();
      throw new Error(`Unexpected section ${section}`);
    });

    renderDashboard('/apps/dashboard/sales');

    expect(await screen.findByText('Total quotations')).toBeInTheDocument();
    expect(screen.getByText('Conversion rate')).toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/apps/dashboard/sales',
    );
  });

  it('loads the tiramis dashboard section for /dashboard/tiramis', async () => {
    const capabilities = createCapabilities();
    dashboardMocks.getCapabilities.mockResolvedValue(capabilities);
    dashboardMocks.getOverview.mockResolvedValue(createOverview(capabilities));
    dashboardMocks.getExecutiveDashboard.mockResolvedValue({
      widgets: [],
    });
    dashboardMocks.getSection.mockImplementation(async (section: string) => {
      if (section === 'tiramis') return createTiramisSection();
      throw new Error(`Unexpected section ${section}`);
    });

    renderDashboard('/apps/dashboard/tiramis');

    expect(await screen.findByText('Total submissions')).toBeInTheDocument();
    expect(screen.getByText('Retryable queue')).toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/apps/dashboard/tiramis',
    );
  });

  it('redirects an invalid dashboard tab to the first allowed tab', async () => {
    const capabilities = createCapabilities({
      overview: false,
      sales: true,
      policies: false,
      finance: false,
      commissions: false,
      tiramis: true,
      tasks: false,
      reinsurance: false,
    });
    dashboardMocks.getCapabilities.mockResolvedValue(capabilities);
    dashboardMocks.getOverview.mockResolvedValue(createOverview(capabilities));
    dashboardMocks.getExecutiveDashboard.mockResolvedValue({
      widgets: [],
    });
    dashboardMocks.getSection.mockImplementation(async (section: string) => {
      if (section === 'sales') return createSalesSection();
      throw new Error(`Unexpected section ${section}`);
    });

    renderDashboard('/apps/dashboard/not-a-real-tab');

    expect(await screen.findByText('Total quotations')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/apps/dashboard/sales',
      );
    });
  });
});
