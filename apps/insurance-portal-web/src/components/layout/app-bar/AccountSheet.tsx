import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Building,
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { authApi } from '@/modules/shared/auth/api/auth';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { useOrganizationSwitch } from '../useOrganizationSwitch';
import { UserAvatar, type AppBarUser } from './UserAvatar';

function SheetRow({
  icon: Icon,
  label,
  value,
  onSelect,
  danger,
  chevron,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  onSelect: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] outline-none transition-colors duration-[120ms] hover:bg-[var(--color-surface-muted)] focus-visible:shadow-[inset_var(--focus-ring)] active:bg-[var(--color-surface-muted)]',
        danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 stroke-[1.9]" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {value ? (
        <span className="max-w-[45%] truncate text-[13px] text-[var(--color-text-muted)]">
          {value}
        </span>
      ) : null}
      {chevron ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

/**
 * Account menu for phones, opened from the app-bar avatar: user, branch
 * switcher, Profile / Settings / Help and Sign out (with confirmation).
 */
export function AccountSheet({
  open,
  onOpenChange,
  user,
  profilePath,
  settingsPath,
  helpPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppBarUser;
  profilePath: string;
  settingsPath: string;
  helpPath?: string;
}) {
  const navigate = useNavigate();
  const { refreshToken, logout } = useAuthStore();
  const { context, branches, activeBranchName, switchMutation } =
    useOrganizationSwitch();
  const [view, setView] = useState<'menu' | 'branches'>('menu');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const signOut = useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => {
      logout();
      navigate('/login');
      toast.success('Signed out successfully');
    },
  });

  const close = () => {
    onOpenChange(false);
    setView('menu');
  };
  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        title="Account menu"
      >
        {view === 'menu' ? (
          <>
            <div className="flex items-center gap-3 px-4 pt-2 pb-3">
              <UserAvatar user={user} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[var(--color-text)]">
                  {user.name}
                </p>
                <p className="truncate text-[13px] text-[var(--color-text-muted)]">
                  {user.role}
                </p>
              </div>
            </div>
            <div className="border-t border-[var(--color-divider)] py-1">
              {activeBranchName || branches.length > 1 ? (
                <SheetRow
                  icon={Building}
                  label="Branch"
                  value={activeBranchName}
                  chevron={branches.length > 1}
                  onSelect={() => branches.length > 1 && setView('branches')}
                />
              ) : null}
              <SheetRow
                icon={User}
                label="Profile"
                onSelect={() => go(profilePath)}
              />
              <SheetRow
                icon={Settings}
                label="Settings"
                onSelect={() => go(settingsPath)}
              />
              {helpPath ? (
                <SheetRow
                  icon={HelpCircle}
                  label="Help"
                  onSelect={() => go(helpPath)}
                />
              ) : null}
            </div>
            <div className="border-t border-[var(--color-divider)] pt-1">
              <SheetRow
                icon={LogOut}
                label="Sign out"
                danger
                onSelect={() => {
                  close();
                  setConfirmSignOut(true);
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 px-1 pb-1">
              <button
                type="button"
                aria-label="Back to account menu"
                onClick={() => setView('menu')}
                className="flex h-11 w-11 items-center justify-center rounded-full outline-none hover:bg-[var(--color-surface-muted)] focus-visible:shadow-[var(--focus-ring)]"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <p className="text-[15px] font-bold">Branch</p>
            </div>
            <ul
              className="border-t border-[var(--color-divider)] py-1"
              aria-label="Branches"
            >
              {branches.map((branch) => {
                const active = branch.id === context?.activeBranch?.id;
                return (
                  <li key={branch.id}>
                    <button
                      type="button"
                      aria-current={active || undefined}
                      disabled={switchMutation.isPending}
                      onClick={() => {
                        if (!active)
                          switchMutation.mutate({
                            branchId: branch.id,
                            departmentId: context?.activeDepartment?.id ?? null,
                          });
                        close();
                      }}
                      className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] outline-none hover:bg-[var(--color-surface-muted)] focus-visible:shadow-[inset_var(--focus-ring)]"
                    >
                      <span
                        className={cn(
                          'flex-1 truncate',
                          active && 'font-semibold',
                        )}
                      >
                        {branch.name}
                      </span>
                      {active ? (
                        <Check
                          className="h-5 w-5 text-[var(--color-primary-600)]"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out?"
        description="You will need to sign in again to continue."
        confirmLabel="Sign out"
        loading={signOut.isPending}
        onConfirm={() => signOut.mutate()}
      />
    </>
  );
}
