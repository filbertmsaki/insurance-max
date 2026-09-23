import { useLocation } from 'react-router-dom';
import { NAV_NODES, type NavLeaf } from './nav-config';

// Routes that are not in the sidebar but still deserve a friendly trail.
const EXTRA_ROUTES: [string, string[]][] = [
  ['/settings/profile', ['Settings', 'Profile']],
  ['/customer', ['Customer Portal']],
];

interface RouteEntry {
  to: string;
  crumbs: string[];
}

const ROUTE_ENTRIES: RouteEntry[] = [
  ...NAV_NODES.flatMap((node): RouteEntry[] =>
    node.kind === 'link'
      ? [{ to: node.to, crumbs: [node.label] }]
      : node.children.map((leaf: NavLeaf) => ({
          to: leaf.to,
          crumbs: [node.label, leaf.label],
        })),
  ),
  ...EXTRA_ROUTES.map(([to, crumbs]) => ({ to, crumbs })),
]
  // Longest path first so the most specific route wins.
  .sort((a, b) => b.to.length - a.to.length);

function describeRemainder(remainder: string): string | null {
  const segments = remainder.split('/').filter(Boolean);
  if (!segments.length) return null;
  const last = segments[segments.length - 1];
  if (last === 'new' || last === 'create') return 'New';
  if (last === 'edit') return 'Edit';
  return 'Details';
}

/** Breadcrumb trail for the current route, derived from the sidebar config. */
export function useBreadcrumb(): string[] {
  const { pathname } = useLocation();
  const match = ROUTE_ENTRIES.find(
    ({ to }) => pathname === to || pathname.startsWith(to + '/'),
  );
  if (!match) return ['Dashboard'];
  const extra = describeRemainder(pathname.slice(match.to.length));
  return extra ? [...match.crumbs, extra] : match.crumbs;
}
