import { apiClient } from '@/modules/shared/api/client';

export type DashboardGroupBy = 'DAY' | 'WEEK' | 'MONTH';

export interface DashboardQueryParams {
  from?: string;
  to?: string;
  group_by?: DashboardGroupBy;
  limit?: number;
}

export type DashboardSectionId =
  | 'overview'
  | 'sales'
  | 'policies'
  | 'finance'
  | 'commissions'
  | 'tiramis'
  | 'tasks'
  | 'reinsurance';

export interface DashboardContext {
  period: {
    from: string;
    to: string;
    group_by: DashboardGroupBy;
    timezone: string;
  };
  filters: {
    branch_id: string | null;
    product_id: string | null;
    channel_type: string | null;
    currency: string | null;
    limit: number;
  };
  scope: {
    company_id: string;
    active_branch_id: string | null;
    allowed_branch_ids: string[];
    can_view_all_branches: boolean;
    own_records_only: boolean;
  };
}

export interface DashboardNavigationItem {
  id: DashboardSectionId | 'claims';
  label: string;
  path: string | null;
  enabled: boolean;
  coming_soon?: boolean;
}

export interface DashboardCapabilitiesResponse {
  organization: {
    company_id?: string;
    company_name?: string;
    company_type?: string;
  };
  user: {
    user_id: string;
    user_type: string;
    roles: string[];
  };
  scope: {
    active_branch_id: string | null;
    assigned_branch_ids: string[];
    allowed_branch_ids: string[];
    can_view_all_branches: boolean;
    own_records_only: boolean;
    can_view_carrier_portfolio: boolean;
    can_view_intermediary_portfolio: boolean;
  };
  sections: {
    overview: boolean;
    sales: boolean;
    policies: boolean;
    finance: boolean;
    commissions: boolean;
    tiramis: boolean;
    tasks: boolean;
    claims: boolean;
    reinsurance: boolean;
    endorsements: boolean;
    renewals: boolean;
    subscriptions: boolean;
  };
  navigation: DashboardNavigationItem[];
}

export interface MoneyAmount {
  currency: string;
  amount: string;
}

export interface CountBreakdownItem {
  label: string;
  count: number;
}

export interface SalesKpis {
  total_quotations: number;
  completed_quotations: number;
  pending_approval: number;
  awaiting_payment: number;
  ready_for_tiramis: number;
  failed_tiramis: number;
  eligible_for_conversion: number;
  converted_quotations: number;
  conversion_rate: number;
  quoted_premium: MoneyAmount[];
  can_view_partner_portfolio: boolean;
  company_type?: string;
}

export interface PoliciesKpis {
  total_policies: number;
  active_policies: number;
  expired_policies: number;
  expiring_within_30_days: number;
  pending_tiramis_sync: number;
  total_premium: MoneyAmount[];
}

export interface CustomersKpis {
  total_customers: number;
  active_customers: number;
}

export interface CommissionsKpis {
  total_transactions: number;
  pending_transactions: number;
  paid_transactions: number;
  accrued_amount: MoneyAmount[];
  paid_amount: MoneyAmount[];
}

export interface FinanceKpis {
  total_invoices: number;
  open_invoices: number;
  overdue_invoices: number;
  total_receipts: number;
  invoiced_amount: MoneyAmount[];
  outstanding_amount: MoneyAmount[];
  collected_amount: MoneyAmount[];
  finance_visibility_mode: string;
}

export interface TiramisKpis {
  total_submissions: number;
  successful_submissions: number;
  pending_submissions: number;
  failed_submissions: number;
  retryable_submissions: number;
}

export interface OverviewResponse {
  context: DashboardContext;
  capabilities: DashboardCapabilitiesResponse;
  kpis: {
    quotations: SalesKpis;
    policies: PoliciesKpis;
    customers: CustomersKpis;
    finance: FinanceKpis;
    commissions: CommissionsKpis | null;
    tiramis: TiramisKpis;
  };
  charts: {
    quotation_trend: Array<{
      period: string;
      currency: string;
      quotation_count: number;
      quoted_premium: string;
    }>;
    quotation_statuses: CountBreakdownItem[];
    policy_trend: Array<{
      period: string;
      currency: string;
      policy_count: number;
      total_premium: string;
    }>;
    policy_statuses: CountBreakdownItem[];
    tiramis_statuses: CountBreakdownItem[];
  };
  work_queues: TaskQueue[];
  alerts: TaskAlert[];
  generated_at: string;
}

