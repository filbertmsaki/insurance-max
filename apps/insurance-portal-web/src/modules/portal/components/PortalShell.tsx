import { BellRing, Files, LayoutGrid, MessageSquareText, ShieldCheck, UserCircle2 } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import type { PortalAudience } from '../api';

const navigationIcons = {
  dashboard: LayoutGrid,
  profile: UserCircle2,
  documents: Files,
  notifications: BellRing,
  messages: MessageSquareText,
  signatures: ShieldCheck,
};

export function PortalShell({
  audience,
}: {
  audience: PortalAudience;
}) {
  const user = useAuthStore((state) => state.user);
  const company = useAuthStore((state) => state.company);
  const basePath = `/${audience}`;
  const audienceLabel = audience === 'customer' ? 'Customer' : 'Intermediary';
  const items = [
    { to: `${basePath}/dashboard`, label: 'Dashboard', icon: navigationIcons.dashboard },
    { to: `${basePath}/profile`, label: 'Profile', icon: navigationIcons.profile },
    { to: `${basePath}/documents`, label: 'Documents', icon: navigationIcons.documents },
    { to: `${basePath}/notifications`, label: 'Notifications', icon: navigationIcons.notifications },
    { to: `${basePath}/messages`, label: 'Messages', icon: navigationIcons.messages },
    { to: `${basePath}/signatures`, label: 'Signatures', icon: navigationIcons.signatures },
  ];

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="text-sm font-semibold text-slate-950">
            {audienceLabel} Portal
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {company?.name ?? user?.companyName ?? 'Insurance Max'}
          </div>
          <Badge variant="outline" className="mt-3 border-slate-200 text-slate-600">
            Secure self-service
          </Badge>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="text-sm font-semibold text-slate-950">{audienceLabel} Portal</div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium',
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
