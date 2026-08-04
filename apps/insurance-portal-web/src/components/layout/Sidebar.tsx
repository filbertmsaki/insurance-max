import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ShieldCheck,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/modules/shared/config';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canAccessRoute } from '@/lib/auth/permissions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NAV_NODES, type NavLeaf, type NavGroup } from './nav-config';

// ─── Visibility helpers ───────────────────────────────────────────────────────

function useNavFilter() {
  const { user } = useAuthStore();

  function isLeafVisible(leaf: NavLeaf): boolean {
    return canAccessRoute(user, {
      requiredPermission: leaf.permission,
      anyPermission: leaf.anyPermission,
      anyRole: leaf.anyRole,
    });
  }

  function visibleChildren(group: NavGroup): NavLeaf[] {
    return group.children.filter(isLeafVisible);
  }

  return { isLeafVisible, visibleChildren };
}

// ─── NavLink item ─────────────────────────────────────────────────────────────

interface LeafItemProps {
  leaf: NavLeaf;
  collapsed: boolean;
  indented?: boolean;
}

function LeafItem({ leaf, collapsed, indented = false }: LeafItemProps) {
  const { pathname } = useLocation();
  const isActive =
    pathname === leaf.to ||
    (leaf.to !== '/dashboard' && pathname.startsWith(leaf.to + '/'));

  const linkClass = cn(
    'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 outline-none',
    'focus-visible:ring-2 focus-visible:ring-blue-500',
    indented ? 'px-3 py-2' : 'px-3 py-2.5',
    collapsed ? 'justify-center px-2 py-2.5 w-10 mx-auto' : '',
    isActive
      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/30'
      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
  );

  const inner = (
    <NavLink to={leaf.to} className={linkClass} end={leaf.to === '/dashboard'}>
      <leaf.icon
        className={cn('shrink-0', indented ? 'h-3.5 w-3.5' : 'h-4 w-4')}
      />
      {!collapsed && <span className="truncate">{leaf.label}</span>}
    </NavLink>
  );

  if (!collapsed) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
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
  const hasActive = children.some(
    (c) =>
      pathname === c.to ||
      (c.to !== '/dashboard' && pathname.startsWith(c.to + '/')),
  );

  const [isOpen, setIsOpen] = useState(hasActive);

  // Re-sync open state when route changes (e.g. navigating from collapsed mode)
  useEffect(() => {
    if (hasActive) setIsOpen(true);
  }, [hasActive]);

  if (children.length === 0) return null;

  // ── Collapsed mode: icon button → navigate to first child ──────────────────
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
              'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-150',
              'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              hasActive && 'bg-slate-800 text-blue-400',
            )}
          >
            <group.icon className="h-4 w-4 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
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
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          hasActive && !isOpen
            ? 'text-slate-200 bg-slate-800'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
        )}
      >
        <group.icon
          className={cn('h-4 w-4 shrink-0', hasActive ? 'text-blue-400' : '')}
        />
        <span className="flex-1 text-left truncate">{group.label}</span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200',
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
          <div className="ml-4 pl-3 border-l border-slate-800 mt-0.5 mb-1 space-y-0.5">
            {children.map((leaf) => (
              <LeafItem key={leaf.to} leaf={leaf} collapsed={false} indented />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  function isNodeVisible(node: (typeof NAV_NODES)[number]): boolean {
    if (node.kind === 'link') return isLeafVisible(node);
    return visibleChildren(node).length > 0;
  }

  return (
    <aside
      className={cn(
        'flex flex-col bg-slate-950 border-r border-slate-800 h-full',
        'transition-[width] duration-300 ease-in-out overflow-hidden',
        collapsed && !mobile ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      {/* ── Logo / brand ── */}
      <div
        className={cn(
          'flex items-center h-16 px-3 shrink-0 border-b border-slate-800',
          collapsed && !mobile ? 'justify-center' : 'gap-3',
        )}
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600 shrink-0">
          <ShieldCheck className="h-4.5 w-4.5 text-white" />
        </div>

        {(!collapsed || mobile) && (
          <span className="font-semibold text-white text-sm truncate flex-1">
            {APP_NAME}
          </span>
        )}

        {/* Mobile close */}
        {mobile && onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Desktop collapse toggle (shown when expanded) */}
        {!mobile && onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="ml-auto p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {NAV_NODES.filter(isNodeVisible).map((node) =>
          node.kind === 'link' ? (
            <LeafItem
              key={node.to}
              leaf={node}
              collapsed={collapsed && !mobile}
            />
          ) : (
            <GroupItem
              key={node.label}
              group={node}
              collapsed={collapsed && !mobile}
              onExpandSidebar={onToggleCollapse}
            />
          ),
        )}
      </nav>

      {/* ── Expand button (collapsed desktop) ── */}
      {collapsed && !mobile && onToggleCollapse && (
        <div className="shrink-0 p-2 border-t border-slate-800">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Expand sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </aside>
  );
}
