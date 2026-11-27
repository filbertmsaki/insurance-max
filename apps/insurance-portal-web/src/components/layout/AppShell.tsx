import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { PageFooterProvider } from './PageFooterSlot';
import { PageTitleBar, titleFor } from './PageTitleBar';
import { MOBILE_DRAWER_ID, MobileAppBar } from './app-bar/MobileAppBar';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { engagementApi } from '@/modules/tenant/engagement/api';
import { useBreadcrumb } from './breadcrumbs';
import * as Dialog from '@radix-ui/react-dialog';
import { APP_NAME } from '@/modules/shared/config';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const crumbs = useBreadcrumb();
  // Quotation and policy detail screens (any line) use a compact layout.
  const isRecordDetail = /\/(quotations|policies)\/(?!new$)[^/]+$/.test(
    location.pathname,
  );
  const isWizard =
    /\/(quotations|claims)\/(new|[^/]+\/edit)\/?$/.test(location.pathname) ||
    /^\/apps\/users\/new\/?$/.test(location.pathname);
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, hasPermission } = useAuthStore();
  const canReadNotifications =
    user?.scope === 'company' && hasPermission('notifications:read');
  const unread = useQuery({
    queryKey: [
      'engagement',
      'notifications',
      'summary',
      user?.id,
      user?.companyId,
    ],
    queryFn: engagementApi.getNotificationUnreadSummary,
    staleTime: 30_000,
    enabled: canReadNotifications,
  });
  const appBarUser = {
    name:
      profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : (user?.email ?? ''),
    role: user?.userType
      ? user.userType
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase())
      : '',
    initials: profile?.first_name
      ? `${profile.first_name[0]}${profile.last_name?.[0] ?? ''}`.toUpperCase()
      : (user?.email?.[0] ?? '?').toUpperCase(),
  };

  useLayoutEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  const swipeStart = useRef<number | null>(null);

  // Close mobile sidebar on route change
  const [prevLocation, setPrevLocation] = useState(location.key);
  if (location.key !== prevLocation) {
    setPrevLocation(location.key);
    setMobileOpen(false);
    setScrolled(false);
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

            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/60 md:hidden" />
                <Dialog.Content
                  id={MOBILE_DRAWER_ID}
                  aria-describedby={undefined}
                  className="fixed inset-y-0 left-0 z-[71] w-[85vw] max-w-[320px] md:hidden [&>aside]:w-full"
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    document
                      .querySelector<HTMLButtonElement>(
                        'button[aria-controls="' + MOBILE_DRAWER_ID + '"]',
                      )
                      ?.focus();
                  }}
                  onClick={(event) => {
                    if (
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey &&
                      event.target instanceof Element &&
                      event.target.closest('a[href]')
                    )
                      setMobileOpen(false);
                  }}
                  onTouchStart={(event) => {
                    swipeStart.current = event.touches[0].clientX;
                  }}
                  onTouchEnd={(event) => {
                    const start = swipeStart.current;
                    swipeStart.current = null;
                    if (
                      start !== null &&
                      start - event.changedTouches[0].clientX > 60
                    ) {
                      setMobileOpen(false);
                    }
                  }}
                >
                  <Dialog.Title className="sr-only">
                    Main navigation
                  </Dialog.Title>
                  <Sidebar mobile onClose={() => setMobileOpen(false)} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            {/* ── Main content area ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="max-md:hidden">
                <Header
                  onToggleSidebar={toggleSidebar}
                  onOpenCommand={() => setCommandOpen(true)}
                />
              </div>
              <MobileAppBar
                user={appBarUser}
                fallbackTitle={titleFor(crumbs)}
                unreadCount={unread.data?.count ?? 0}
                canReadNotifications={canReadNotifications}
                drawerOpen={mobileOpen}
                onMenu={() => setMobileOpen(true)}
                scrolled={scrolled}
                notificationsPath="/apps/notifications"
                profilePath="/apps/settings/profile"
                settingsPath="/apps/settings/number-format"
              />
              <main
                ref={mainRef}
                onScroll={(event) => {
                  const next = event.currentTarget.scrollTop > 0;
                  if (next !== scrolled) setScrolled(next);
                }}
                className="vz-main flex min-h-0 flex-1 flex-col overflow-y-auto max-md:bg-[var(--color-surface-muted)]"
              >
                <PageTitleBar
                  crumbs={crumbs}
                  className="max-md:hidden"
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
                    isRecordDetail
                      ? 'w-full flex-1 px-3 py-5 md:px-6 md:py-[14px]'
                      : 'w-full flex-1 px-3 py-5 sm:px-5 lg:px-6 lg:py-6'
                  }
                >
                  <Outlet />
                </div>
                {!isWizard && (
                  <footer className="max-md:hidden flex shrink-0 flex-col gap-1 px-3 py-4 text-[13px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
                    <span>
                      {new Date().getFullYear()} © {APP_NAME}.
                    </span>
                    <span className="hidden sm:inline">
                      Insurance operations platform
                    </span>
                  </footer>
                )}
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