export interface SalesResponse {
  context: DashboardContext;
  kpis: SalesKpis;
  charts: {
    trend: Array<{
      period: string;
      currency: string;
      quotation_count: number;
      quoted_premium: string;
    }>;
    status_breakdown: CountBreakdownItem[];
  };
  generated_at: string;
}

export interface PoliciesResponse {
  context: DashboardContext;
  kpis: PoliciesKpis;
  charts: {
    trend: Array<{
      period: string;
      currency: string;
      policy_count: number;
      total_premium: string;
    }>;
    status_breakdown: CountBreakdownItem[];
  };
  generated_at: string;
}

export interface FinanceResponse {
  context: DashboardContext;
  kpis: FinanceKpis;
  charts: {
    invoice_trend: Array<{
      period: string;
      currency: string;
      invoice_count: number;
      invoiced_amount: string;
    }>;
    receipt_trend: Array<{
      period: string;
      currency: string;
      receipt_count: number;
      collected_amount: string;
    }>;
  };
  commissions: {
    kpis: CommissionsKpis;
    charts: {
      status_breakdown: Array<{
        status: string;
        currency: string;
        count: number;
        amount: string;
      }>;
    };
  } | null;
  generated_at: string;
}

export interface CommissionsResponse {
  context: DashboardContext;
  kpis: CommissionsKpis;
  charts: {
    status_breakdown: Array<{
      status: string;
      currency: string;
      count: number;
      amount: string;
    }>;
  };
  generated_at: string;
}

export interface TiramisResponse {
  context: DashboardContext;
  kpis: TiramisKpis;
  charts: {
    status_breakdown: CountBreakdownItem[];
  };
  recent_failures: Array<{
    tracking_id: string;
    business_reference: string | null;
    status: string;
    last_error_message: string | null;
    created_at: string;
  }>;
  generated_at: string;
}

export interface TaskQueue {
  key: string;
  label: string;
  count: number;
}

export interface TaskAlert {
  code: string;
  severity: 'high' | 'medium';
  message: string;
}

export interface TasksResponse {
  context: DashboardContext;
  queues: TaskQueue[];
  alerts: TaskAlert[];
  totals: {
    open_items: number;
  };
  generated_at: string;
}

export interface ReinsuranceResponse {
  context: DashboardContext;
  kpis: {
    treaties_total: number;
    treaties_active: number;
    cessions_total: number;
    cessions_active: number;
    cessions_declared: number;
    declarations_ready: number;
    declarations_submitted: number;
    declarations_accepted: number;
    recoveries_open: number;
    recoveries_expected_amount: string;
    recoveries_received_amount: string;
    recoveries_outstanding_amount: string;
    settlements_total: number;
    settlements_in_flight: number;
    settlements_net_amount: string;
    settlements_paid_amount: string;
    settlements_balance_amount: string;
  };
  charts: {
    declaration_trend: Array<{
      period: string;
      status: string;
      count: number;
    }>;
  };
  generated_at: string;
}

export type DashboardSectionResponse =
  | SalesResponse
  | PoliciesResponse
  | FinanceResponse
  | CommissionsResponse
  | TiramisResponse
  | TasksResponse
  | ReinsuranceResponse;

const sectionEndpoints: Record<
  Exclude<DashboardSectionId, 'overview'>,
  string
> = {
  sales: '/tenant/dashboard/sales',
  policies: '/tenant/dashboard/policies',
  finance: '/tenant/dashboard/finance',
  commissions: '/tenant/dashboard/commissions',
  tiramis: '/tenant/dashboard/tiramis',
  tasks: '/tenant/dashboard/tasks',
  reinsurance: '/tenant/dashboard/reinsurance',
};

export const dashboardApi = {
  getCapabilities() {
    return apiClient
      .get<DashboardCapabilitiesResponse>('/tenant/dashboard/capabilities')
      .then((response) => response.data);
  },

  getOverview(params?: DashboardQueryParams) {
    return apiClient
      .get<OverviewResponse>('/tenant/dashboard', { params })
      .then((response) => response.data);
  },

  getSection(
    section: Exclude<DashboardSectionId, 'overview'>,
    params?: DashboardQueryParams,
  ) {
    return apiClient
      .get<DashboardSectionResponse>(sectionEndpoints[section], { params })
      .then((response) => response.data);
  },
};
