import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PortalShell } from '@/modules/portal/components/PortalShell';
import { PortalDashboardPage } from '@/modules/portal/pages/PortalDashboardPage';
import { PortalBuyCoverPage } from '@/modules/portal/pages/PortalBuyCoverPage';
import { PortalBusinessListPage } from '@/modules/portal/pages/PortalBusinessListPage';
import { PortalBusinessDetailPage } from '@/modules/portal/pages/PortalBusinessDetailPage';
import { IntermediaryCustomerFormPage } from '@/modules/portal/pages/IntermediaryCustomerFormPage';
import { IntermediaryQuotationFormPage } from '@/modules/portal/pages/IntermediaryQuotationFormPage';
import { PortalRequestsReviewPage } from '@/modules/portal/pages/PortalRequestsReviewPage';
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
import { CompanyFeaturesPage } from '@/modules/tenant/company-features/pages/CompanyFeaturesPage';
import { DepartmentsPage } from '@/modules/tenant/departments/pages/DepartmentsPage';
import { DepartmentDetailPage } from '@/modules/tenant/departments/pages/DepartmentDetailPage';
import { CustomersPage } from '@/modules/tenant/customers/pages/CustomersPage';
import { CustomerDetailPage } from '@/modules/tenant/customers/pages/CustomerDetailPage';
import { CustomerCreatePage } from '@/modules/tenant/customers/pages/CustomerCreatePage';
import { CustomerEditPage } from '@/modules/tenant/customers/pages/CustomerEditPage';
import { RolesPage } from '@/modules/platform/roles/pages/RolesPage';
import { PermissionsPage } from '@/modules/platform/permissions/pages/PermissionsPage';
import { ReferenceDataPage } from '@/modules/platform/reference-data/pages/ReferenceDataPage';
import { DevicesPage } from '@/modules/shared/devices/pages/DevicesPage';
import { SessionsPage } from '@/modules/shared/sessions/pages/SessionsPage';
import { ApiClientsPage } from '@/modules/platform/api-clients/pages/ApiClientsPage';
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
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { MotorVehiclesPage } from '@/modules/tenant/motor/pages/MotorVehiclesPage';
import { MotorVehicleDetailPage } from '@/modules/tenant/motor/pages/MotorVehicleDetailPage';
import { MotorVehicleCreatePage } from '@/modules/tenant/motor/pages/MotorVehicleCreatePage';
import { MotorVehicleEditPage } from '@/modules/tenant/motor/pages/MotorVehicleEditPage';
import { MotorFleetsPage } from '@/modules/tenant/motor/pages/MotorFleetsPage';
import { MotorFleetDetailPage } from '@/modules/tenant/motor/pages/MotorFleetDetailPage';
import { MotorFleetCreatePage } from '@/modules/tenant/motor/pages/MotorFleetCreatePage';
import { MotorFleetEditPage } from '@/modules/tenant/motor/pages/MotorFleetEditPage';
import { SubjectMattersPage } from '@/modules/tenant/non-motor/pages/SubjectMattersPage';
import { SubjectMatterDetailPage } from '@/modules/tenant/non-motor/pages/SubjectMatterDetailPage';
import { SubjectMatterCreatePage } from '@/modules/tenant/non-motor/pages/SubjectMatterCreatePage';
import { SubjectMatterEditPage } from '@/modules/tenant/non-motor/pages/SubjectMatterEditPage';
import { QuotationsPage } from '@/modules/tenant/quotations/pages/QuotationsPage';
import { QuotationDetailPage } from '@/modules/tenant/quotations/pages/QuotationDetailPage';
import { QuotationCreatePage } from '@/modules/tenant/quotations/pages/QuotationCreatePage';
import { QuotationEditPage } from '@/modules/tenant/quotations/pages/QuotationEditPage';
import { QuotationWizardPage } from '@/modules/tenant/quotations/pages/QuotationWizardPage';
import { QuotationPaymentPage } from '@/modules/tenant/quotations/pages/QuotationPaymentPage';
import { PoliciesPage } from '@/modules/tenant/policies/pages/PoliciesPage';
import { PolicyDetailPage } from '@/modules/tenant/policies/pages/PolicyDetailPage';
import { EndorsementsPage } from '@/modules/tenant/policies/pages/EndorsementsPage';
import { RenewalsPage } from '@/modules/tenant/policies/pages/RenewalsPage';
import { PolicyEndorsementPage } from '@/modules/tenant/policies/pages/PolicyEndorsementPage';
import { EndorsementTypesPage } from '@/modules/tenant/policies/pages/EndorsementTypesPage';
import { PolicyCancellationPage } from '@/modules/tenant/policies/pages/PolicyCancellationPage';
import { PolicyRenewalPage } from '@/modules/tenant/policies/pages/PolicyRenewalPage';
import { PolicyEditPage } from '@/modules/tenant/policies/pages/PolicyEditPage';
import { ClaimsPage } from '@/modules/tenant/claims/pages/ClaimsPage';
import { ClaimDetailPage } from '@/modules/tenant/claims/pages/ClaimDetailPage';
import { ComplaintsPage } from '@/modules/tenant/complaints/pages/ComplaintsPage';
import { ComplaintDetailPage } from '@/modules/tenant/complaints/pages/ComplaintDetailPage';
import { TiramisSubmissionsPage } from '@/modules/tenant/tiramis/pages/TiramisSubmissionsPage';
import { TiramisSubmissionDetailPage } from '@/modules/tenant/tiramis/pages/TiramisSubmissionDetailPage';
import { TiramisDashboardPage } from '@/modules/tenant/tiramis/pages/TiramisDashboardPage';
import { TiramisHealthPage } from '@/modules/tenant/tiramis/pages/TiramisHealthPage';
import { TiramisTrackingPage } from '@/modules/tenant/tiramis/pages/TiramisTrackingPage';
import { TiramisFailedSubmissionsPage } from '@/modules/tenant/tiramis/pages/TiramisFailedSubmissionsPage';
import { TiramisRetryablePage } from '@/modules/tenant/tiramis/pages/TiramisRetryablePage';
import { TiramisConfigurationPage } from '@/modules/tenant/tiramis-config/pages/TiramisConfigurationPage';
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
        <Route path="/forbidden" element={<ForbiddenPage />} />
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
          <Route path="/customer" element={<PortalShell audience="customer" />}>
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
              path="/intermediary"
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
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/:tab" element={<DashboardPage />} />

            <Route
              element={
                <ProtectedRoute
                  anyPermissions={['analytics:metrics:read', 'analytics:read']}
                />
              }
            >
              <Route
                path="/analytics/metrics"
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
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:id" element={<DocumentDetailPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="document-templates:read" />
              }
            >
              <Route
                path="/document-templates"
                element={<DocumentTemplatesPage />}
              />
              <Route
                path="/document-templates/:id"
                element={<DocumentTemplateDetailPage />}
              />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="signatures:read" />}
            >
              <Route path="/signatures" element={<SignatureRequestsPage />} />
              <Route
                path="/signatures/:id"
                element={<SignatureRequestDetailPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="notifications:read" />
              }
            >
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route
                path="/notification-preferences"
                element={<NotificationPreferencesPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="communications:read" />
              }
            >
              <Route path="/communications" element={<CommunicationsPage />} />
              <Route
                path="/communications/:id"
                element={<CommunicationDetailPage />}
              />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="work-items:read" />}
            >
              <Route path="/work-items" element={<WorkItemsPage />} />
              <Route path="/work-items/:id" element={<WorkItemDetailPage />} />
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
                path="/portal-requests"
                element={<PortalRequestsReviewPage />}
              />
              <Route
                path="/portal-requests/:id"
                element={<PortalRequestReviewDetailPage />}
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
              <Route path="/reports" element={<ReportsWorkbenchPage />} />
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
              <Route path="/regulatory" element={<RegulatoryWorkbenchPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission="users:read"
                  allowedScopes={['company']}
                />
              }
            >
              <Route path="/users" element={<UsersListPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
            </Route>

            {/* Owner-only: manage all companies */}
            <Route
              element={<ProtectedRoute anyRole={['OWNER', 'SUPER_ADMIN']} />}
            >
              <Route path="/companies" element={<CompaniesListPage />} />
              <Route path="/companies/:id" element={<CompanyDetailPage />} />
            </Route>

            {/* Company-scoped users: view/edit their own company */}
            <Route
              element={
                <ProtectedRoute
                  requiredPermission="view_company_data"
                  hideForStandardUser
                />
              }
            >
              <Route path="/my-company" element={<MyCompanyPage />} />
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
              <Route path="/branches" element={<BranchesListPage />} />
              <Route path="/branches/:id" element={<BranchDetailPage />} />
              <Route
                path="/company-features"
                element={<CompanyFeaturesPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  requiredPermission="departments:read"
                  hideForStandardUser
                />
              }
            >
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route
                path="/departments/:id"
                element={<DepartmentDetailPage />}
              />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="roles:read" />}>
              <Route path="/roles" element={<RolesPage />} />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="permissions:read" />}
            >
              <Route path="/permissions" element={<PermissionsPage />} />
            </Route>

            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route
              element={<ProtectedRoute anyRole={['OWNER', 'SUPER_ADMIN']} />}
            >
              <Route path="/reference-data" element={<ReferenceDataPage />} />
            </Route>
            <Route
              element={<ProtectedRoute anyRole={['SUPER_ADMIN', 'OWNER']} />}
            >
              <Route path="/api-clients" element={<ApiClientsPage />} />
            </Route>
            <Route path="/settings/profile" element={<ProfilePage />} />
            <Route
              path="/settings/number-format"
              element={<NumberFormatSettingsPage />}
            />

            <Route
              element={<ProtectedRoute requiredPermission="quotations:read" />}
            >
              <Route
                path={underwritingPaths.quotations}
                element={<QuotationsPage />}
              />
              <Route
                path={underwritingPaths.quotationDetail(':id')}
                element={<QuotationDetailPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="quotations:create" />
              }
            >
              <Route
                path={underwritingPaths.quotationCreate}
                element={<QuotationCreatePage />}
              />
              <Route
                path={underwritingPaths.quotationWizard}
                element={<QuotationWizardPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="quotations:update" />
              }
            >
              <Route
                path={underwritingPaths.quotationWizardEdit(':id')}
                element={<QuotationWizardPage />}
              />
              <Route
                path={underwritingPaths.quotationEdit(':id')}
                element={<QuotationEditPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="quotations:request-payment" />
              }
            >
              <Route
                path={underwritingPaths.quotationPayment(':id')}
                element={<QuotationPaymentPage />}
              />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="policies:read" />}
            >
              <Route
                path={underwritingPaths.policies}
                element={<PoliciesPage />}
              />
              <Route
                path={underwritingPaths.policyDetail(':id')}
                element={<PolicyDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="policies:update" />}
            >
              <Route
                path={underwritingPaths.policyEdit(':id')}
                element={<PolicyEditPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="endorsements:create" />
              }
            >
              <Route
                path={underwritingPaths.endorsements}
                element={<EndorsementsPage />}
              />
              <Route
                path={underwritingPaths.policyEndorsementCreate(':policyId')}
                element={<PolicyEndorsementPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute
                  requiredPermission="endorsements:create"
                  hideForStandardUser
                />
              }
            >
              <Route
                path="/endorsement-types"
                element={<EndorsementTypesPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="endorsements:update-draft" />
              }
            >
              <Route
                path={underwritingPaths.policyEndorsementEdit(
                  ':policyId',
                  ':endorsementId',
                )}
                element={<PolicyEndorsementPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="cancellations:create" />
              }
            >
              <Route
                path={underwritingPaths.policyCancellationCreate(':policyId')}
                element={<PolicyCancellationPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="cancellations:read" />
              }
            >
              <Route
                path={underwritingPaths.policyCancellationDetail(
                  ':policyId',
                  ':cancellationId',
                )}
                element={<PolicyCancellationPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="renewals:read" />}
            >
              <Route
                path={underwritingPaths.renewals}
                element={<RenewalsPage />}
              />
              <Route
                path={underwritingPaths.policyRenewalDetail(
                  ':policyId',
                  ':renewalId',
                )}
                element={<PolicyRenewalPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="claims:read" />}
            >
              <Route path="/claims" element={<ClaimsPage />} />
              <Route path="/claims/:id" element={<ClaimDetailPage />} />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="complaints:read" />}
            >
              <Route path="/complaints" element={<ComplaintsPage />} />
              <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="tiramis-submissions:read" />
              }
            >
              <Route
                path="/tiramis/submissions"
                element={<TiramisSubmissionsPage />}
              />
              <Route
                path="/tiramis/submissions/:id"
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
              <Route path="/verifications" element={<VerificationsPage />} />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="customers:read" />}
            >
              <Route
                path={underwritingPaths.customers}
                element={<CustomersPage />}
              />
              <Route
                path={underwritingPaths.customerDetail(':id')}
                element={<CustomerDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="customers:create" />}
            >
              <Route
                path={underwritingPaths.customerCreate}
                element={<CustomerCreatePage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="customers:update" />}
            >
              <Route
                path={underwritingPaths.customerEdit(':id')}
                element={<CustomerEditPage />}
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
                  path="/product-engine/categories"
                  element={<CategoriesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-products:read" />
                }
              >
                <Route
                  path="/product-engine/products"
                  element={<ProductsPage />}
                />
                <Route
                  path="/product-engine/products/:productId"
                  element={<ProductDetailPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-sub-classes:read" />
                }
              >
                <Route
                  path="/product-engine/sub-classes"
                  element={<SubClassesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="insurance-risks:read" />
                }
              >
                <Route path="/product-engine/risks" element={<RisksPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="rating-factors:read" />
                }
              >
                <Route
                  path="/product-engine/rating-factors"
                  element={<RatingFactorsPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="pricing.manage_rules" />
                }
              >
                <Route
                  path="/product-engine/rating-rules"
                  element={<RatingRulesPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="pricing.manage_rate_books" />
                }
              >
                <Route
                  path="/product-engine/rate-books"
                  element={<RateBooksPage />}
                />
                <Route
                  path="/product-engine/rate-books/:rateBookId"
                  element={<RateBookDetailPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="product-distribution:read" />
                }
              >
                <Route path="/product-engine/taxes" element={<TaxesPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="category-access:read" />
                }
              >
                <Route
                  path="/product-engine/access/categories"
                  element={<CategoryAccessPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="product-access:read" />
                }
              >
                <Route
                  path="/product-engine/access/products"
                  element={<ProductAccessPage />}
                />
              </Route>
              <Route
                element={
                  <ProtectedRoute requiredPermission="pricing.calculate" />
                }
              >
                <Route
                  path="/product-engine/calculator"
                  element={<CalculatorPage />}
                />
              </Route>
            </Route>

            <Route element={<ProtectedRoute requiredPermission="motor:read" />}>
              <Route
                path={underwritingPaths.motorVehicles}
                element={<MotorVehiclesPage />}
              />
              <Route
                path={underwritingPaths.motorVehicleDetail(':id')}
                element={<MotorVehicleDetailPage />}
              />
              <Route
                path={underwritingPaths.motorFleets}
                element={<MotorFleetsPage />}
              />
              <Route
                path={underwritingPaths.motorFleetDetail(':id')}
                element={<MotorFleetDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="motor:create" />}
            >
              <Route
                path={underwritingPaths.motorVehicleCreate}
                element={<MotorVehicleCreatePage />}
              />
              <Route
                path={underwritingPaths.motorFleetCreate}
                element={<MotorFleetCreatePage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="motor:update" />}
            >
              <Route
                path={underwritingPaths.motorVehicleEdit(':id')}
                element={<MotorVehicleEditPage />}
              />
              <Route
                path={underwritingPaths.motorFleetEdit(':id')}
                element={<MotorFleetEditPage />}
              />
            </Route>

            <Route
              element={<ProtectedRoute requiredPermission="non-motor:read" />}
            >
              <Route
                path={underwritingPaths.nonMotorSubjectMatters}
                element={<SubjectMattersPage />}
              />
              <Route
                path={underwritingPaths.nonMotorSubjectMatterDetail(':id')}
                element={<SubjectMatterDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="non-motor:create" />}
            >
              <Route
                path={underwritingPaths.nonMotorSubjectMatterCreate}
                element={<SubjectMatterCreatePage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="non-motor:update" />}
            >
              <Route
                path={underwritingPaths.nonMotorSubjectMatterEdit(':id')}
                element={<SubjectMatterEditPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="finance:dashboard" />
              }
            >
              <Route
                path="/finance/dashboard"
                element={<FinanceDashboardPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="invoices:read" />}
            >
              <Route
                path="/finance/invoices"
                element={<FinanceInvoicesPage />}
              />
              <Route
                path="/finance/invoices/:id"
                element={<FinanceInvoiceDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="payments:read" />}
            >
              <Route
                path="/finance/payments"
                element={<FinancePaymentsPage />}
              />
              <Route
                path="/finance/payments/:id"
                element={<FinancePaymentDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="receipts:read" />}
            >
              <Route
                path="/finance/receipts"
                element={<FinanceReceiptsPage />}
              />
              <Route
                path="/finance/receipts/:id"
                element={<FinanceReceiptDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="refunds:read" />}
            >
              <Route path="/finance/refunds" element={<FinanceRefundsPage />} />
              <Route
                path="/finance/refunds/:id"
                element={<FinanceRefundDetailPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="reconciliation:read" />
              }
            >
              <Route
                path="/finance/reconciliation"
                element={<FinanceReconciliationPage />}
              />
              <Route
                path="/finance/reconciliation/:id"
                element={<FinanceReconciliationDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="commissions:read" />}
            >
              <Route
                path="/finance/commission-accruals"
                element={<FinanceCommissionAccrualsPage />}
              />
              <Route
                path="/finance/commission-accruals/:id"
                element={<FinanceCommissionAccrualDetailPage />}
              />
              <Route
                path="/finance/commission-payments"
                element={<FinanceCommissionPaymentsPage />}
              />
              <Route
                path="/finance/commission-payments/:id"
                element={<FinanceCommissionPaymentDetailPage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute requiredPermission="finance-journals:read" />
              }
            >
              <Route
                path="/finance/journals"
                element={<FinanceJournalsPage />}
              />
              <Route
                path="/finance/journals/:id"
                element={<FinanceJournalDetailPage />}
              />
            </Route>
            <Route
              element={<ProtectedRoute requiredPermission="reinsurance:read" />}
            >
              <Route
                path="/reinsurance"
                element={<ReinsuranceWorkbenchPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute requiredPermission="tiramis.monitoring.view" />
              }
            >
              <Route
                path="/tiramis/dashboard"
                element={<TiramisDashboardPage />}
              />
              <Route path="/tiramis/health" element={<TiramisHealthPage />} />
              <Route
                path="/tiramis/failed"
                element={<TiramisFailedSubmissionsPage />}
              />
              <Route
                path="/tiramis/retryable"
                element={<TiramisRetryablePage />}
              />
            </Route>
            <Route
              element={
                <ProtectedRoute
                  requiredPermission="company-tiramis-config:read"
                  allowedScopes={['company']}
                />
              }
            >
              <Route
                path="/tiramis/configuration"
                element={<TiramisConfigurationPage />}
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
                path="/tiramis/tracking"
                element={<TiramisTrackingPage />}
              />
            </Route>
          </Route>
        </Route>

        {/* Legacy route redirects */}
        <Route
          path="/quotations"
          element={<Navigate to={underwritingPaths.quotations} replace />}
        />
        <Route
          path="/quotations/new"
          element={<Navigate to={underwritingPaths.quotationCreate} replace />}
        />
        <Route
          path="/quotations/wizard"
          element={<Navigate to={underwritingPaths.quotationWizard} replace />}
        />
        <Route
          path="/quotations/:id"
          element={<Navigate to={underwritingPaths.quotations} replace />}
        />
        <Route path="/quotations/:id/edit" element={<QuotationEditPage />} />
        <Route
          path="/policies"
          element={<Navigate to={underwritingPaths.policies} replace />}
        />
        <Route
          path="/policies/new"
          element={<Navigate to={underwritingPaths.policies} replace />}
        />
        <Route
          path="/underwriting/policies/new"
          element={<Navigate to={underwritingPaths.policies} replace />}
        />
        <Route
          path="/policies/:id"
          element={<Navigate to={underwritingPaths.policies} replace />}
        />
        <Route
          path="/policies/:id/edit"
          element={<Navigate to={underwritingPaths.policies} replace />}
        />
        <Route
          path="/motor/vehicles"
          element={<Navigate to={underwritingPaths.motorVehicles} replace />}
        />
        <Route
          path="/motor/vehicles/new"
          element={
            <Navigate to={underwritingPaths.motorVehicleCreate} replace />
          }
        />
        <Route
          path="/motor/vehicles/:id"
          element={<Navigate to={underwritingPaths.motorVehicles} replace />}
        />
        <Route
          path="/motor/vehicles/:id/edit"
          element={<Navigate to={underwritingPaths.motorVehicles} replace />}
        />
        <Route
          path="/motor/fleets"
          element={<Navigate to={underwritingPaths.motorFleets} replace />}
        />
        <Route
          path="/motor/fleets/new"
          element={<Navigate to={underwritingPaths.motorFleetCreate} replace />}
        />
        <Route
          path="/motor/fleets/:id"
          element={<Navigate to={underwritingPaths.motorFleets} replace />}
        />
        <Route
          path="/motor/fleets/:id/edit"
          element={<Navigate to={underwritingPaths.motorFleets} replace />}
        />
        <Route
          path="/motor/quotation-details"
          element={<Navigate to={underwritingPaths.motorVehicles} replace />}
        />
        <Route
          path="/motor/policy-details"
          element={<Navigate to={underwritingPaths.motorVehicles} replace />}
        />
        <Route
          path="/non-motor/subject-matters"
          element={
            <Navigate to={underwritingPaths.nonMotorSubjectMatters} replace />
          }
        />
        <Route
          path="/non-motor/subject-matters/new"
          element={
            <Navigate
              to={underwritingPaths.nonMotorSubjectMatterCreate}
              replace
            />
          }
        />
        <Route
          path="/non-motor/subject-matters/:id"
          element={
            <Navigate to={underwritingPaths.nonMotorSubjectMatters} replace />
          }
        />
        <Route
          path="/non-motor/subject-matters/:id/edit"
          element={
            <Navigate to={underwritingPaths.nonMotorSubjectMatters} replace />
          }
        />
        <Route
          path={underwritingPaths.submissions}
          element={<Navigate to="/tiramis/submissions" replace />}
        />
        <Route
          path={underwritingPaths.submissionDetail(':id')}
          element={<TiramisSubmissionDetailPage />}
        />
        <Route
          path="/customers"
          element={<Navigate to={underwritingPaths.customers} replace />}
        />
        <Route
          path="/customers/new"
          element={<Navigate to={underwritingPaths.customerCreate} replace />}
        />
        <Route
          path="/customers/:id"
          element={<Navigate to={underwritingPaths.customers} replace />}
        />
        <Route
          path="/customers/:id/edit"
          element={<Navigate to={underwritingPaths.customers} replace />}
        />

        {/* Public website */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/insurance" element={<InsurancePage />} />
        <Route path="/buy-cover" element={<BuyCoverPage />} />
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
