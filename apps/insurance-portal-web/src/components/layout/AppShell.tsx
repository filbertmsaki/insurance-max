import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { motorInsurancePaths } from '@/modules/tenant/motor-insurance/paths';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { PageFooterProvider } from './PageFooterSlot';
import { PageTitleBar } from './PageTitleBar';
import { useBreadcrumb } from './breadcrumbs';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/modules/shared/config';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const crumbs = useBreadcrumb();
  // Screens with a dedicated phone layout put their title in the app bar.
  // Quotation and policy detail screens (any line) draw their own phone
  // top bar and compact header.
  const isQuotationDetail = /\/(quotations|policies)\/(?!new$)[^/]+$/.test(
    location.pathname,
  );
  const mobileTitle =
    location.pathname === motorInsurancePaths.quotations
      ? { eyebrow: 'Motor Insurance', title: 'Quotations' }
      : location.pathname === motorInsurancePaths.policies
        ? { eyebrow: 'Motor Insurance', title: 'Policies' }
        : undefined;

  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Close mobile sidebar on route change
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMobileOpen(false);
  }

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) setCollapsed((c) => !c);
    else setMobileOpen((o) => !o);
  };

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <PageFooterProvider>
        {(footer) => (
          <div className="flex h-dvh overflow-hidden bg-vz-body">
            {/* ── Desktop sidebar (always in flow, width transitions) ── */}
            <div className="hidden md:flex shrink-0">
              <Sidebar
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
              />
            </div>

            {/* ── Mobile overlay ── */}
            <div
              className={cn(
                'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300',
                mobileOpen
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none',
              )}
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />

            {/* ── Mobile sidebar drawer ── */}
            <div
              className={cn(
                'fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ease-in-out',
                mobileOpen ? 'translate-x-0' : '-translate-x-full',
              )}
            >
              <Sidebar mobile onClose={() => setMobileOpen(false)} />
            </div>

            {/* ── Main content area ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header
                onToggleSidebar={toggleSidebar}
                onOpenCommand={() => setCommandOpen(true)}
                mobileTitle={mobileTitle}
              />
              <main
                ref={mainRef}
                className={cn(
                  'vz-main flex min-h-0 flex-1 flex-col overflow-y-auto',
                  (mobileTitle || isQuotationDetail) && 'max-md:bg-[#F4F5F9]',
                )}
              >
                <PageTitleBar
                  crumbs={crumbs}
                  className={
                    mobileTitle || isQuotationDetail
                      ? 'max-md:hidden'
                      : undefined
                  }
                  links={
                    location.pathname.startsWith(
                      underwritePaths.quotations('fleet'),
                    )
                      ? {
                          Fleet: underwritePaths.lineDashboard('fleet'),
                          Quotations: underwritePaths.quotations('fleet'),
                        }
                      : undefined
                  }
                />
                <div
                  className={
                    isQuotationDetail
                      ? 'w-full flex-1 px-3 py-5 md:px-6 md:py-[14px]'
                      : 'w-full flex-1 px-3 py-5 sm:px-5 lg:px-6 lg:py-6'
                  }
                >
                  <Outlet />
                </div>
                <footer className="flex shrink-0 flex-col gap-1 px-3 py-4 text-[13px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
                  <span>
                    {new Date().getFullYear()} © {APP_NAME}.
                  </span>
                  <span className="hidden sm:inline">
                    Insurance operations platform
                  </span>
                </footer>
              </main>
              {footer && (
                // width matched to QuotationWizardPage's content column (the current sole consumer of usePageFooter)
                <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.25)] sm:px-6 lg:px-8">
                  <div className="mx-auto w-full max-w-[1380px]">{footer}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageFooterProvider>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </TooltipProvider>
  );
}
