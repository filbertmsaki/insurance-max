import { matchPath, type Params } from 'react-router-dom';
import { getUnderwriteLineMetaBySlug } from '@/modules/tenant/underwrite/lines';
import { CLAIM_QUEUES } from '@/modules/tenant/claims/constants';

type TitleResolver = string | ((params: Params) => string);

/**
 * Page names for every authenticated route, keyed by React Router pattern.
 * Public website and auth pages set their own titles via `usePageMeta`, so
 * they are intentionally absent: a path with no entry leaves the title alone.
 *
 * Static segments must come before params that could swallow them
 * (`quotations/new` before `quotations/:id`); the first match wins.
 */
const ROUTE_TITLES: [string, TitleResolver][] = [];

function route(pattern: string, title: TitleResolver) {
  ROUTE_TITLES.push([pattern, title]);
}

function lineLabel(params: Params) {
  return getUnderwriteLineMetaBySlug(params.line)?.label ?? 'Underwrite';
}

function withLine(suffix: string) {
  return (params: Params) => `${lineLabel(params)} ${suffix}`;
}

// ── Workspace ────────────────────────────────────────────────────────────────
route('/apps/dashboard', 'Dashboard');
route('/apps/dashboard/:tab', 'Dashboard');
route('/apps/forbidden', 'Access Denied');

// ── Underwrite ───────────────────────────────────────────────────────────────
// Unified Motor Insurance is the sole Motor/Fleet business module.
route('/apps/motor', 'Motor Insurance');
route('/apps/motor/customers', 'Customers');
route('/apps/motor/customers/new', 'New Customer');
route('/apps/motor/customers/:id/edit', 'Edit Customer');
route('/apps/motor/customers/:id', 'Customer Details');
route('/apps/motor/quotations', 'Motor Quotations');
route('/apps/motor/quotations/new', 'New Motor Quotation');
route('/apps/motor/quotations/:id/edit', 'Edit Motor Quotation');
route('/apps/motor/quotations/:id', 'Motor Quotation Details');
route('/apps/motor/policies', 'Motor Policies');
route(
  '/apps/motor/policies/:policyId/endorsements/new',
  'New Policy Endorsement',
);
route(
  '/apps/motor/policies/:policyId/endorsements/:endorsementId',
  'Policy Endorsement',
);
route(
  '/apps/motor/policies/:policyId/cancellations/new',
  'New Policy Cancellation',
);
route(
  '/apps/motor/policies/:policyId/cancellations/:cancellationId',
  'Policy Cancellation',
);
route('/apps/motor/policies/:policyId/renewals/:renewalId', 'Policy Renewal');
route('/apps/motor/policies/:id', 'Motor Policy Details');
route('/apps/motor/transactions', 'Motor Insurance');
route('/apps/motor/endorsements', 'Motor Endorsements');
route('/apps/motor/renewals', 'Motor Renewals');
route('/apps/motor/cancellations', 'Motor Cancellations');
route('/apps/motor/tira-pending', 'TIRAMIS Pending');

const UW = '/apps/underwrite';
route(`${UW}/dashboard`, 'Underwrite Dashboard');
route(`${UW}/motor/vehicles`, 'Motor Vehicles');
route(`${UW}/motor/vehicles/new`, 'New Motor Vehicle');
route(`${UW}/motor/vehicles/:id/edit`, 'Edit Motor Vehicle');
route(`${UW}/motor/vehicles/:id`, 'Motor Vehicle Details');
route(`${UW}/non-motor/risks`, 'Non-Motor Risks');
route(`${UW}/non-motor/risks/new`, 'New Non-Motor Risk');
route(`${UW}/non-motor/risks/:id/edit`, 'Edit Non-Motor Risk');
route(`${UW}/non-motor/risks/:id`, 'Non-Motor Risk Details');
route(`${UW}/non-motor/risk-schemas`, 'Risk Schemas');
route(`${UW}/:line/dashboard`, withLine('Dashboard'));
route(`${UW}/:line/quotations`, withLine('Quotations'));
route(`${UW}/:line/quotations/new`, (p) => `New ${lineLabel(p)} Quotation`);
route(
  `${UW}/:line/quotations/:id/edit`,
  (p) => `Edit ${lineLabel(p)} Quotation`,
);
route(`${UW}/:line/quotations/:id`, withLine('Quotation Details'));
route(`${UW}/:line/policies`, withLine('Policies'));
route(
  `${UW}/:line/policies/:policyId/endorsements/new`,
  'New Policy Endorsement',
);
route(
  `${UW}/:line/policies/:policyId/endorsements/:endorsementId`,
  'Policy Endorsement',
);
route(
  `${UW}/:line/policies/:policyId/cancellations/new`,
  'New Policy Cancellation',
);
route(
  `${UW}/:line/policies/:policyId/cancellations/:cancellationId`,
  'Policy Cancellation',
);
route(`${UW}/:line/policies/:policyId/renewals/:renewalId`, 'Policy Renewal');
route(`${UW}/:line/policies/:id`, withLine('Policy Details'));
route(`${UW}/:line/customers`, withLine('Customers'));
route(`${UW}/:line/customers/new`, 'New Customer');
route(`${UW}/:line/customers/:id/edit`, 'Edit Customer');
route(`${UW}/:line/customers/:id`, 'Customer Details');
route(`${UW}/:line/renewals`, withLine('Renewals'));
route(`${UW}/:line/endorsements`, withLine('Endorsements'));
route(`${UW}/:line/cancellations`, withLine('Cancellations'));
route(`${UW}/:line/tira-failed`, withLine('Failed TIRA Submissions'));
route(`${UW}/:line/tira-pending`, withLine('Pending TIRA Submissions'));

