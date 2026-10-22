import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  User,
  KeyRound,
  Menu,
  Bell,
  Search,
  Maximize,
  Minimize,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { CompanySwitcher } from './CompanySwitcher';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { authApi } from '@/modules/shared/auth/api/auth';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { engagementApi } from '@/modules/tenant/engagement/api';
import {
  formatDateTime,
  safeInternalLink,
} from '@/modules/tenant/engagement/utils';

// ─── Component ────────────────────────────────────────────────────────────────

interface HeaderProps {
  onToggleSidebar: () => void;
  /** Omit to hide the search trigger (e.g. in the self-service portal). */
  onOpenCommand?: () => void;
  profilePath?: string;
  notificationsPath?: string;
  /** Hide company/organization switchers. */
  hideSwitchers?: boolean;
}

export function Header({
  onToggleSidebar,
  onOpenCommand,
  profilePath = '/apps/settings/profile',
  notificationsPath = '/apps/notifications',
  hideSwitchers = false,
}: HeaderProps) {
  const navigate = useNavigate();
  const { user, profile, refreshToken, logout } = useAuthStore();
  const isFullscreen = useFullscreen();
  const queryClient = useQueryClient();
  const isCompanyScoped = user?.scope === 'company';

  const notificationsSummaryQuery = useQuery({
    queryKey: ['engagement', 'notifications', 'summary'],
    queryFn: engagementApi.getNotificationUnreadSummary,
    staleTime: 30_000,
    enabled: isCompanyScoped,
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (id: string) => engagementApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'notifications', 'summary'],
      });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'notifications'],
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => {
      logout();
      navigate('/login');
      toast.success('Signed out successfully');
    },
  });

  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : (user?.email ?? '');

  const initials = profile?.first_name
    ? `${profile.first_name[0]}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase();

  const userTypeBadgeColor =
    user?.userType === 'OWNER' || user?.userType === 'SUPER_ADMIN'
      ? 'bg-purple-100 text-purple-700'
      : 'bg-blue-100 text-blue-700';

  return (
    <header className="sticky top-0 z-20 flex h-[70px] shrink-0 items-center justify-between bg-white pl-3 shadow-[0_1px_2px_rgba(56,65,74,0.15)] sm:pl-4">
      {/* ── Left: sidebar toggle + search ── */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="h-[22px] w-[22px]" />
        </button>

        {/* Command palette trigger styled as Velzon's app-search */}
        {onOpenCommand && (
          <button
            type="button"
            onClick={onOpenCommand}
            className="hidden h-[38px] w-64 items-center gap-2 rounded-md bg-vz-body px-3 text-left text-[13px] text-slate-500 transition-colors hover:text-slate-700 sm:flex lg:w-72"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Search...</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* ── Right: switchers + actions + user ── */}
      <div className="flex h-full shrink-0 items-center gap-1 sm:gap-1.5">
        {onOpenCommand && (
          <button
            type="button"
            onClick={onOpenCommand}
            aria-label="Search"
            className={cn(headerIconClass, 'sm:hidden')}
          >
            <Search className="h-5 w-5" />
          </button>
        )}

        {!hideSwitchers && (
          <div className="hidden items-center gap-2 pr-2 lg:flex">
            <CompanySwitcher />
            <OrganizationSwitcher />
          </div>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className={cn(headerIconClass, 'hidden md:flex')}
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Notifications"
              className={cn(headerIconClass, 'relative')}
            >
              <Bell className="h-[21px] w-[21px]" />
              {(notificationsSummaryQuery.data?.count ?? 0) > 0 ? (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                  {Math.min(notificationsSummaryQuery.data?.count ?? 0, 99)}
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 overflow-hidden p-0"
            sideOffset={14}
          >
            <div className="flex items-center justify-between bg-blue-600 px-4 py-3.5 text-white">
              <div>
                <p className="text-[15px] font-semibold">Notifications</p>
                <p className="text-[11px] text-white/70">
                  {notificationsSummaryQuery.data?.count ?? 0} unread
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(notificationsPath)}
                className="rounded bg-white/15 px-2 py-1 text-[11px] font-medium hover:bg-white/25"
              >
                View all
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {(notificationsSummaryQuery.data?.latest ?? []).map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => {
                    markNotificationReadMutation.mutate(item.id);
                    const link = safeInternalLink(item.deep_link);
                    if (link) {
                      navigate(link);
                    } else {
                      navigate(notificationsPath);
                    }
                  }}
                  className="flex items-start gap-3 py-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-semibold text-slate-800">
                        {item.title}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.priority}
                      </Badge>
                    </span>
                    <span className="line-clamp-2 text-xs text-slate-500">
                      {item.message}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {formatDateTime(item.created_at)}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
              {!(notificationsSummaryQuery.data?.latest ?? []).length ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">
                  You&apos;re all caught up.
                </div>
              ) : null}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu — Velzon's shaded profile block */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-full items-center gap-2.5 bg-vz-body px-3 outline-none transition-colors hover:bg-slate-100 sm:px-4"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden flex-col items-start text-left xl:flex">
                <span className="max-w-40 truncate text-[13px] font-semibold leading-tight text-slate-800">
                  {displayName}
                </span>
                <span className="mt-0.5 text-[11px] capitalize leading-tight text-slate-500">
                  {user?.userType?.replace(/_/g, ' ').toLowerCase() ?? ''}
                </span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 xl:block" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60" sideOffset={0}>
            <DropdownMenuLabel className="pb-2">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {displayName}
                  </span>
                  <span className="truncate text-xs font-normal text-slate-500">
                    {user?.email}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-medium',
                    userTypeBadgeColor,
                  )}
                >
                  {user?.userType?.replace(/_/g, ' ')}
                </Badge>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => navigate(profilePath)}>
              <User className="mr-2 h-4 w-4 text-slate-500" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`${profilePath}?tab=password`)}
            >
              <KeyRound className="mr-2 h-4 w-4 text-slate-500" />
              Change Password
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-red-600 focus:bg-red-50 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

const headerIconClass =
  'flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

function toggleFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen?.();
  }
}

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement,
  );
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  return isFullscreen;
}
