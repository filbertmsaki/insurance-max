import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import {
  BadgeDollarSign,
  BellRing,
  BriefcaseBusiness,
  CarFront,
  ClipboardList,
  FileQuestion,
  Files,
  FileText,
  HandCoins,
  LayoutGrid,
  MessageCircleWarning,
  MessageSquareText,
  ReceiptText,
  Search,
  ShieldCheck,
  ShieldPlus,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from '@/components/layout/Header';
import { PageTitleBar } from '@/components/layout/PageTitleBar';
import { SidebarBrand, SidebarSectionTitle } from '@/components/layout/Sidebar';
import { sidebarLinkClass } from '@/components/layout/sidebar-styles';
import { APP_NAME } from '@/modules/shared/config';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import type { PortalAudience } from '../api';

const navigationIcons = {
  dashboard: LayoutGrid,
  buyCover: ShieldPlus,
  checkCover: Search,
  vehicles: CarFront,
  profile: UserCircle2,
  quotations: FileText,
  policies: BriefcaseBusiness,
  invoices: ReceiptText,
  receipts: HandCoins,
  claims: ClipboardList,
  complaints: MessageCircleWarning,
  requests: FileQuestion,
  customers: Users,
  commissions: BadgeDollarSign,
  documents: Files,
  notifications: BellRing,
  messages: MessageSquareText,
  signatures: ShieldCheck,
};

export function PortalShell({ audience }: { audience: PortalAudience }) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on navigation
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMobileOpen(false);
  }

  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const basePath = `/${audience}`;
  const audienceLabel = audience === 'customer' ? 'Customer' : 'Intermediary';
  const items = [
    {
      to: `${basePath}/dashboard`,
      label: 'Dashboard',
      icon: navigationIcons.dashboard,
    },
    {
      to: `${basePath}/profile`,
      label: 'Profile',
      icon: navigationIcons.profile,
    },
    ...(audience === 'customer'
      ? [
          {
            to: `${basePath}/buy-cover`,
            label: 'Buy Cover',
            icon: navigationIcons.buyCover,
          },
          {
            to: `${basePath}/check-cover`,
            label: 'Check Cover',
            icon: navigationIcons.checkCover,
          },
          {
            to: `${basePath}/vehicles`,
            label: 'Vehicles',
            icon: navigationIcons.vehicles,
          },
        ]
      : []),
    {
      to: `${basePath}/quotations`,
      label: 'Quotations',
      icon: navigationIcons.quotations,
    },
    {
      to: `${basePath}/policies`,
      label: 'Policies',
      icon: navigationIcons.policies,
    },
    {
      to: `${basePath}/invoices`,
      label: 'Invoices',
      icon: navigationIcons.invoices,
    },
    {
      to: `${basePath}/receipts`,
      label: 'Receipts',
      icon: navigationIcons.receipts,
    },
    {
      to: `${basePath}/claims`,
      label: 'Claims',
      icon: navigationIcons.claims,
    },
    {
      to: `${basePath}/complaints`,
      label: 'Complaints',
      icon: navigationIcons.complaints,
    },
    {
      to: `${basePath}/requests`,
      label: 'Requests',
      icon: navigationIcons.requests,
    },
    ...(audience === 'intermediary'
      ? [
          {
            to: `${basePath}/customers`,
            label: 'Customers',
            icon: navigationIcons.customers,
          },
          {
            to: `${basePath}/commissions`,
            label: 'Commissions',
            icon: navigationIcons.commissions,
          },
        ]
      : []),
    {
      to: `${basePath}/documents`,
      label: 'Documents',
      icon: navigationIcons.documents,
    },
    {
      to: `${basePath}/notifications`,
      label: 'Notifications',
      icon: navigationIcons.notifications,
    },
    {
      to: `${basePath}/messages`,
      label: 'Messages',
      icon: navigationIcons.messages,
    },
    {
      to: `${basePath}/signatures`,
      label: 'Signatures',
      icon: navigationIcons.signatures,
    },
  ];

  const sectionFor = (label: string) =>
    PORTAL_SECTIONS.find(([, labels]) => labels.includes(label))?.[0] ?? 'Menu';
  const activeItem = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find(
      (item) =>
        location.pathname === item.to ||
        location.pathname.startsWith(item.to + '/'),
    );
  const crumbs = [
    `${audienceLabel} Portal`,
    ...(activeItem ? [activeItem.label] : []),
    ...(activeItem && location.pathname !== activeItem.to ? ['Details'] : []),
  ];

  const sidebar = (mobile: boolean) => (
    <aside className="flex h-full w-[250px] flex-col bg-vz-sidebar">
      <div className="flex h-[70px] shrink-0 items-center px-5">
        <SidebarBrand
          subtitle={
            company?.name ?? user?.companyName ?? `${audienceLabel} Portal`
          }
        />
        {mobile && (
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="ml-auto rounded-md p-1.5 text-vz-sidebar-item transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="vz-scroll flex-1 overflow-y-auto pb-6">
        <ul>
          {items.map((item, index) => {
            const Icon = item.icon;
            const section = sectionFor(item.label);
            const showSection =
              section !== (index > 0 ? sectionFor(items[index - 1].label) : '');
            return (
              <Fragment key={item.to}>
                {showSection && (
                  <SidebarSectionTitle>{section}</SidebarSectionTitle>
                )}
                <li>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => sidebarLinkClass(isActive)}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>
    </aside>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh overflow-hidden bg-vz-body">
        <div className="hidden shrink-0 lg:flex">{sidebar(false)}</div>

        {/* ── Mobile overlay + drawer ── */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
            mobileOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebar(true)}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            onToggleSidebar={() => setMobileOpen((open) => !open)}
            profilePath={`${basePath}/profile`}
            notificationsPath={`${basePath}/notifications`}
            hideSwitchers
          />
          <main
            ref={mainRef}
            className="vz-main flex min-h-0 flex-1 flex-col overflow-y-auto"
          >
            <PageTitleBar crumbs={crumbs} />
            <div className="w-full flex-1 px-3 py-5 sm:px-5 lg:px-6 lg:py-6">
              <Outlet />
            </div>
            <footer className="flex shrink-0 flex-col gap-1 px-3 py-4 text-[13px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <span>
                {new Date().getFullYear()} © {APP_NAME}.
              </span>
              <span className="hidden sm:inline">Secure self-service</span>
            </footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

const PORTAL_SECTIONS: [string, string[]][] = [
  ['Menu', ['Dashboard', 'Profile', 'Buy Cover', 'Check Cover', 'Vehicles']],
  [
    'My Business',
    [
      'Quotations',
      'Policies',
      'Invoices',
      'Receipts',
      'Claims',
      'Complaints',
      'Requests',
      'Customers',
      'Commissions',
    ],
  ],
  ['Communication', ['Documents', 'Notifications', 'Messages', 'Signatures']],
];
