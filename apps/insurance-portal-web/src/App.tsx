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
          </Route>
        </Route>

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
