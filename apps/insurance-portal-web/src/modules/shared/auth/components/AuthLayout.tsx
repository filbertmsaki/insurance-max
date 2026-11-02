import { Outlet, useLocation } from 'react-router-dom';
import { PublicBrand } from '@/modules/public/PublicShell';
import '@/modules/public/public.css';
import './auth-public.css';
import { usePageMeta } from '@/modules/public/usePageMeta';

/** Minimal account shell: brand, form card and a copyright line only. */
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
    <div className="public-site public-auth public-auth-minimal">
      <main
        className={`public-auth-grid${pathname === '/register' ? ' public-auth-grid-wide' : ''}`}
      >
        <div className="public-auth-brand">
          <PublicBrand />
        </div>
        <Outlet />
        <p className="public-auth-footnote">
          © {new Date().getFullYear()} Insurance Max
        </p>
      </main>
    </div>
  );
}
