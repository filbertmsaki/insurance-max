import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { LogOut, User, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { authApi } from '@/modules/shared/auth/api/auth';
import { canAccessRoute, isStandardCompanyUser } from '@/lib/auth/permissions';
import { NAV_NODES, type NavLeaf, type NavGroup } from './nav-config';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user, refreshToken, logout } = useAuthStore();

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => {
      logout();
      navigate('/login');
      toast.success('Signed out successfully');
    },
  });

  function isLeafVisible(leaf: NavLeaf): boolean {
    return canAccessRoute(user, {
      requiredPermission: leaf.permission,
      anyPermission: leaf.anyPermission,
      anyRole: leaf.anyRole,
      allowedScopes: leaf.allowedScopes,
      hideForStandardUser: leaf.hideForStandardUser,
    });
  }

  function getVisibleLeaves(group: NavGroup): NavLeaf[] {
    if (group.hideForStandardUser && isStandardCompanyUser(user)) return [];

    return group.children.filter(isLeafVisible);
  }

  const navItems: { group: string; leaf: NavLeaf }[] = [];
  for (const node of NAV_NODES) {
    if (node.kind === 'link') {
      if (isLeafVisible(node))
        navItems.push({ group: 'Navigation', leaf: node });
    } else {
      const visible = getVisibleLeaves(node);
      for (const leaf of visible) {
        navItems.push({ group: node.label, leaf });
      }
    }
  }

  const grouped = navItems.reduce<Record<string, NavLeaf[]>>(
    (acc, { group, leaf }) => {
      if (!acc[group]) acc[group] = [];
      acc[group].push(leaf);
      return acc;
    },
    {},
  );

  const runAndClose = useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );

  // Register ⌘K / Ctrl+K globally
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {Object.entries(grouped).map(([groupLabel, leaves]) => (
          <CommandGroup key={groupLabel} heading={groupLabel}>
            {leaves.map((leaf) => (
              <CommandItem
                key={leaf.to}
                onSelect={() => runAndClose(() => navigate(leaf.to))}
              >
                <leaf.icon className="mr-2 h-4 w-4 text-slate-500" />
                {leaf.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => runAndClose(() => navigate('/settings/profile'))}
          >
            <User className="mr-2 h-4 w-4 text-slate-500" />
            My Profile
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => navigate('/settings/profile?tab=password'))
            }
          >
            <KeyRound className="mr-2 h-4 w-4 text-slate-500" />
            Change Password
          </CommandItem>
          <CommandItem
            onSelect={() => runAndClose(() => logoutMutation.mutate())}
            className="text-red-600 data-[selected=true]:bg-red-50 data-[selected=true]:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
            <CommandShortcut>⇧⌘Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
