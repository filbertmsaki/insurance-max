import {
  Ban,
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
import type { NavGroup, NavLeaf } from '@/components/layout/nav-config';
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
 * Sidebar section: Claims → Dashboard | All Claims | New Claim | one entry
 * per stage | Documents | Reports | Configuration.
 * The stage entries are filtered views of the same claims list (§3).
 * Dashboard, Documents and Reports sit around the stage entries.
 */
export function buildClaimsNavNodes(): NavGroup[] {
  return [
    {
      kind: 'group',
      section: 'Claims',
      label: 'Claims',
      icon: ClipboardCheck,
      children: [
        {
          kind: 'link',
          label: 'Dashboard',
          to: claimsPaths.dashboard,
          icon: LayoutDashboard,
          permission: ClaimsPermissions.DASHBOARD,
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
      ],
    },
  ];
}
