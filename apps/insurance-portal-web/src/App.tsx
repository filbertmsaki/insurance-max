import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute'
import { GuestRoute } from '@/modules/shared/auth/components/GuestRoute'
import { AuthBootstrap } from '@/modules/shared/auth/components/AuthBootstrap'

import { LoginPage } from '@/modules/shared/auth/pages/LoginPage'
import { RegisterPage } from '@/modules/shared/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/modules/shared/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/modules/shared/auth/pages/ResetPasswordPage'
import { VerifyEmailPage } from '@/modules/shared/auth/pages/VerifyEmailPage'
import { PhoneLoginPage } from '@/modules/shared/auth/pages/PhoneLoginPage'
import { PasswordlessPage } from '@/modules/shared/auth/pages/PasswordlessPage'
import { TwoFactorPage } from '@/modules/shared/auth/pages/TwoFactorPage'

import { DashboardPage } from '@/modules/shared/dashboard/pages/DashboardPage'
import { UsersListPage } from '@/modules/tenant/users/pages/UsersListPage'
import { UserDetailPage } from '@/modules/tenant/users/pages/UserDetailPage'
import { CompaniesListPage } from '@/modules/platform/companies/pages/CompaniesListPage'
import { CompanyDetailPage } from '@/modules/platform/companies/pages/CompanyDetailPage'
import { MyCompanyPage } from '@/modules/platform/companies/pages/MyCompanyPage'
import { BranchesListPage } from '@/modules/tenant/branches/pages/BranchesListPage'
import { BranchDetailPage } from '@/modules/tenant/branches/pages/BranchDetailPage'
import { CompanyFeaturesPage } from '@/modules/tenant/company-features/pages/CompanyFeaturesPage'
import { DepartmentsPage } from '@/modules/tenant/departments/pages/DepartmentsPage'
import { DepartmentDetailPage } from '@/modules/tenant/departments/pages/DepartmentDetailPage'
import { CustomersPage } from '@/modules/tenant/customers/pages/CustomersPage'
import { CustomerDetailPage } from '@/modules/tenant/customers/pages/CustomerDetailPage'
import { CustomerCreatePage } from '@/modules/tenant/customers/pages/CustomerCreatePage'
import { CustomerEditPage } from '@/modules/tenant/customers/pages/CustomerEditPage'
import { RolesPage } from '@/modules/platform/roles/pages/RolesPage'
import { PermissionsPage } from '@/modules/platform/permissions/pages/PermissionsPage'
import { DevicesPage } from '@/modules/shared/devices/pages/DevicesPage'
import { SessionsPage } from '@/modules/shared/sessions/pages/SessionsPage'
import { ApiClientsPage } from '@/modules/platform/api-clients/pages/ApiClientsPage'
import { ProfilePage } from '@/modules/shared/profile/pages/ProfilePage'
import { CategoriesPage } from '@/modules/tenant/product-engine/pages/categories/CategoriesPage'
import { ProductsPage } from '@/modules/tenant/product-engine/pages/products/ProductsPage'
import { SubClassesPage } from '@/modules/tenant/product-engine/pages/sub-classes/SubClassesPage'
import { RisksPage } from '@/modules/tenant/product-engine/pages/risks/RisksPage'
import { RatingFactorsPage } from '@/modules/tenant/product-engine/pages/rating-factors/RatingFactorsPage'
import { RatingRulesPage } from '@/modules/tenant/product-engine/pages/rating-rules/RatingRulesPage'
import { CategoryAccessPage } from '@/modules/tenant/product-engine/pages/access/categories/CategoryAccessPage'
import { ProductAccessPage } from '@/modules/tenant/product-engine/pages/access/products/ProductAccessPage'
import { CalculatorPage } from '@/modules/tenant/product-engine/pages/calculator/CalculatorPage'
import { UnderwritingHomePage } from '@/modules/tenant/underwriting/pages/UnderwritingHomePage'
import { underwritingPaths } from '@/modules/tenant/underwriting/paths'
import { SubjectMattersPage } from '@/modules/tenant/non-motor/pages/SubjectMattersPage'
import { SubjectMatterDetailPage } from '@/modules/tenant/non-motor/pages/SubjectMatterDetailPage'
import { MotorVehiclesPage } from '@/modules/tenant/motor/pages/MotorVehiclesPage'
import { MotorVehicleDetailPage } from '@/modules/tenant/motor/pages/MotorVehicleDetailPage'
import { MotorVehicleCreatePage } from '@/modules/tenant/motor/pages/MotorVehicleCreatePage'
import { MotorVehicleEditPage } from '@/modules/tenant/motor/pages/MotorVehicleEditPage'
import { MotorFleetsPage } from '@/modules/tenant/motor/pages/MotorFleetsPage'
import { MotorFleetDetailPage } from '@/modules/tenant/motor/pages/MotorFleetDetailPage'
import { MotorFleetCreatePage } from '@/modules/tenant/motor/pages/MotorFleetCreatePage'
import { MotorFleetEditPage } from '@/modules/tenant/motor/pages/MotorFleetEditPage'
import { MotorQuotationDetailsPage } from '@/modules/tenant/motor/pages/MotorQuotationDetailsPage'
import { MotorPolicyDetailsPage } from '@/modules/tenant/motor/pages/MotorPolicyDetailsPage'
import { QuotationsPage } from '@/modules/tenant/quotations/pages/QuotationsPage'
import { QuotationDetailPage } from '@/modules/tenant/quotations/pages/QuotationDetailPage'
import { QuotationCreatePage } from '@/modules/tenant/quotations/pages/QuotationCreatePage'
import { QuotationEditPage } from '@/modules/tenant/quotations/pages/QuotationEditPage'
import { QuotationWizardPage } from '@/modules/tenant/quotations/pages/QuotationWizardPage'
import { PoliciesPage } from '@/modules/tenant/policies/pages/PoliciesPage'
import { PolicyDetailPage } from '@/modules/tenant/policies/pages/PolicyDetailPage'
import { PolicyCreatePage } from '@/modules/tenant/policies/pages/PolicyCreatePage'
import { PolicyEditPage } from '@/modules/tenant/policies/pages/PolicyEditPage'
import { TiramisSubmissionsPage } from '@/modules/tenant/tiramis/pages/TiramisSubmissionsPage'
import { TiramisSubmissionDetailPage } from '@/modules/tenant/tiramis/pages/TiramisSubmissionDetailPage'
import { TiramisDashboardPage } from '@/modules/tenant/tiramis/pages/TiramisDashboardPage'
import { TiramisHealthPage } from '@/modules/tenant/tiramis/pages/TiramisHealthPage'
import { TiramisTrackingPage } from '@/modules/tenant/tiramis/pages/TiramisTrackingPage'
import { TiramisFailedSubmissionsPage } from '@/modules/tenant/tiramis/pages/TiramisFailedSubmissionsPage'
import { TiramisRetryablePage } from '@/modules/tenant/tiramis/pages/TiramisRetryablePage'
import { InvoicesPage } from '@/modules/tenant/billing/pages/InvoicesPage'
import { InvoiceDetailPage } from '@/modules/tenant/billing/pages/InvoiceDetailPage'
import { InvoiceCreatePage } from '@/modules/tenant/billing/pages/InvoiceCreatePage'
import { InvoiceEditPage } from '@/modules/tenant/billing/pages/InvoiceEditPage'
import { ReceiptsPage } from '@/modules/tenant/billing/pages/ReceiptsPage'
import { ReceiptDetailPage } from '@/modules/tenant/billing/pages/ReceiptDetailPage'
import { ReceiptCreatePage } from '@/modules/tenant/billing/pages/ReceiptCreatePage'
import { ReceiptEditPage } from '@/modules/tenant/billing/pages/ReceiptEditPage'
import { PaymentTransactionsPage } from '@/modules/tenant/billing/pages/PaymentTransactionsPage'
import { PaymentTransactionDetailPage } from '@/modules/tenant/billing/pages/PaymentTransactionDetailPage'
import { CommissionTransactionsPage } from '@/modules/tenant/billing/pages/CommissionTransactionsPage'
import { CommissionTransactionDetailPage } from '@/modules/tenant/billing/pages/CommissionTransactionDetailPage'
import { CommissionPaymentsPage } from '@/modules/tenant/billing/pages/CommissionPaymentsPage'
import { CommissionPaymentDetailPage } from '@/modules/tenant/billing/pages/CommissionPaymentDetailPage'

