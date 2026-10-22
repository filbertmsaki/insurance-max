import {
  Ban,
  BarChart3,
  FileBarChart,
  Files,
  LayoutDashboard,
  BellRing,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FileSearch,
  FileSignature,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { ClaimsPermissions } from '@insurance-max/contracts';
import type { NavLeaf, NavNode } from '@/components/layout/nav-config';
import { CLAIM_QUEUES } from './constants';
import { claimsPaths } from './paths';
import type { ClaimQueue } from './types';

const QUEUE_ICONS: Record<ClaimQueue, NavLeaf['icon']> = {
  notification: BellRing,
  intimation: ClipboardList,
  assessment: FileSearch,
  discharge: FileSignature,
  payment: Wallet,
  rejection: Ban,
};

/**
 * Sidebar section: direct dashboard, claims analytics, claims queues, and
 * supporting links, with no Claims dropdown.
 */
export function buildClaimsNavNodes(): NavNode[] {
  return [
    {
      kind: 'link',
      section: 'Claims',
      label: 'Dashboard',
      to: claimsPaths.dashboard,
      icon: LayoutDashboard,
      anyPermission: [ClaimsPermissions.DASHBOARD, ClaimsPermissions.READ],
      allowedScopes: ['company'],
    },
    {
      kind: 'link',
      label: 'All Claims',
      to: claimsPaths.list,
      icon: ClipboardCheck,
      permission: ClaimsPermissions.READ,
      allowedScopes: ['company'],
    },
    {
      kind: 'link',
      label: 'Analytics',
      to: '/apps/analytics/metrics',
      icon: BarChart3,
      anyPermission: ['analytics:metrics:read', 'analytics:read'],
      allowedScopes: ['company'],
    },
    {
      kind: 'link',
      label: 'New Claim',
      to: claimsPaths.create,
      icon: FilePlus2,
      permission: ClaimsPermissions.CREATE,
      allowedScopes: ['company'],
    },
    ...CLAIM_QUEUES.map<NavLeaf>((queue) => ({
      kind: 'link',
      label: queue.label,
      to: claimsPaths.queue(queue.queue),
      icon: QUEUE_ICONS[queue.queue],
      permission: ClaimsPermissions.READ,
      allowedScopes: ['company'],
    })),
    {
      kind: 'link',
      label: 'Documents',
      to: claimsPaths.documents,
      icon: Files,
      permission: ClaimsPermissions.DOCUMENT_VERIFY,
      allowedScopes: ['company'],
    },
    {
      kind: 'link',
      label: 'Reports',
      to: claimsPaths.reports,
      icon: FileBarChart,
      permission: ClaimsPermissions.REPORT_READ,
      allowedScopes: ['company'],
    },
    {
      kind: 'link',
      label: 'Configuration',
      to: claimsPaths.configuration,
      icon: SlidersHorizontal,
      permission: ClaimsPermissions.CONFIGURATION_MANAGE,
      allowedScopes: ['company'],
    },
  ];
}
