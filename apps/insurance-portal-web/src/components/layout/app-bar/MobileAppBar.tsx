import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { AccountSheet } from './AccountSheet';
import { SearchOverlay } from './SearchOverlay';
import { appBarStore, useAppBarState } from './appBarStore';
import { UserAvatar, type AppBarUser } from './UserAvatar';

export const MOBILE_DRAWER_ID = 'mobile-navigation';

function unreadLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

/**
 * Phone (<768px) top app bar, rendered once by the app layout. One white
 * surface with a 1px --color-divider border; the avatar sits on a
 * transparent button. Pages adjust it with <AppBarConfig>.
 */
export function MobileAppBar({
  user,
  fallbackTitle,
  unreadCount = 0,
  drawerOpen,
  onMenu,
  scrolled = false,
  notificationsPath,
  profilePath,
  settingsPath,
  helpPath,
  logoUrl,
}: {
  user: AppBarUser;
  /** Title for pages that set none (from the breadcrumb). */
  fallbackTitle?: string;
  unreadCount?: number;
  drawerOpen: boolean;
  onMenu: () => void;
  /** Adds a subtle shadow once the page has scrolled. */
  scrolled?: boolean;
  notificationsPath: string;
  profilePath: string;
  settingsPath: string;
  helpPath?: string;
  logoUrl?: string;
}) {
  const navigate = useNavigate();
  const { config } = useAppBarState();
  const actionsRef = useCallback(
    (element: HTMLSpanElement | null) => appBarStore.setActionsTarget(element),
    [],
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const variant = config?.variant ?? 'root';
  const inner = variant === 'inner';
  const title = config ? config.title : fallbackTitle;
  const showSearch = config?.showSearch ?? !inner;
  const showNotifications = config?.showNotifications ?? !inner;
  const showAccount = config?.showAccount ?? !inner;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex shrink-0 items-center border-b border-[var(--color-divider)] bg-[var(--color-surface)] pt-[env(safe-area-inset-top)] pr-2 pl-1 transition-shadow duration-[120ms] md:hidden',
        scrolled && 'shadow-[0_1px_2px_rgb(27_31_46/0.06)]',
      )}
    >
      <div className="flex h-14 min-w-0 flex-1 items-center gap-1">
        {inner ? (
          <IconButton aria-label="Back" onClick={() => appBarStore.back()}>
            <ArrowLeft className="h-[22px] w-[22px]" aria-hidden />
          </IconButton>
        ) : (
          <IconButton
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls={MOBILE_DRAWER_ID}
            onClick={onMenu}
          >
            <Menu className="h-[22px] w-[22px]" aria-hidden />
          </IconButton>
        )}

        <div className="min-w-0 flex-1 px-1 leading-tight">
          {inner && config?.subtitle ? (
            <p className="truncate text-[11px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
              {config.subtitle}
            </p>
          ) : null}
          {title ? (
            <h1 className="truncate text-base font-bold text-[var(--color-text)]">
              {title}
            </h1>
          ) : logoUrl ? (
            <img src={logoUrl} alt="Home" className="max-h-7 w-auto" />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Page-specific icon buttons (e.g. a record's ⋯ menu). */}
          <span ref={actionsRef} className="flex items-center empty:hidden" />
          {showSearch ? (
            <IconButton aria-label="Search" onClick={() => setSearchOpen(true)}>
              <Search className="h-5 w-5" aria-hidden />
            </IconButton>
          ) : null}
          {showNotifications ? (
            <IconButton
              aria-label={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
              onClick={() => navigate(notificationsPath)}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unreadCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-[var(--color-surface)]"
                >
                  {unreadLabel(unreadCount)}
                </span>
              ) : null}
            </IconButton>
          ) : null}
          {showAccount ? (
            <button
              type="button"
              aria-label={`Account menu, ${user.name}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(true)}
              className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-[120ms] group-hover:bg-[var(--color-primary-50)] group-active:bg-[var(--color-primary-50)]">
                <UserAvatar user={user} size={32} />
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {showSearch ? (
        <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
      ) : null}
      {showAccount ? (
        <AccountSheet
          open={accountOpen}
          onOpenChange={setAccountOpen}
          user={user}
          profilePath={profilePath}
          settingsPath={settingsPath}
          helpPath={helpPath}
        />
      ) : null}
    </header>
  );
}
