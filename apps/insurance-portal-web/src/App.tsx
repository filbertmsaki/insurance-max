import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PortalShell } from '@/modules/portal/components/PortalShell';
import { PortalDashboardPage } from '@/modules/portal/pages/PortalDashboardPage';
import { PortalBuyCoverPage } from '@/modules/portal/pages/PortalBuyCoverPage';
import { PortalBusinessListPage } from '@/modules/portal/pages/PortalBusinessListPage';
import { IntermediarySettlementReportPage } from '@/modules/portal/pages/IntermediarySettlementReportPage';
import { PortalBusinessDetailPage } from '@/modules/portal/pages/PortalBusinessDetailPage';
import { IntermediaryCustomerFormPage } from '@/modules/portal/pages/IntermediaryCustomerFormPage';
import { IntermediaryQuotationFormPage } from '@/modules/portal/pages/IntermediaryQuotationFormPage';
import { IntermediaryRelationshipsPage } from '@/modules/portal/pages/IntermediaryRelationshipsPage';
import { PortalRequestsReviewPage } from '@/modules/portal/pages/PortalRequestsReviewPage';
import { PortalInvitationsPage } from '@/modules/portal/pages/PortalInvitationsPage';
import { SecurityPolicyPage } from '@/modules/tenant/security-policy/pages/SecurityPolicyPage';
import { PortalRequestReviewDetailPage } from '@/modules/portal/pages/PortalRequestReviewDetailPage';
import { PortalCoverCheckPage } from '@/modules/portal/pages/PortalCoverCheckPage';
import { PortalDocumentsPage } from '@/modules/portal/pages/PortalDocumentsPage';
import { PortalMessageDetailPage } from '@/modules/portal/pages/PortalMessageDetailPage';
import { PortalMessagesPage } from '@/modules/portal/pages/PortalMessagesPage';
import { PortalNotificationsPage } from '@/modules/portal/pages/PortalNotificationsPage';
import { PortalProfilePage } from '@/modules/portal/pages/PortalProfilePage';
import { PortalSignatureDetailPage } from '@/modules/portal/pages/PortalSignatureDetailPage';
import { PortalSignaturesPage } from '@/modules/portal/pages/PortalSignaturesPage';
import { PortalVehiclesPage } from '@/modules/portal/pages/PortalVehiclesPage';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import { GuestRoute } from '@/modules/shared/auth/components/GuestRoute';
import { AuthLayout } from '@/modules/shared/auth/components/AuthLayout';
import { DefaultLandingPage } from '@/modules/shared/auth/components/DefaultLandingPage';
import { ForbiddenPage } from '@/modules/shared/auth/pages/ForbiddenPage';
import { AuthBootstrap } from '@/modules/shared/auth/components/AuthBootstrap';
import { NumberFormatProvider } from '@/modules/shared/formatting/NumberFormatProvider';

import { LoginPage } from '@/modules/shared/auth/pages/LoginPage';
import { RegisterPage } from '@/modules/shared/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '@/modules/shared/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/modules/shared/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/modules/shared/auth/pages/VerifyEmailPage';
import { PhoneLoginPage } from '@/modules/shared/auth/pages/PhoneLoginPage';
import { PasswordlessPage } from '@/modules/shared/auth/pages/PasswordlessPage';
import { TwoFactorPage } from '@/modules/shared/auth/pages/TwoFactorPage';