export default function App() {
  return (
    <>
      <AuthBootstrap />
      <Routes>
        {/* Guest-only routes */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/phone-login" element={<PhoneLoginPage />} />
          <Route path="/passwordless" element={<PasswordlessPage />} />
          <Route path="/passwordless/complete" element={<PasswordlessPage />} />
        </Route>

        {/* 2FA (needs tempToken, no full auth) */}
        <Route path="/2fa" element={<TwoFactorPage />} />

        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route element={<ProtectedRoute requiredPermission="users:read" />}>
              <Route path="/users" element={<UsersListPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
            </Route>

            {/* Owner-only: manage all companies */}
            <Route element={<ProtectedRoute anyRole={['OWNER', 'SUPER_ADMIN']} />}>
              <Route path="/companies" element={<CompaniesListPage />} />
              <Route path="/companies/:id" element={<CompanyDetailPage />} />
            </Route>

            {/* Company-scoped users: view/edit their own company */}
            <Route element={<ProtectedRoute requiredPermission="view_company_data" />}>
              <Route path="/my-company" element={<MyCompanyPage />} />
            </Route>

            {/* Branches: accessible to users with branches:read permission */}
            <Route element={<ProtectedRoute requiredPermission="branches:read" />}>
              <Route path="/branches" element={<BranchesListPage />} />
              <Route path="/branches/:id" element={<BranchDetailPage />} />
              <Route path="/company-features" element={<CompanyFeaturesPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="departments:read" />}>
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/departments/:id" element={<DepartmentDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="customers:read" />}>
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="customers:create" />}>
              <Route path="/customers/new" element={<CustomerCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="customers:update" />}>
              <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="roles:read" />}>
              <Route path="/roles" element={<RolesPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="permissions:read" />}>
              <Route path="/permissions" element={<PermissionsPage />} />
            </Route>

            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route element={<ProtectedRoute anyRole={['SUPER_ADMIN', 'OWNER']} />}>
              <Route path="/api-clients" element={<ApiClientsPage />} />
            </Route>
            <Route path="/settings/profile" element={<ProfilePage />} />

            <Route path={underwritingPaths.root} element={<UnderwritingHomePage />} />

            <Route element={<ProtectedRoute requiredPermission="quotations:read" />}>
              <Route path={underwritingPaths.quotations} element={<QuotationsPage />} />
              <Route path={underwritingPaths.quotationDetail(':id')} element={<QuotationDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="quotations:create" />}>
              <Route path={underwritingPaths.quotationCreate} element={<QuotationCreatePage />} />
              <Route path={underwritingPaths.quotationWizard} element={<QuotationWizardPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="quotations:update" />}>
              <Route path={underwritingPaths.quotationEdit(':id')} element={<QuotationEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="policies:read" />}>
              <Route path={underwritingPaths.policies} element={<PoliciesPage />} />
              <Route path={underwritingPaths.policyDetail(':id')} element={<PolicyDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="policies:create" />}>
              <Route path={underwritingPaths.policyCreate} element={<PolicyCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="policies:update" />}>
              <Route path={underwritingPaths.policyEdit(':id')} element={<PolicyEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="tiramis-submissions:read" />}>
              <Route path={underwritingPaths.submissions} element={<TiramisSubmissionsPage />} />
              <Route path={underwritingPaths.submissionDetail(':id')} element={<TiramisSubmissionDetailPage />} />
            </Route>

            {/* Product Engine */}
            <Route element={<ProtectedRoute requiredPermission="insurance-categories:read" />}>
              <Route path="/product-engine/categories" element={<CategoriesPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="insurance-products:read" />}>
              <Route path="/product-engine/products" element={<ProductsPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="insurance-sub-classes:read" />}>
              <Route path="/product-engine/sub-classes" element={<SubClassesPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="insurance-risks:read" />}>
              <Route path="/product-engine/risks" element={<RisksPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="rating-factors:read" />}>
              <Route path="/product-engine/rating-factors" element={<RatingFactorsPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="risk-rating-rules:read" />}>
              <Route path="/product-engine/rating-rules" element={<RatingRulesPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="category-access:read" />}>
              <Route path="/product-engine/access/categories" element={<CategoryAccessPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="product-access:read" />}>
              <Route path="/product-engine/access/products" element={<ProductAccessPage />} />
            </Route>
            <Route path="/product-engine/calculator" element={<CalculatorPage />} />

            <Route element={<ProtectedRoute requiredPermission="non-motor:read" />}>
              <Route path={underwritingPaths.nonMotorSubjectMatters} element={<SubjectMattersPage />} />
              <Route path={underwritingPaths.nonMotorSubjectMatterDetail(':id')} element={<SubjectMatterDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="motor:read" />}>
              <Route path={underwritingPaths.motorVehicles} element={<MotorVehiclesPage />} />
              <Route path={underwritingPaths.motorVehicleDetail(':id')} element={<MotorVehicleDetailPage />} />
              <Route path={underwritingPaths.motorFleets} element={<MotorFleetsPage />} />
              <Route path={underwritingPaths.motorFleetDetail(':id')} element={<MotorFleetDetailPage />} />
              <Route path={underwritingPaths.motorQuotationDetails} element={<MotorQuotationDetailsPage />} />
              <Route path={underwritingPaths.motorPolicyDetails} element={<MotorPolicyDetailsPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="motor:create" />}>
              <Route path={underwritingPaths.motorVehicleCreate} element={<MotorVehicleCreatePage />} />
              <Route path={underwritingPaths.motorFleetCreate} element={<MotorFleetCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="motor:update" />}>
              <Route path={underwritingPaths.motorVehicleEdit(':id')} element={<MotorVehicleEditPage />} />
              <Route path={underwritingPaths.motorFleetEdit(':id')} element={<MotorFleetEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="billing:read" />}>
              <Route path="/billing/invoices" element={<InvoicesPage />} />
              <Route path="/billing/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/billing/receipts" element={<ReceiptsPage />} />
              <Route path="/billing/receipts/:id" element={<ReceiptDetailPage />} />
              <Route path="/billing/payment-transactions" element={<PaymentTransactionsPage />} />
              <Route path="/billing/payment-transactions/:id" element={<PaymentTransactionDetailPage />} />
              <Route path="/billing/commission-transactions" element={<CommissionTransactionsPage />} />
              <Route path="/billing/commission-transactions/:id" element={<CommissionTransactionDetailPage />} />
              <Route path="/billing/commission-payments" element={<CommissionPaymentsPage />} />
              <Route path="/billing/commission-payments/:id" element={<CommissionPaymentDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="billing:create" />}>
              <Route path="/billing/invoices/new" element={<InvoiceCreatePage />} />
              <Route path="/billing/receipts/new" element={<ReceiptCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="billing:update" />}>
              <Route path="/billing/invoices/:id/edit" element={<InvoiceEditPage />} />
              <Route path="/billing/receipts/:id/edit" element={<ReceiptEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="tiramis.monitoring.view" />}>
              <Route path="/tiramis/dashboard" element={<TiramisDashboardPage />} />
              <Route path="/tiramis/health" element={<TiramisHealthPage />} />
              <Route path="/tiramis/failed" element={<TiramisFailedSubmissionsPage />} />
              <Route path="/tiramis/retryable" element={<TiramisRetryablePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="tiramis.tracking.view" />}>
              <Route path="/tiramis/tracking" element={<TiramisTrackingPage />} />
            </Route>
          </Route>
        </Route>

        {/* Legacy route redirects */}
        <Route path="/quotations" element={<Navigate to={underwritingPaths.quotations} replace />} />
        <Route path="/quotations/new" element={<Navigate to={underwritingPaths.quotationCreate} replace />} />
        <Route path="/quotations/wizard" element={<Navigate to={underwritingPaths.quotationWizard} replace />} />
        <Route path="/quotations/:id" element={<Navigate to={underwritingPaths.quotations} replace />} />
        <Route path="/quotations/:id/edit" element={<Navigate to={underwritingPaths.quotationCreate} replace />} />
        <Route path="/policies" element={<Navigate to={underwritingPaths.policies} replace />} />
        <Route path="/policies/new" element={<Navigate to={underwritingPaths.policyCreate} replace />} />
        <Route path="/policies/:id" element={<Navigate to={underwritingPaths.policies} replace />} />
        <Route path="/policies/:id/edit" element={<Navigate to={underwritingPaths.policies} replace />} />
        <Route path="/motor/vehicles" element={<Navigate to={underwritingPaths.motorVehicles} replace />} />
        <Route path="/motor/vehicles/new" element={<Navigate to={underwritingPaths.motorVehicleCreate} replace />} />
        <Route path="/motor/vehicles/:id" element={<Navigate to={underwritingPaths.motorVehicles} replace />} />
        <Route path="/motor/vehicles/:id/edit" element={<Navigate to={underwritingPaths.motorVehicles} replace />} />
        <Route path="/motor/fleets" element={<Navigate to={underwritingPaths.motorFleets} replace />} />
        <Route path="/motor/fleets/new" element={<Navigate to={underwritingPaths.motorFleetCreate} replace />} />
        <Route path="/motor/fleets/:id" element={<Navigate to={underwritingPaths.motorFleets} replace />} />
        <Route path="/motor/fleets/:id/edit" element={<Navigate to={underwritingPaths.motorFleets} replace />} />
        <Route path="/motor/quotation-details" element={<Navigate to={underwritingPaths.motorQuotationDetails} replace />} />
        <Route path="/motor/policy-details" element={<Navigate to={underwritingPaths.motorPolicyDetails} replace />} />
        <Route path="/non-motor/subject-matters" element={<Navigate to={underwritingPaths.nonMotorSubjectMatters} replace />} />
        <Route path="/non-motor/subject-matters/:id" element={<Navigate to={underwritingPaths.nonMotorSubjectMatters} replace />} />
        <Route path="/tiramis/submissions" element={<Navigate to={underwritingPaths.submissions} replace />} />
        <Route path="/tiramis/submissions/:id" element={<Navigate to={underwritingPaths.submissions} replace />} />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to={underwritingPaths.root} replace />} />
        <Route path="*" element={<Navigate to={underwritingPaths.root} replace />} />
      </Routes>
    </>
  )
}
