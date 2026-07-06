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
            <Route element={<ProtectedRoute anyRole={['SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR']} />}>
              <Route path="/api-clients" element={<ApiClientsPage />} />
            </Route>
            <Route path="/settings/profile" element={<ProfilePage />} />

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

            <Route element={<ProtectedRoute requiredPermission="motor:read" />}>
              <Route path="/motor/vehicles" element={<MotorVehiclesPage />} />
              <Route path="/motor/vehicles/:id" element={<MotorVehicleDetailPage />} />
              <Route path="/motor/fleets" element={<MotorFleetsPage />} />
              <Route path="/motor/fleets/:id" element={<MotorFleetDetailPage />} />
              <Route path="/motor/quotation-details" element={<MotorQuotationDetailsPage />} />
              <Route path="/motor/policy-details" element={<MotorPolicyDetailsPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="motor:create" />}>
              <Route path="/motor/vehicles/new" element={<MotorVehicleCreatePage />} />
              <Route path="/motor/fleets/new" element={<MotorFleetCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="motor:update" />}>
              <Route path="/motor/vehicles/:id/edit" element={<MotorVehicleEditPage />} />
              <Route path="/motor/fleets/:id/edit" element={<MotorFleetEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="quotations:read" />}>
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/quotations/:id" element={<QuotationDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="quotations:create" />}>
              <Route path="/quotations/new" element={<QuotationCreatePage />} />
              <Route path="/quotations/wizard" element={<QuotationWizardPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="quotations:update" />}>
              <Route path="/quotations/:id/edit" element={<QuotationEditPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="policies:read" />}>
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/policies/:id" element={<PolicyDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="policies:create" />}>
              <Route path="/policies/new" element={<PolicyCreatePage />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="policies:update" />}>
              <Route path="/policies/:id/edit" element={<PolicyEditPage />} />
            </Route>
          </Route>
        </Route>

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