import { DashboardPage } from '@/modules/shared/dashboard/pages/DashboardPage';
import { UsersListPage } from '@/modules/tenant/users/pages/UsersListPage';
import { UserDetailPage } from '@/modules/tenant/users/pages/UserDetailPage';
import { CompaniesListPage } from '@/modules/platform/companies/pages/CompaniesListPage';
import { CompanyDetailPage } from '@/modules/platform/companies/pages/CompanyDetailPage';
import { MyCompanyPage } from '@/modules/platform/companies/pages/MyCompanyPage';
import { NumberFormatSettingsPage } from '@/modules/platform/companies/pages/NumberFormatSettingsPage';
import { BranchesListPage } from '@/modules/tenant/branches/pages/BranchesListPage';
import { BranchDetailPage } from '@/modules/tenant/branches/pages/BranchDetailPage';
import { InsurancePartnersPage } from '@/modules/tenant/InsurancePartnersPage';
import { CompanyFeaturesPage } from '@/modules/tenant/company-features/pages/CompanyFeaturesPage';
import { DepartmentsPage } from '@/modules/tenant/departments/pages/DepartmentsPage';
import { DepartmentDetailPage } from '@/modules/tenant/departments/pages/DepartmentDetailPage';
import { RolesPage } from '@/modules/platform/roles/pages/RolesPage';
import { PermissionsPage } from '@/modules/platform/permissions/pages/PermissionsPage';
import { ReferenceDataPage } from '@/modules/platform/reference-data/pages/ReferenceDataPage';
import { AuditLogsPage } from '@/modules/shared/audit/pages/AuditLogsPage';
import { SalePointsPage } from '@/modules/tenant/sale-points/pages/SalePointsPage';
import { DevicesPage } from '@/modules/shared/devices/pages/DevicesPage';
import { SessionsPage } from '@/modules/shared/sessions/pages/SessionsPage';
import { ApiClientsPage } from '@/modules/platform/api-clients/pages/ApiClientsPage';
import { SaasBillingPage } from '@/modules/platform/saas-billing/pages/SaasBillingPage';
import { PlatformIntelligencePage } from '@/modules/platform/intelligence/pages/PlatformIntelligencePage';
import { ProfilePage } from '@/modules/shared/profile/pages/ProfilePage';
import { CategoriesPage } from '@/modules/tenant/product-engine/pages/categories/CategoriesPage';
import { ProductsPage } from '@/modules/tenant/product-engine/pages/products/ProductsPage';
import { ProductDetailPage } from '@/modules/tenant/product-engine/pages/products/ProductDetailPage';
import { SubClassesPage } from '@/modules/tenant/product-engine/pages/sub-classes/SubClassesPage';
import { RisksPage } from '@/modules/tenant/product-engine/pages/risks/RisksPage';
import { RatingFactorsPage } from '@/modules/tenant/product-engine/pages/rating-factors/RatingFactorsPage';
import { RatingRulesPage } from '@/modules/tenant/product-engine/pages/rating-rules/RatingRulesPage';
import { RateBooksPage } from '@/modules/tenant/product-engine/pages/rate-books/RateBooksPage';
import { RateBookDetailPage } from '@/modules/tenant/product-engine/pages/rate-books/RateBookDetailPage';
import { TaxesPage } from '@/modules/tenant/taxes/TaxesPage';
import { CategoryAccessPage } from '@/modules/tenant/product-engine/pages/access/categories/CategoryAccessPage';
import { ProductAccessPage } from '@/modules/tenant/product-engine/pages/access/products/ProductAccessPage';
import { CalculatorPage } from '@/modules/tenant/product-engine/pages/calculator/CalculatorPage';
import { renderClaimsRoutes } from '@/modules/tenant/claims/routes';
import { renderUnderwriteRoutes } from '@/modules/tenant/underwrite/routes';
import { EndorsementTypesPage } from '@/modules/tenant/policies/pages/EndorsementTypesPage';
import { ComplaintsPage } from '@/modules/tenant/complaints/pages/ComplaintsPage';
import { ComplaintDetailPage } from '@/modules/tenant/complaints/pages/ComplaintDetailPage';
import { TiramisSubmissionsPage } from '@/modules/tenant/tiramis/pages/TiramisSubmissionsPage';
import { TiramisSubmissionDetailPage } from '@/modules/tenant/tiramis/pages/TiramisSubmissionDetailPage';
import { TiramisDashboardPage } from '@/modules/tenant/tiramis/pages/TiramisDashboardPage';
import { TiramisHealthPage } from '@/modules/tenant/tiramis/pages/TiramisHealthPage';
import { TiramisTrackingPage } from '@/modules/tenant/tiramis/pages/TiramisTrackingPage';
import { TiramisFailedSubmissionsPage } from '@/modules/tenant/tiramis/pages/TiramisFailedSubmissionsPage';
import { TiramisRetryablePage } from '@/modules/tenant/tiramis/pages/TiramisRetryablePage';
import { PlatformTiramisIntegrationPage } from '@/modules/platform/tiramis-integration/pages/PlatformTiramisIntegrationPage';
import { VerificationsPage } from '@/modules/tenant/verifications/pages/VerificationsPage';
import { FinanceDashboardPage } from '@/modules/tenant/finance/pages/FinanceDashboardPage';
import { FinanceInvoicesPage } from '@/modules/tenant/finance/pages/FinanceInvoicesPage';
import { FinanceInvoiceDetailPage } from '@/modules/tenant/finance/pages/FinanceInvoiceDetailPage';
import { FinancePaymentsPage } from '@/modules/tenant/finance/pages/FinancePaymentsPage';
import { FinancePaymentDetailPage } from '@/modules/tenant/finance/pages/FinancePaymentDetailPage';
import { FinanceReceiptsPage } from '@/modules/tenant/finance/pages/FinanceReceiptsPage';
import { FinanceReceiptDetailPage } from '@/modules/tenant/finance/pages/FinanceReceiptDetailPage';
import { FinanceRefundsPage } from '@/modules/tenant/finance/pages/FinanceRefundsPage';
import { FinanceRefundDetailPage } from '@/modules/tenant/finance/pages/FinanceRefundDetailPage';
import { FinanceReconciliationPage } from '@/modules/tenant/finance/pages/FinanceReconciliationPage';
import { FinanceReconciliationDetailPage } from '@/modules/tenant/finance/pages/FinanceReconciliationDetailPage';
import { FinanceCommissionAccrualsPage } from '@/modules/tenant/finance/pages/FinanceCommissionAccrualsPage';
import { FinanceCommissionAccrualDetailPage } from '@/modules/tenant/finance/pages/FinanceCommissionAccrualDetailPage';
import { FinanceCommissionPaymentsPage } from '@/modules/tenant/finance/pages/FinanceCommissionPaymentsPage';
import { FinanceCommissionPaymentDetailPage } from '@/modules/tenant/finance/pages/FinanceCommissionPaymentDetailPage';
import { FinanceJournalsPage } from '@/modules/tenant/finance/pages/FinanceJournalsPage';
import { FinanceJournalDetailPage } from '@/modules/tenant/finance/pages/FinanceJournalDetailPage';
import { ReinsuranceWorkbenchPage } from '@/modules/tenant/reinsurance/pages/ReinsuranceWorkbenchPage';
import { AnalyticsMetricsPage } from '@/modules/tenant/analytics/pages/AnalyticsMetricsPage';
import { CommunicationsPage } from '@/modules/tenant/engagement/pages/CommunicationsPage';
import { CommunicationDetailPage } from '@/modules/tenant/engagement/pages/CommunicationDetailPage';
import { DocumentDetailPage } from '@/modules/tenant/engagement/pages/DocumentDetailPage';
import { DocumentTemplateDetailPage } from '@/modules/tenant/engagement/pages/DocumentTemplateDetailPage';
import { DocumentTemplatesPage } from '@/modules/tenant/engagement/pages/DocumentTemplatesPage';
import { DocumentsPage } from '@/modules/tenant/engagement/pages/DocumentsPage';
import { NotificationPreferencesPage } from '@/modules/tenant/engagement/pages/NotificationPreferencesPage';
import { NotificationsPage } from '@/modules/tenant/engagement/pages/NotificationsPage';
import { PublicDocumentVerificationPage } from '@/modules/tenant/engagement/pages/PublicDocumentVerificationPage';
import { PublicSignaturePage } from '@/modules/tenant/engagement/pages/PublicSignaturePage';
import { SignatureRequestDetailPage } from '@/modules/tenant/engagement/pages/SignatureRequestDetailPage';
import { SignatureRequestsPage } from '@/modules/tenant/engagement/pages/SignatureRequestsPage';
import { WorkItemDetailPage } from '@/modules/tenant/engagement/pages/WorkItemDetailPage';
import { WorkItemsPage } from '@/modules/tenant/engagement/pages/WorkItemsPage';
import { ReportsWorkbenchPage } from '@/modules/tenant/reporting/pages/ReportsWorkbenchPage';
import { RegulatoryWorkbenchPage } from '@/modules/tenant/regulatory/pages/RegulatoryWorkbenchPage';
import {
  HomePage,
  AboutPage,
  ContactPage,
  InsurancePage,
  BuyCoverPage,
  MotorInsurancePurchasePage,
  ClaimsPage,
  FaqPage,
} from '@/modules/public/PublicWebsite';

