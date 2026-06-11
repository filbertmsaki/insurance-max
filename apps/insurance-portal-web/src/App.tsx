import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { GuestRoute } from '@/components/auth/GuestRoute'
import { AuthBootstrap } from '@/components/auth/AuthBootstrap'

import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage'
import { PhoneLoginPage } from '@/pages/auth/PhoneLoginPage'
import { PasswordlessPage } from '@/pages/auth/PasswordlessPage'
import { TwoFactorPage } from '@/pages/auth/TwoFactorPage'

import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { UsersListPage } from '@/pages/users/UsersListPage'
import { UserDetailPage } from '@/pages/users/UserDetailPage'
import { CompaniesListPage } from '@/pages/companies/CompaniesListPage'
import { CompanyDetailPage } from '@/pages/companies/CompanyDetailPage'
import { MyCompanyPage } from '@/pages/companies/MyCompanyPage'
import { BranchesListPage } from '@/pages/branches/BranchesListPage'
import { BranchDetailPage } from '@/pages/branches/BranchDetailPage'
import { CompanyFeaturesPage } from '@/pages/company-features/CompanyFeaturesPage'
import { RolesPage } from '@/pages/roles/RolesPage'
import { PermissionsPage } from '@/pages/permissions/PermissionsPage'
import { DevicesPage } from '@/pages/devices/DevicesPage'
import { SessionsPage } from '@/pages/sessions/SessionsPage'
import { ApiClientsPage } from '@/pages/api-clients/ApiClientsPage'
import { ProfilePage } from '@/pages/settings/ProfilePage'
import { CategoriesPage } from '@/pages/product-engine/categories/CategoriesPage'
import { ProductsPage } from '@/pages/product-engine/products/ProductsPage'
import { SubClassesPage } from '@/pages/product-engine/sub-classes/SubClassesPage'
import { RisksPage } from '@/pages/product-engine/risks/RisksPage'
import { RatingFactorsPage } from '@/pages/product-engine/rating-factors/RatingFactorsPage'
import { RatingRulesPage } from '@/pages/product-engine/rating-rules/RatingRulesPage'
import { CategoryAccessPage } from '@/pages/product-engine/access/categories/CategoryAccessPage'
import { ProductAccessPage } from '@/pages/product-engine/access/products/ProductAccessPage'
import { CalculatorPage } from '@/pages/product-engine/calculator/CalculatorPage'

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
            <Route element={<ProtectedRoute requiredRole="OWNER" />}>
              <Route path="/companies" element={<CompaniesListPage />} />
              <Route path="/companies/:id" element={<CompanyDetailPage />} />
            </Route>

            {/* Company-scoped users: view/edit their own company */}
            <Route path="/my-company" element={<MyCompanyPage />} />

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
            <Route path="/api-clients" element={<ApiClientsPage />} />
            <Route path="/settings/profile" element={<ProfilePage />} />

            {/* Product Engine */}
            <Route path="/product-engine/categories" element={<CategoriesPage />} />
            <Route path="/product-engine/products" element={<ProductsPage />} />
            <Route path="/product-engine/sub-classes" element={<SubClassesPage />} />
            <Route path="/product-engine/risks" element={<RisksPage />} />
            <Route path="/product-engine/rating-factors" element={<RatingFactorsPage />} />
            <Route path="/product-engine/rating-rules" element={<RatingRulesPage />} />
            <Route path="/product-engine/access/categories" element={<CategoryAccessPage />} />
            <Route path="/product-engine/access/products" element={<ProductAccessPage />} />
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