// ── Claims ───────────────────────────────────────────────────────────────────
route('/apps/claims', 'Claims');
route('/apps/claims/new', 'New Claim');
route('/apps/claims/dashboard', 'Claims Dashboard');
route('/apps/claims/documents', 'Claim Documents');
route('/apps/claims/reports', 'Claims Reports');
route('/apps/claims/configuration', 'Claims Configuration');
route('/apps/claims/queue/:queue', ({ queue }) => {
  const label = CLAIM_QUEUES.find((item) => item.queue === queue)?.label;
  return label ? `${label} Queue` : 'Claims Queue';
});
route('/apps/claims/:id/edit', 'Edit Claim');
route('/apps/claims/:id', 'Claim Details');

// ── Engagement ───────────────────────────────────────────────────────────────
route('/apps/documents', 'Documents');
route('/apps/documents/:id', 'Document Details');
route('/apps/document-templates', 'Document Templates');
route('/apps/document-templates/:id', 'Document Template Details');
route('/apps/signatures', 'Signature Requests');
route('/apps/signatures/:id', 'Signature Request Details');
route('/apps/notifications', 'Notifications');
route('/apps/notification-preferences', 'Notification Preferences');
route('/apps/communications', 'Communications');
route('/apps/communications/:id', 'Communication Details');
route('/apps/work-items', 'Work Items');
route('/apps/work-items/:id', 'Work Item Details');
route('/apps/portal-requests', 'Portal Requests');
route('/apps/portal-requests/:id', 'Portal Request Details');
route('/apps/portal-invitations', 'Portal Invitations');

// ── Insights & compliance ────────────────────────────────────────────────────
route('/apps/analytics/metrics', 'Analytics');
route('/apps/platform-intelligence', 'Platform Intelligence');
route('/apps/reports', 'Reports');
route('/apps/regulatory', 'Regulatory');
route('/apps/reinsurance', 'Reinsurance');

// ── Organisation & access ────────────────────────────────────────────────────
route('/apps/users', 'Users');
route('/apps/users/new', 'New User');
route('/apps/users/:id/edit', 'Edit User');
route('/apps/users/:id', 'User Details');
route('/apps/roles', 'Roles');
route('/apps/permissions', 'Permissions');
route('/apps/companies', 'Companies');
route('/apps/companies/:id', 'Company Details');
route('/apps/my-company', 'My Company');
route('/apps/insurance-partners', 'Insurance Partners');
route('/apps/branches', 'Branches');
route('/apps/branches/:id', 'Branch Details');
route('/apps/sale-points', 'Sales Points');
route('/apps/company-features', 'Company Features');
route('/apps/departments', 'Departments');
route('/apps/departments/:id', 'Department Details');
route('/apps/endorsement-types', 'Endorsement Types');
route('/apps/complaints', 'Complaints');
route('/apps/complaints/:id', 'Complaint Details');
route('/apps/verifications', 'Verifications');

// ── Security & platform ──────────────────────────────────────────────────────
route('/apps/devices', 'Devices');
route('/apps/sessions', 'Sessions');
route('/apps/security-policy', 'Security Policy');
route('/apps/audit-logs', 'Audit Log');
route('/apps/api-clients', 'API Clients');
route('/apps/reference-data', 'Reference Data');
route('/apps/saas-billing', 'SaaS Billing');
route('/apps/platform/tiramis-integration', 'TIRAMIS Integration');

// ── Settings ─────────────────────────────────────────────────────────────────
route('/apps/settings/profile', 'Profile Settings');
route('/apps/settings/number-format', 'Number & Currency Settings');

