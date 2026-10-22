import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import './public.css';
import { useConnectivityStore } from '@/modules/shared/connectivity/store/connectivity.store';
import { retryConnectionNow } from '@/modules/shared/connectivity/lib/connectivity-monitor';
import { BUY_INSURANCE_PATH } from './public-routes';

const navigation = [
  ['/insurance', 'Products'],
  ['/claim-help', 'Claims'],
  ['/faq', 'Help'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
] as const;

export function PublicBrand() {
  return (
    <Link to="/" className="brand" aria-label="Insurance Max home">
      <span className="brand-mark" aria-hidden="true">
        IM
      </span>
      <span>
        Insurance <span className="brand-light">Max</span>
      </span>
    </Link>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  const email = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  const phone = import.meta.env.VITE_SUPPORT_PHONE as string | undefined;
  const address = import.meta.env.VITE_SUPPORT_ADDRESS as string | undefined;
  const onPurchasePage =
    location.pathname === BUY_INSURANCE_PATH ||
    location.pathname === '/motor-insurance';

  useEffect(() => {
    document.documentElement.classList.add('public-html');
    document.body.classList.add('public-body');
    return () => {
      document.documentElement.classList.remove('public-html');
      document.body.classList.remove('public-body');
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-nav">
        <div className="public-container nav-inner">
          <PublicBrand />
          <nav className="desktop-links" aria-label="Main navigation">
            {navigation.map(([path, label]) => (
              <NavLink key={path} to={path}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <Link className="nav-signin" to="/login">
              Sign in
            </Link>
            {!onPurchasePage && (
              <Link className="button button-small" to={BUY_INSURANCE_PATH}>
                Buy insurance
              </Link>
            )}
            <button
              ref={menuButton}
              className="menu-button"
              type="button"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen(!open)}
            >
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
        <nav
          id="mobile-navigation"
          hidden={!open}
          className="mobile-links"
          aria-label="Mobile navigation"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              menuButton.current?.focus();
            }
          }}
        >
          {navigation.map(([path, label]) => (
            <NavLink key={path} to={path} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
          <Link to="/login" onClick={() => setOpen(false)}>
            Sign in
          </Link>
          {!onPurchasePage && (
            <Link
              className="button"
              to={BUY_INSURANCE_PATH}
              onClick={() => setOpen(false)}
            >
              Buy insurance
            </Link>
          )}
        </nav>
      </header>
      <PublicConnectionNotice />
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="public-footer">
        <div className="public-container footer-grid">
          <div className="footer-intro">
            <PublicBrand />
            <p>Insurance products and online motor cover requests in TZS.</p>
          </div>
          <div>
            <h2>Insurance</h2>
            <Link to={BUY_INSURANCE_PATH}>Buy motor insurance</Link>
            <Link to="/insurance">All products</Link>
            <Link to="/claim-help">Claims</Link>
            <Link to="/faq">Help & FAQs</Link>
            <Link to="/login">My account</Link>
          </div>
          <div>
            <h2>Contact</h2>
            {email && (
              <a href={`mailto:${email}`}>
                <Mail size={16} aria-hidden="true" />
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`}>
                <Phone size={16} aria-hidden="true" />
                {phone}
              </a>
            )}
            {address && (
              <p>
                <MapPin size={16} aria-hidden="true" />
                {address}
              </p>
            )}
            <Link to="/contact">Contact options</Link>
            <Link to="/about">About Insurance Max</Link>
          </div>
        </div>
        <div className="public-container footer-bottom">
          <span>
            © {new Date().getFullYear()} Insurance Max. All rights reserved.
          </span>
          <span>Cover is subject to the insurer’s policy terms.</span>
        </div>
      </footer>
    </div>
  );
}

function PublicConnectionNotice() {
  const status = useConnectivityStore((state) => state.status);
  const [retrying, setRetrying] = useState(false);
  if (status !== 'offline') return null;
  return (
    <div className="public-connection-notice" role="status">
      <div className="public-container">
        We cannot connect to online services right now. You can still browse
        information and contact options.{' '}
        <button
          className="text-link"
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try {
              await retryConnectionNow();
            } finally {
              setRetrying(false);
            }
          }}
        >
          {retrying ? 'Checking connection…' : 'Check connection'}
        </button>
      </div>
    </div>
  );
}
