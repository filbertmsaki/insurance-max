import { Fragment, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/modules/shared/config';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canAccessRoute } from '@/lib/auth/permissions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  NAV_NODES,
  type NavLeaf,
  type NavGroup,
  type NavNode,
} from './nav-config';
import { sidebarLinkClass } from './sidebar-styles';

function isLeafActive(pathname: string, to: string) {
  if (pathname === to) return true;
  if (pathname.startsWith(to + '/')) return true;
  return false;
}

// ─── Visibility helpers ───────────────────────────────────────────────────────

function useNavFilter() {
  const { user } = useAuthStore();

  function isLeafVisible(leaf: NavLeaf): boolean {
    return canAccessRoute(user, {
      requiredPermission: leaf.permission,
      anyPermission: leaf.anyPermission,
      anyRole: leaf.anyRole,
      allowedScopes: leaf.allowedScopes,
      hideForStandardUser: leaf.hideForStandardUser,
    });
  }

  function visibleChildren(group: NavGroup): NavLeaf[] {
    return group.children.filter(isLeafVisible);
  }

  return { isLeafVisible, visibleChildren };
}

// ─── Brand ────────────────────────────────────────────────────────────────────

export function SidebarBrand({
  compact = false,
  subtitle,
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center',
        compact ? 'justify-center' : 'gap-2.5',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
        <ShieldCheck className="h-4.5 w-4.5 text-white" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold tracking-wide text-white">
            {APP_NAME}
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] text-vz-sidebar-item">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export function SidebarSectionTitle({ children }: { children: string }) {
  return (
    <li className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-vz-sidebar-title first:pt-3">
      {children}
    </li>
  );
}

// ─── Leaf item ────────────────────────────────────────────────────────────────

interface LeafItemProps {
  leaf: NavLeaf;
  collapsed: boolean;
  indented?: boolean;
}

function LeafItem({ leaf, collapsed, indented = false }: LeafItemProps) {
  const { pathname } = useLocation();
  const isActive = isLeafActive(pathname, leaf.to);

  if (indented) {
    return (
      <NavLink
        to={leaf.to}
        end={leaf.to === '/dashboard'}
        className={cn(
          'relative flex items-center py-[7px] pl-[3.25rem] pr-5 text-[13px] transition-colors duration-150 outline-none',
          'before:absolute before:left-[2.1rem] before:top-1/2 before:h-px before:w-1.5 before:-translate-y-1/2 before:transition-all',
          isActive
            ? 'text-white before:w-2 before:bg-white'
            : 'text-vz-sidebar-item before:bg-vz-sidebar-item/70 hover:text-white hover:before:bg-white',
        )}
      >
        <span className="truncate">{leaf.label}</span>
      </NavLink>
    );
  }

  const inner = (
    <NavLink
      to={leaf.to}
      end={leaf.to === '/dashboard'}
      className={cn(
        sidebarLinkClass(isActive),
        collapsed && 'mx-auto h-11 w-11 justify-center rounded-md px-0 py-0',
        collapsed && isActive && 'bg-white/10',
      )}
    >
      <leaf.icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{leaf.label}</span>}
    </NavLink>
  );

  if (!collapsed) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {leaf.label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Group item ───────────────────────────────────────────────────────────────

interface GroupItemProps {
  group: NavGroup;
  collapsed: boolean;
  onExpandSidebar?: () => void;
}

function GroupItem({ group, collapsed, onExpandSidebar }: GroupItemProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { visibleChildren } = useNavFilter();

  const children = visibleChildren(group);
  const hasActive = children.some((c) => isLeafActive(pathname, c.to));

  const [isOpen, setIsOpen] = useState(hasActive);

  // Re-sync open state when route changes (e.g. navigating from collapsed mode)
  const [prevHasActive, setPrevHasActive] = useState(hasActive);
  if (hasActive !== prevHasActive) {
    setPrevHasActive(hasActive);
    if (hasActive) setIsOpen(true);
  }

  if (children.length === 0) return null;

  // ── Collapsed mode: icon button → expand sidebar / navigate ────────────────
  if (collapsed) {
    const handleClick = () => {
      if (onExpandSidebar) {
        onExpandSidebar();
        setIsOpen(true);
      } else {
        navigate(children[0].to);
      }
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              'mx-auto flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-150',
              'focus-visible:outline-none focus-visible:bg-white/10',
              hasActive
                ? 'bg-white/10 text-white'
                : 'text-vz-sidebar-item hover:text-white',
            )}
          >
            <group.icon className="h-[18px] w-[18px] shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {group.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Expanded mode: collapsible group ──────────────────────────────────────
  return (
    <div>
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className={cn(sidebarLinkClass(hasActive), 'w-full')}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
      </button>

      {/* Animated children */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-1.5">
            {children.map((leaf) => (
              <LeafItem key={leaf.to} leaf={leaf} collapsed={false} indented />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// A section heading applies to every node after it until the next heading,
// so headings survive even when the node that declares them is hidden.
const NODE_SECTIONS = NAV_NODES.reduce<
  Array<{ node: NavNode; section: string | undefined }>
>((acc, node) => {
  acc.push({ node, section: node.section ?? acc[acc.length - 1]?.section });
  return acc;
}, []);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  mobile?: boolean;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onClose,
  mobile = false,
}: SidebarProps) {
  const { isLeafVisible, visibleChildren } = useNavFilter();
  const isCompact = collapsed && !mobile;

  function isNodeVisible(node: NavNode): boolean {
    if (node.kind === 'link') return isLeafVisible(node);
    return visibleChildren(node).length > 0;
  }

  const visibleNodes = NODE_SECTIONS.filter(({ node }) => isNodeVisible(node));

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-vz-sidebar',
        'overflow-hidden transition-[width] duration-300 ease-in-out',
        isCompact ? 'w-[70px]' : 'w-[250px]',
      )}
    >
      {/* ── Logo / brand ── */}
      <div
        className={cn(
          'flex h-[70px] shrink-0 items-center',
          isCompact ? 'justify-center px-2' : 'px-5',
        )}
      >
        <SidebarBrand compact={isCompact} />

        {/* Mobile close */}
        {mobile && onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto rounded-md p-1.5 text-vz-sidebar-item transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="vz-scroll flex-1 overflow-y-auto overflow-x-hidden pb-6">
        <ul className={cn(isCompact && 'space-y-1 pt-2')}>
          {visibleNodes.map(({ node, section }, index) => {
            const showSection =
              !isCompact &&
              section &&
              section !== visibleNodes[index - 1]?.section;
            return (
              <Fragment key={node.kind === 'link' ? node.to : node.label}>
                {showSection && (
                  <SidebarSectionTitle>{section}</SidebarSectionTitle>
                )}
                <li>
                  {node.kind === 'link' ? (
                    <LeafItem leaf={node} collapsed={isCompact} />
                  ) : (
                    <GroupItem
                      group={node}
                      collapsed={isCompact}
                      onExpandSidebar={onToggleCollapse}
                    />
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
