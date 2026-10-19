import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import './public.css';
import { useConnectivityStore } from '@/modules/shared/connectivity/store/connectivity.store';
import { retryConnectionNow } from '@/modules/shared/connectivity/lib/connectivity-monitor';

const navigation = [
  ['/', 'Home'],
  ['/insurance', 'Insurance products'],
  ['/about', 'About us'],
  ['/claims', 'Claims & support'],
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
      <div className="utility-bar">
        <div className="public-container utility-inner">
          <span>Insurance for life in Tanzania</span>
          <div>
            {phone && (
              <a href={`tel:${phone}`}>
                <Phone size={13} aria-hidden="true" />
                {phone}
              </a>
            )}
            <Link to="/contact">Contact us</Link>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
      <header className="public-nav">
        <div className="public-container nav-inner">
          <PublicBrand />
          <nav className="desktop-links" aria-label="Main navigation">
            {navigation.map(([path, label]) => (
              <NavLink key={path} to={path} end={path === '/'}>
                {label}
              </NavLink>
            ))}
          </nav>
          <Link className="button button-small nav-quote" to="/buy-cover">
            Get a quote <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <button
            ref={menuButton}
            className="menu-button"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
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
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <Link to="/contact" onClick={() => setOpen(false)}>
            Contact us
          </Link>
          <Link to="/login" onClick={() => setOpen(false)}>
            Sign in to your account
          </Link>
          <Link
            className="button"
            to="/buy-cover"
            onClick={() => setOpen(false)}
          >
            Get a quote <ArrowRight size={16} aria-hidden="true" />
          </Link>
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
            <p>
              Explore insurance, review your premium and take the next step with
              clear information.
            </p>
            <span className="footer-location">Tanzania · TZS</span>
          </div>
          <div>
            <h2>Insurance</h2>
            <Link to="/insurance">Explore all products</Link>
            <Link to="/buy-cover">Motor insurance</Link>
            <Link to="/contact">Business & fleet enquiries</Link>
            <Link to="/buy-cover">Get a quote</Link>
          </div>
          <div>
            <h2>Here to help</h2>
            <Link to="/claims">Claims & support</Link>
            <Link to="/faq">Frequently asked questions</Link>
            <Link to="/login">My account</Link>
            <Link to="/about">About Insurance Max</Link>
          </div>
          <div>
            <h2>Get in touch</h2>
            {email && (
              <a href={`mailto:${email}`}>
                <Mail size={15} aria-hidden="true" />
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`}>
                <Phone size={15} aria-hidden="true" />
                {phone}
              </a>
            )}
            {address && (
              <p>
                <MapPin size={15} aria-hidden="true" />
                {address}
              </p>
            )}
            <Link to="/contact">
              Contact options <ArrowRight size={14} aria-hidden="true" />
            </Link>
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