export default function App() {
  return (
    <NumberFormatProvider>
      <AuthBootstrap />
      <Routes>
        {/* Guest-only routes */}
        <Route element={<AuthLayout />}>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/phone-login" element={<PhoneLoginPage />} />
            <Route path="/passwordless" element={<PasswordlessPage />} />
            <Route
              path="/passwordless/complete"
              element={<PasswordlessPage />}
            />
          </Route>

          {/* 2FA (needs tempToken, no full auth) */}
          <Route path="/2fa" element={<TwoFactorPage />} />
        </Route>
        <Route path="/apps/forbidden" element={<ForbiddenPage />} />
        <Route
          path="/documents/verify/:code"
          element={<PublicDocumentVerificationPage />}
        />
        <Route
          path="/signatures/respond/:token"
          element={<PublicSignaturePage />}
        />

        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/apps/customer"
            element={<PortalShell audience="customer" />}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={<PortalDashboardPage audience="customer" />}
            />
            <Route
              path="profile"
              element={<PortalProfilePage audience="customer" />}
            />
            <Route path="buy-cover" element={<PortalBuyCoverPage />} />
            <Route path="check-cover" element={<PortalCoverCheckPage />} />
            <Route path="vehicles" element={<PortalVehiclesPage />} />
            <Route
              path="quotations"
              element={
                <PortalBusinessListPage
                  audience="customer"
                  resource="quotations"
                />
              }
            />
            <Route
              path="quotations/:id"
              element={
                <PortalBusinessDetailPage
                  audience="customer"
                  resource="quotations"
                />
              }
            />
            <Route
              path="policies"
              element={
                <PortalBusinessListPage
                  audience="customer"
                  resource="policies"
                />
              }
            />
            <Route
              path="policies/:id"
              element={
                <PortalBusinessDetailPage
                  audience="customer"
                  resource="policies"
                />
              }
            />
            <Route
              path="invoices"
              element={
                <PortalBusinessListPage
                  audience="customer"
                  resource="invoices"
                />
              }
            />
            <Route
              path="invoices/:id"
              element={
                <PortalBusinessDetailPage
                  audience="customer"
                  resource="invoices"
                />
              }
            />
            <Route
              path="receipts"
              element={
                <PortalBusinessListPage
                  audience="customer"
                  resource="receipts"
                />
              }
            />
            <Route
              path="claims"
              element={
                <PortalBusinessListPage audience="customer" resource="claims" />
              }
            />
            <Route
              path="claims/:id"
              element={
                <PortalBusinessDetailPage
                  audience="customer"
                  resource="claims"
                />
              }
            />
            <Route
              path="complaints"
              element={
                <PortalBusinessListPage
                  audience="customer"
                  resource="complaints"
                />
              }
            />
            <Route
              path="complaints/:id"
              element={
                <PortalBusinessDetailPage
                  audience="customer"
                  resource="complaints"
                />
              }
            />
            <Route
              path="requests"
              element={
                <PortalBusinessListPage
                  audience="customer"
                  resource="requests"
                />
              }
            />
            <Route
              path="requests/:id"
              element={
                <PortalBusinessDetailPage
                  audience="customer"
                  resource="requests"
                />
              }
            />
            <Route
              path="documents"
              element={<PortalDocumentsPage audience="customer" />}
            />
            <Route
              path="notifications"
              element={<PortalNotificationsPage audience="customer" />}
            />
            <Route
              path="messages"
              element={<PortalMessagesPage audience="customer" />}
            />
            <Route
              path="messages/:id"
              element={<PortalMessageDetailPage audience="customer" />}
            />
            <Route
              path="signatures"
              element={<PortalSignaturesPage audience="customer" />}
            />
            <Route
              path="signatures/:id"
              element={<PortalSignatureDetailPage audience="customer" />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute anyPermissions={['portal:intermediary-access']} />
            }
          >
            <Route
              path="/apps/intermediary"
              element={<PortalShell audience="intermediary" />}
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={<PortalDashboardPage audience="intermediary" />}
              />
              <Route
                path="profile"
                element={<PortalProfilePage audience="intermediary" />}
              />
              <Route
                path="insurer-connections"
                element={<IntermediaryRelationshipsPage />}
              />
              <Route
                path="customers"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="customers"
                  />
                }
              />
              <Route
                path="customers/new"
                element={<IntermediaryCustomerFormPage />}
              />
              <Route
                path="customers/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="customers"
                  />
                }
              />
              <Route
                path="customers/:id/edit"
                element={<IntermediaryCustomerFormPage />}
              />
              <Route
                path="quotations"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="quotations"
                  />
                }
              />
              <Route
                path="quotations/new"
                element={<IntermediaryQuotationFormPage />}
              />
              <Route
                path="quotations/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="quotations"
                  />
                }
              />
              <Route
                path="quotations/:id/edit"
                element={<IntermediaryQuotationFormPage />}
              />
              <Route
                path="policies"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="policies"
                  />
                }
              />
              <Route
                path="policies/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="policies"
                  />
                }
              />
              <Route
                path="invoices"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="invoices"
                  />
                }
              />
              <Route
                path="invoices/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="invoices"
                  />
                }
              />
              <Route
                path="receipts"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="receipts"
                  />
                }
              />
              <Route
                path="claims"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="claims"
                  />
                }
              />
              <Route
                path="claims/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="claims"
                  />
                }
              />
              <Route
                path="complaints"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="complaints"
                  />
                }
              />
              <Route
                path="complaints/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="complaints"
                  />
                }
              />
              <Route
                path="commissions"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="commissions"
                  />
                }
              />
              <Route
                path="commission-settlement-report"
                element={<IntermediarySettlementReportPage />}
              />
              <Route
                path="requests"
                element={
                  <PortalBusinessListPage
                    audience="intermediary"
                    resource="requests"
                  />
                }
              />
              <Route
                path="requests/:id"
                element={
                  <PortalBusinessDetailPage
                    audience="intermediary"
                    resource="requests"
                  />
                }
              />
              <Route
                path="documents"
                element={<PortalDocumentsPage audience="intermediary" />}
              />
              <Route
                path="notifications"
                element={<PortalNotificationsPage audience="intermediary" />}
              />
              <Route
                path="messages"
                element={<PortalMessagesPage audience="intermediary" />}
              />
              <Route
                path="messages/:id"
                element={<PortalMessageDetailPage audience="intermediary" />}
              />
              <Route
                path="signatures"
                element={<PortalSignaturesPage audience="intermediary" />}
              />
              <Route
                path="signatures/:id"
                element={<PortalSignatureDetailPage audience="intermediary" />}
              />
            </Route>
          </Route>

          <Route element={<AppShell />}>
            <Route path="/apps/forbidden" element={<ForbiddenPage />} />
            <Route path="/apps/dashboard" element={<DashboardPage />} />
            <Route path="/apps/dashboard/:tab" element={<DashboardPage />} />

            {renderUnderwriteRoutes()}
            {renderClaimsRoutes()}

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={['analytics:metrics:read', 'analytics:read']}
                />
              }
            >
              <Route
                path="/apps/analytics/metrics"
                element={<AnalyticsMetricsPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={['documents:read', 'documents:register']}
                />
              }
            >
              <Route path="/apps/documents" element={<DocumentsPage />} />
              <Route
                path="/apps/documents/:id"
                element={<DocumentDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="document-templates:read" />
              }
            >
              <Route
                path="/apps/document-templates"
                element={<DocumentTemplatesPage />}
              />
              <Route
                path="/apps/document-templates/:id"
                element={<DocumentTemplateDetailPage />}
              />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="signatures:read" />}
            >
              <Route
                path="/apps/signatures"
                element={<SignatureRequestsPage />}
              />
              <Route
                path="/apps/signatures/:id"
                element={<SignatureRequestDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="notifications:read" />
              }
            >
              <Route
                path="/apps/notifications"
                element={<NotificationsPage />}
              />
              <Route
                path="/apps/notification-preferences"
                element={<NotificationPreferencesPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="communications:read" />
              }
            >
              <Route
                path="/apps/communications"
                element={<CommunicationsPage />}
              />
              <Route
                path="/apps/communications/:id"
                element={<CommunicationDetailPage />}
              />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="work-items:read" />}
            >
              <Route path="/apps/work-items" element={<WorkItemsPage />} />
              <Route
                path="/apps/work-items/:id"
                element={<WorkItemDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={[
                    'portal:request-read',
                    'portal:request-review',
                    'portal:request-complete',
                  ]}
                />
              }
            >
              <Route
                path="/apps/portal-requests"
                element={<PortalRequestsReviewPage />}
              />
              <Route
                path="/apps/portal-requests/:id"
                element={<PortalRequestReviewDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={[
                    'portal:account-read',
                    'portal:account-invite',
                  ]}
                />
              }
            >
              <Route
                path="/apps/portal-invitations"
                element={<PortalInvitationsPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="security-policies:read" />
              }
            >
              <Route
                path="/apps/security-policy"
                element={<SecurityPolicyPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={[
                    'reports:definition-read',
                    'reports:run',
                    'reports:job-read',
                    'reports:schedule-read',
                    'reports:definitions:read',
                  ]}
                />
              }
            >
              <Route path="/apps/reports" element={<ReportsWorkbenchPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={[
                    'regulatory:calendar-read',
                    'regulatory:return-read',
                    'regulatory:levy-read',
                    'regulatory-authorities:read',
                    'regulatory-obligations:read',
                    'regulatory-returns:read',
                    'regulatory-levies:read',
                  ]}
                />
              }
            >
              <Route
                path="/apps/regulatory"
                element={<RegulatoryWorkbenchPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission="users:read"
                  allowedScopes={['company']}
                />
              }
            >
              <Route path="/apps/users" element={<UsersListPage />} />
              <Route path="/apps/users/:id" element={<UserDetailPage />} />
            </Route>

            {/* Owner-only: manage all companies */}
            <Route
              element={<ProtectedRoute anyRole={['OWNER', 'SUPER_ADMIN']} />}
            >
              <Route path="/apps/companies" element={<CompaniesListPage />} />
              <Route
                path="/apps/companies/:id"
                element={<CompanyDetailPage />}
              />
            </Route>

            {/* Company-scoped users: view/edit their own company */}
            <Route
              element={
                <ProtectedRoute
                  requiredPermission="insurance-partners:read"
                  hideForStandardUser
                />
              }
            >
              <Route
                path="/apps/insurance-partners"
                element={<InsurancePartnersPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission="view_company_data"
                  hideForStandardUser
                />
              }
            >
              <Route path="/apps/my-company" element={<MyCompanyPage />} />
            </Route>

            {/* Branches: accessible to users with branches:read permission */}
            <Route
              element={
                <ProtectedRoute
                  requiredPermission="branches:read"
                  hideForStandardUser
                />
              }
            >
              <Route path="/apps/branches" element={<BranchesListPage />} />
              <Route path="/apps/branches/:id" element={<BranchDetailPage />} />
              <Route path="/apps/sale-points" element={<SalePointsPage />} />
              <Route
                path="/apps/company-features"
                element={<CompanyFeaturesPage />}
              />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="audit:read" />}>
              <Route path="/apps/audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission="departments:read"
                  hideForStandardUser
                />
              }
            >
              <Route path="/apps/departments" element={<DepartmentsPage />} />
              <Route
                path="/apps/departments/:id"
                element={<DepartmentDetailPage />}
              />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="roles:read" />}>
              <Route path="/apps/roles" element={<RolesPage />} />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="permissions:read" />}
            >
              <Route path="/apps/permissions" element={<PermissionsPage />} />
            </Route>

            <Route path="/apps/devices" element={<DevicesPage />} />
            <Route path="/apps/sessions" element={<SessionsPage />} />
            <Route
              element={<ProtectedRoute anyRole={['OWNER', 'SUPER_ADMIN']} />}
            >
              <Route
                path="/apps/reference-data"
                element={<ReferenceDataPage />}
              />
              <Route path="/apps/saas-billing" element={<SaasBillingPage />} />
              <Route
                path="/apps/platform-intelligence"
                element={<PlatformIntelligencePage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute anyRole={['SUPER_ADMIN', 'OWNER']} />}
            >
              <Route path="/apps/api-clients" element={<ApiClientsPage />} />
            </Route>
            <Route
              element={
                <ProtectedRoute
                  anyRole={['OWNER', 'SUPER_ADMIN']}
                  requiredPermission="platform:tiramis-integration:read"
                />
              }
            >
              <Route
                path="/apps/platform/tiramis-integration"
                element={<PlatformTiramisIntegrationPage />}
              />
            </Route>
            <Route path="/apps/settings/profile" element={<ProfilePage />} />
            <Route
              path="/apps/settings/number-format"
              element={<NumberFormatSettingsPage />}
            />

            <Route
              element={
                <ProtectedRoute
                  requiredPermission="endorsements:create"
                  hideForStandardUser
                />
              }
            >
              <Route
                path="/apps/endorsement-types"
                element={<EndorsementTypesPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="complaints:read" />}
            >
              <Route path="/apps/complaints" element={<ComplaintsPage />} />
              <Route
                path="/apps/complaints/:id"
                element={<ComplaintDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="tiramis-submissions:read" />
              }
            >
              <Route
                path="/apps/tiramis/submissions"
                element={<TiramisSubmissionsPage />}
              />
              <Route
                path="/apps/tiramis/submissions/:id"
                element={<TiramisSubmissionDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  anyPermission={[
                    'verifications:motor:submit',
                    'verifications:cover-note:submit',
                  ]}
                />
              }
            >
              <Route
                path="/apps/verifications"
                element={<VerificationsPage />}
              />
            </Route>

            {/* Product Engine */}
            <Route element={<ProtectedRoute hideForStandardUser />}>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-categories:read" />
                }
              >
                <Route
                  path="/apps/product-engine/categories"
                  element={<CategoriesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-products:read" />
                }
              >
                <Route
                  path="/apps/product-engine/products"
                  element={<ProductsPage />}
                />
                <Route
                  path="/apps/product-engine/products/:productId"
                  element={<ProductDetailPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-sub-classes:read" />
                }
              >
                <Route
                  path="/apps/product-engine/sub-classes"
                  element={<SubClassesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-risks:read" />
                }
              >
                <Route
                  path="/apps/product-engine/risks"
                  element={<RisksPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="rating-factors:read" />
                }
              >
                <Route
                  path="/apps/product-engine/rating-factors"
                  element={<RatingFactorsPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="pricing.manage_rules" />
                }
              >
                <Route
                  path="/apps/product-engine/rating-rules"
                  element={<RatingRulesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="pricing.manage_rate_books" />
                }
              >
                <Route
                  path="/apps/product-engine/rate-books"
                  element={<RateBooksPage />}
                />
                <Route
                  path="/apps/product-engine/rate-books/:rateBookId"
                  element={<RateBookDetailPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="product-distribution:read" />
                }
              >
                <Route
                  path="/apps/product-engine/taxes"
                  element={<TaxesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="category-access:read" />
                }
              >
                <Route
                  path="/apps/product-engine/access/categories"
                  element={<CategoryAccessPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="product-access:read" />
                }
              >
                <Route
                  path="/apps/product-engine/access/products"
                  element={<ProductAccessPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="pricing.calculate" />
                }
              >
                <Route
                  path="/apps/product-engine/calculator"
                  element={<CalculatorPage />}
                />
              </Route>
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="finance:dashboard" />
              }
            >
              <Route
                path="/apps/finance/dashboard"
                element={<FinanceDashboardPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="invoices:read" />}
            >
              <Route
                path="/apps/finance/invoices"
                element={<FinanceInvoicesPage />}
              />
              <Route
                path="/apps/finance/invoices/:id"
                element={<FinanceInvoiceDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="payments:read" />}
            >
              <Route
                path="/apps/finance/payments"
                element={<FinancePaymentsPage />}
              />
              <Route
                path="/apps/finance/payments/:id"
                element={<FinancePaymentDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="receipts:read" />}
            >
              <Route
                path="/apps/finance/receipts"
                element={<FinanceReceiptsPage />}
              />
              <Route
                path="/apps/finance/receipts/:id"
                element={<FinanceReceiptDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="refunds:read" />}
            >
              <Route
                path="/apps/finance/refunds"
                element={<FinanceRefundsPage />}
              />
              <Route
                path="/apps/finance/refunds/:id"
                element={<FinanceRefundDetailPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="reconciliation:read" />
              }
            >
              <Route
                path="/apps/finance/reconciliation"
                element={<FinanceReconciliationPage />}
              />
              <Route
                path="/apps/finance/reconciliation/:id"
                element={<FinanceReconciliationDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="commissions:read" />}
            >
              <Route
                path="/apps/finance/commission-accruals"
                element={<FinanceCommissionAccrualsPage />}
              />
              <Route
                path="/apps/finance/commission-accruals/:id"
                element={<FinanceCommissionAccrualDetailPage />}
              />
              <Route
                path="/apps/finance/commission-payments"
                element={<FinanceCommissionPaymentsPage />}
              />
              <Route
                path="/apps/finance/commission-payments/:id"
                element={<FinanceCommissionPaymentDetailPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="finance-journals:read" />
              }
            >
              <Route
                path="/apps/finance/journals"
                element={<FinanceJournalsPage />}
              />
              <Route
                path="/apps/finance/journals/:id"
                element={<FinanceJournalDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="reinsurance:read" />}
            >
              <Route
                path="/apps/reinsurance"
                element={<ReinsuranceWorkbenchPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="tiramis.monitoring.view" />
              }
            >
              <Route
                path="/apps/tiramis/dashboard"
                element={<TiramisDashboardPage />}
              />
              <Route
                path="/apps/tiramis/health"
                element={<TiramisHealthPage />}
              />
              <Route
                path="/apps/tiramis/failed"
                element={<TiramisFailedSubmissionsPage />}
              />
              <Route
                path="/apps/tiramis/retryable"
                element={<TiramisRetryablePage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute
                  anyPermission={[
                    'tiramis.tracking.view',
                    'verifications:motor:submit',
                    'verifications:cover-note:submit',
                  ]}
                />
              }
            >
              <Route
                path="/apps/tiramis/tracking"
                element={<TiramisTrackingPage />}
              />
            </Route>
          </Route>
        </Route>

        {/* Public website */}
        <Route path="/" element={<HomePage />} />
        <Route path="/claim-help" element={<ClaimsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/insurance" element={<InsurancePage />} />
        <Route path="/buy-cover" element={<BuyCoverPage />} />
        <Route
          path="/buy-insurance"
          element={<Navigate to="/buy-cover" replace />}
        />
        <Route
          path="/motor-insurance"
          element={<MotorInsurancePurchasePage />}
        />
        {/* Default redirects */}
        <Route path="*" element={<DefaultLandingPage />} />
      </Routes>
    </NumberFormatProvider>
  );
}
