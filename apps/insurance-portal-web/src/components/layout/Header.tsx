import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  User,
  KeyRound,
  Menu,
  Bell,
  ChevronRight,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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

// ─── Route → breadcrumb mapping ───────────────────────────────────────────────

const ROUTE_LABELS: [string, string[]][] = [
  ['/dashboard', ['Dashboard']],
  ['/documents', ['Engagement', 'Documents']],
  ['/document-templates', ['Engagement', 'Document Templates']],
  ['/signatures', ['Engagement', 'Signatures']],
  ['/notifications', ['Engagement', 'Notifications']],
  ['/notification-preferences', ['Engagement', 'Notification Preferences']],
  ['/communications', ['Engagement', 'Communications']],
  ['/work-items', ['Engagement', 'Work Items']],
  ['/users', ['User Management', 'Users']],
  ['/roles', ['User Management', 'Roles']],
  ['/permissions', ['User Management', 'Permissions']],
  ['/companies', ['Company Management', 'Companies']],
  ['/branches', ['Company Management', 'Branches']],
  ['/departments', ['Company Management', 'Departments']],
  ['/company-features', ['Company Management', 'Company Features']],
  ['/my-company', ['Company Management', 'My Company']],
  ['/devices', ['Security', 'Devices']],
  ['/sessions', ['Security', 'Sessions']],
  ['/api-clients', ['Security', 'API Clients']],
  ['/settings/profile', ['Settings', 'Profile']],
  ['/product-engine/categories', ['Product Engine', 'Categories']],
  ['/product-engine/products', ['Product Engine', 'Products']],
  ['/product-engine/sub-classes', ['Product Engine', 'Sub-Classes']],
  ['/product-engine/risks', ['Product Engine', 'Risks']],
  ['/product-engine/rating-factors', ['Product Engine', 'Rating Factors']],
  ['/product-engine/rating-rules', ['Product Engine', 'Rating Rules']],
  ['/product-engine/access/categories', ['Product Engine', 'Category Access']],
  ['/product-engine/access/products', ['Product Engine', 'Product Access']],
  ['/product-engine/calculator', ['Product Engine', 'Calculator']],
  ['/underwriting/quotations', ['Underwriting', 'Quotations']],
  ['/underwriting/policies', ['Underwriting', 'Policies']],
  ['/tiramis/submissions', ['TIRAMIS', 'Submissions']],
  ['/tiramis/configuration', ['TIRAMIS', 'Configuration']],
  ['/underwriting/motor/vehicles', ['Underwriting', 'Motor Vehicles']],
  ['/underwriting/motor/fleets', ['Underwriting', 'Motor Fleets']],
  ['/underwriting/customers', ['Underwriting', 'Customers']],
];

function useBreadcrumb(): string[] {
  const { pathname } = useLocation();
  for (const [prefix, crumbs] of ROUTE_LABELS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return crumbs;
  }
  return ['Dashboard'];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface HeaderProps {
  onMobileMenuToggle: () => void;
  onOpenCommand: () => void;
}

export function Header({ onMobileMenuToggle, onOpenCommand }: HeaderProps) {
  const navigate = useNavigate();
  const { user, profile, refreshToken, logout } = useAuthStore();
  const crumbs = useBreadcrumb();
  const queryClient = useQueryClient();

  const notificationsSummaryQuery = useQuery({
    queryKey: ['engagement', 'notifications', 'summary'],
    queryFn: engagementApi.getNotificationUnreadSummary,
    staleTime: 30_000,
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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
      {/* ── Left: mobile toggle + breadcrumb ── */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuToggle}
          className="md:hidden h-8 w-8 shrink-0"
        >
          <Menu className="h-5 w-5 text-slate-600" />
        </Button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {crumbs.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span
                className={cn(
                  'truncate',
                  i === crumbs.length - 1
                    ? 'text-slate-900 font-semibold'
                    : 'text-slate-500 font-normal hidden sm:block',
                )}
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* ── Right: search + switcher + notifications + user ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Command palette trigger */}
        <button
          onClick={onOpenCommand}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-xs hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300 transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden md:inline">Search…</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 font-mono text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1 py-0.5 ml-1">
            <span>⌘K</span>
          </kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCommand}
          className="sm:hidden h-8 w-8 text-slate-500 hover:text-slate-900"
        >
          <Search className="h-4 w-4" />
        </Button>
        <CompanySwitcher />
        <OrganizationSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative text-slate-500 hover:text-slate-900"
            >
              <Bell className="h-4.5 w-4.5" />
              {(notificationsSummaryQuery.data?.count ?? 0) > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                  {Math.min(notificationsSummaryQuery.data?.count ?? 0, 99)}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80" sideOffset={8}>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => navigate('/notifications')}
              >
                Open all
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(notificationsSummaryQuery.data?.latest ?? []).map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                  markNotificationReadMutation.mutate(item.id);
                  const link = safeInternalLink(item.deep_link);
                  if (link) {
                    navigate(link);
                  } else {
                    navigate('/notifications');
                  }
                }}
                className="flex flex-col items-start gap-1 py-3"
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900">
                    {item.title}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {item.priority}
                  </Badge>
                </div>
                <span className="line-clamp-2 text-xs text-slate-500">
                  {item.message}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatDateTime(item.created_at)}
                </span>
              </DropdownMenuItem>
            ))}
            {!(notificationsSummaryQuery.data?.latest ?? []).length ? (
              <div className="px-3 py-4 text-sm text-slate-500">
                No unread notifications.
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2.5 px-2 h-9 hover:bg-slate-100 focus-visible:ring-0"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-xs font-semibold text-slate-900 leading-none">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-500 leading-none mt-0.5 capitalize">
                  {user?.userType?.replace(/_/g, ' ').toLowerCase() ?? ''}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuLabel className="pb-2">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-slate-500 truncate">
                    {user?.email}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5',
                    userTypeBadgeColor,
                  )}
                >
                  {user?.userType?.replace(/_/g, ' ')}
                </Badge>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
              <User className="mr-2 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/settings/profile?tab=password')}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Change Password
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
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
