import { Outlet, useLocation } from 'react-router-dom';
import { PublicLayout } from '@/modules/public/PublicShell';
import './auth-public.css';
import { usePageMeta } from '@/modules/public/usePageMeta';

export function AuthLayout() {
  const { pathname } = useLocation();
  const pageName =
    pathname === '/register'
      ? 'Create an account'
      : pathname.includes('password')
        ? 'Account access'
        : pathname === '/verify-email'
          ? 'Verify your email'
          : pathname === '/2fa'
            ? 'Account verification'
            : 'Sign in';
  usePageMeta(
    `${pageName} | Insurance Max`,
    'Access your insurance account, policies and requests.',
    true,
  );
  return (
    <PublicLayout>
      <main className="public-auth">
        <div
          className={`public-container public-auth-grid${pathname === '/register' ? ' public-auth-grid-wide' : ''}`}
        >
          <Outlet />
        </div>
      </main>
    </PublicLayout>
  );
}