// ── Product engine ───────────────────────────────────────────────────────────
const PE = '/apps/product-engine';
route(`${PE}/categories`, 'Insurance Categories');
route(`${PE}/products`, 'Insurance Products');
route(`${PE}/products/:productId`, 'Product Details');
route(`${PE}/sub-classes`, 'Sub-Classes');
route(`${PE}/risks`, 'Insurance Risks');
route(`${PE}/rating-factors`, 'Rating Factors');
route(`${PE}/rating-rules`, 'Rating Rules');
route(`${PE}/rate-books`, 'Rate Books');
route(`${PE}/rate-books/:rateBookId`, 'Rate Book Details');
route(`${PE}/taxes`, 'Taxes');
route(`${PE}/access/categories`, 'Category Access');
route(`${PE}/access/products`, 'Product Access');
route(`${PE}/calculator`, 'Premium Calculator');

// ── Finance ──────────────────────────────────────────────────────────────────
route('/apps/finance/dashboard', 'Finance Dashboard');
for (const [segment, plural, singular] of [
  ['invoices', 'Invoices', 'Invoice'],
  ['payments', 'Payments', 'Payment'],
  ['receipts', 'Receipts', 'Receipt'],
  ['refunds', 'Refunds', 'Refund'],
  ['reconciliation', 'Reconciliation', 'Reconciliation'],
  ['commission-accruals', 'Commission Accruals', 'Commission Accrual'],
  ['commission-payments', 'Commission Payments', 'Commission Payment'],
  ['journals', 'Journals', 'Journal'],
] as const) {
  route(`/apps/finance/${segment}`, plural);
  route(`/apps/finance/${segment}/:id`, `${singular} Details`);
}

// ── TIRAMIS ──────────────────────────────────────────────────────────────────
route('/apps/tiramis/dashboard', 'TIRAMIS Dashboard');
route('/apps/tiramis/health', 'TIRAMIS Health');
route('/apps/tiramis/tracking', 'TIRAMIS Tracking');
route('/apps/tiramis/failed', 'Failed TIRAMIS Submissions');
route('/apps/tiramis/retryable', 'Retryable TIRAMIS Submissions');
route('/apps/tiramis/submissions', 'TIRAMIS Submissions');
route('/apps/tiramis/submissions/:id', 'TIRAMIS Submission Details');

// ── Customer and intermediary portals ────────────────────────────────────────
const PORTAL_RESOURCES = [
  ['quotations', 'Quotations', 'Quotation'],
  ['policies', 'Policies', 'Policy'],
  ['invoices', 'Invoices', 'Invoice'],
  ['receipts', 'Receipts', 'Receipt'],
  ['claims', 'Claims', 'Claim'],
  ['complaints', 'Complaints', 'Complaint'],
  ['requests', 'Requests', 'Request'],
  ['customers', 'Customers', 'Customer'],
  ['messages', 'Messages', 'Message'],
  ['signatures', 'Signatures', 'Signature'],
] as const;

for (const audience of ['customer', 'intermediary'] as const) {
  const base = `/apps/${audience}`;
  route(base, 'Dashboard');
  route(`${base}/dashboard`, 'Dashboard');
  route(`${base}/profile`, 'Profile');
  route(`${base}/buy-cover`, 'Buy Cover');
  route(`${base}/check-cover`, 'Check Cover');
  route(`${base}/vehicles`, 'Vehicles');
  route(`${base}/insurer-connections`, 'Insurer Connections');
  route(`${base}/commissions`, 'Commissions');
  route(`${base}/commission-settlement-report`, 'Settlement Report');
  route(`${base}/documents`, 'Documents');
  route(`${base}/notifications`, 'Notifications');
  route(`${base}/customers/new`, 'New Customer');
  route(`${base}/customers/:id/edit`, 'Edit Customer');
  route(`${base}/quotations/new`, 'New Quotation');
  route(`${base}/quotations/:id/edit`, 'Edit Quotation');
  for (const [segment, plural, singular] of PORTAL_RESOURCES) {
    route(`${base}/${segment}`, plural);
    route(`${base}/${segment}/:id`, `${singular} Details`);
  }
}

/** Page name for an authenticated route, or `null` for routes that own their title. */
export function routeTitleFor(pathname: string): string | null {
  for (const [pattern, title] of ROUTE_TITLES) {
    const match = matchPath(pattern, pathname.split(/[?#]/, 1)[0]);
    if (match) return typeof title === 'string' ? title : title(match.params);
  }
  return null;
}

/** Every registered pattern, for route-coverage tests. */
export const ROUTE_TITLE_PATTERNS = ROUTE_TITLES.map(([pattern]) => pattern);
