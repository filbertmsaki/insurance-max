import { Link, Outlet, useLocation } from 'react-router-dom';
import { FileText, LockKeyhole, ArrowRight } from 'lucide-react';
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
          className={`public-container public-auth-grid${pathname === '/login' ? ' public-auth-grid-login' : ''}`}
        >
          {pathname !== '/login' && (
            <aside className="public-auth-intro">
              <span className="eyebrow">Your insurance account</span>
              <h1>
                Your cover.
                <br /> Within reach.
              </h1>
              <p>
                Access your insurance information and take the next step with
                your policies, claims and requests.
              </p>
              <div className="auth-benefit">
                <FileText size={21} aria-hidden="true" />
                <div>
                  <h2>Keep the details together</h2>
                  <p>
                    View the policies, documents and requests available in your
                    account.
                  </p>
                </div>
              </div>
              <div className="auth-benefit">
                <LockKeyhole size={21} aria-hidden="true" />
                <div>
                  <h2>Sign in securely</h2>
                  <p>
                    Use your existing sign-in method. Additional verification
                    may be required for your account.
                  </p>
                </div>
              </div>
              <Link className="text-link" to="/insurance">
                Explore insurance products{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </aside>
          )}
          <Outlet />
        </div>
      </main>
    </PublicLayout>
  );
}
