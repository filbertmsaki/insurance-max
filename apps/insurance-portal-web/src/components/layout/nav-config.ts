import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  Lock,
  Building2,
  Smartphone,
  Monitor,
  Key,
  Settings,
  User,
  ShieldCheck,
  GitBranch,
  Zap,
  Package,
  Tag,
  Layers,
  FileText,
  AlertTriangle,
  Sliders,
  BookOpen,
  Calculator,
  CarFront,
  Truck,
  Receipt,
  Radar,
  HeartPulse,
  TriangleAlert,
  RefreshCcw,
} from 'lucide-react';

export interface NavLeaf {
  kind: 'link';
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  permission?: string;
  anyRole?: string[];
}

export interface NavGroup {
  kind: 'group';
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: NavLeaf[];
}

export type NavNode = NavLeaf | NavGroup;

export const NAV_NODES: NavNode[] = [
  {
    kind: 'link',
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    kind: 'group',
    label: 'User Management',
    icon: Users,
    children: [
      {
        kind: 'link',
        label: 'Users',
        to: '/users',
        icon: User,
        permission: 'users:read',
      },
      {
        kind: 'link',
        label: 'Roles',
        to: '/roles',
        icon: Shield,
        permission: 'roles:read',
      },
      {
        kind: 'link',
        label: 'Permissions',
        to: '/permissions',
        icon: Lock,
        permission: 'permissions:read',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Company Management',
    icon: Building2,
    children: [
      {
        kind: 'link',
        label: 'Companies',
        to: '/companies',
        icon: Building2,
        anyRole: ['OWNER', 'SUPER_ADMIN'],
      },
      {
        kind: 'link',
        label: 'Branches',
        to: '/branches',
        icon: GitBranch,
        permission: 'branches:read',
      },
      {
        kind: 'link',
        label: 'Departments',
        to: '/departments',
        icon: FileText,
        permission: 'departments:read',
      },
      {
        kind: 'link',
        label: 'Customers',
        to: '/customers',
        icon: Users,
        permission: 'customers:read',
      },
      {
        kind: 'link',
        label: 'Company Features',
        to: '/company-features',
        icon: Zap,
        permission: 'branches:read',
      },
      {
        kind: 'link',
        label: 'My Company',
        to: '/my-company',
        icon: Building2,
        permission: 'view_company_data',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Security',
    icon: ShieldCheck,
    children: [
      { kind: 'link', label: 'Devices', to: '/devices', icon: Smartphone },
      { kind: 'link', label: 'Sessions', to: '/sessions', icon: Monitor },
      {
        kind: 'link',
        label: 'API Clients',
        to: '/api-clients',
        icon: Key,
        anyRole: ['SUPER_ADMIN', 'OWNER'],
      },
    ],
  },
  {
    kind: 'group',
    label: 'Product Engine',
    icon: Package,
    children: [
      {
        kind: 'link',
        label: 'Categories',
        to: '/product-engine/categories',
        icon: Tag,
        permission: 'insurance-categories:read',
      },
      {
        kind: 'link',
        label: 'Products',
        to: '/product-engine/products',
        icon: Package,
        permission: 'insurance-products:read',
      },
      {
        kind: 'link',
        label: 'Sub-Classes',
        to: '/product-engine/sub-classes',
        icon: Layers,
        permission: 'insurance-sub-classes:read',
      },
      {
        kind: 'link',
        label: 'Risks',
        to: '/product-engine/risks',
        icon: AlertTriangle,
        permission: 'insurance-risks:read',
      },
      {
        kind: 'link',
        label: 'Rating Factors',
        to: '/product-engine/rating-factors',
        icon: Sliders,
        permission: 'rating-factors:read',
      },
      {
        kind: 'link',
        label: 'Rating Rules',
        to: '/product-engine/rating-rules',
        icon: BookOpen,
        permission: 'pricing.manage_rules',
      },
      {
        kind: 'link',
        label: 'Category Access',
        to: '/product-engine/access/categories',
        icon: ShieldCheck,
        permission: 'category-access:read',
      },
      {
        kind: 'link',
        label: 'Product Access',
        to: '/product-engine/access/products',
        icon: ShieldCheck,
        permission: 'product-access:read',
      },
      {
        kind: 'link',
        label: 'Calculator',
        to: '/product-engine/calculator',
        icon: Calculator,
        permission: 'pricing.calculate',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Underwriting',
    icon: FileText,
    children: [
      {
        kind: 'link',
        label: 'Create Quotation',
        to: '/underwriting/quotations/new',
        icon: Calculator,
        permission: 'quotations:create',
      },
      {
        kind: 'link',
        label: 'Quotations',
        to: '/underwriting/quotations',
        icon: FileText,
        permission: 'quotations:read',
      },
      {
        kind: 'link',
        label: 'Policies',
        to: '/underwriting/policies',
        icon: FileText,
        permission: 'policies:read',
      },
      {
        kind: 'link',
        label: 'Submission Tracking',
        to: '/underwriting/submissions',
        icon: Radar,
        permission: 'tiramis-submissions:read',
      },
      {
        kind: 'link',
        label: 'Motor Vehicles',
        to: '/underwriting/motor/vehicles',
        icon: CarFront,
        permission: 'motor:read',
      },
      {
        kind: 'link',
        label: 'Motor Fleets',
        to: '/underwriting/motor/fleets',
        icon: Truck,
        permission: 'motor:read',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Billing',
    icon: Receipt,
    children: [
      {
        kind: 'link',
        label: 'Invoices',
        to: '/billing/invoices',
        icon: FileText,
        permission: 'billing:read',
      },
      {
        kind: 'link',
        label: 'Receipts',
        to: '/billing/receipts',
        icon: FileText,
        permission: 'billing:read',
      },
      {
        kind: 'link',
        label: 'Payment Transactions',
        to: '/billing/payment-transactions',
        icon: FileText,
        permission: 'billing:read',
      },
      {
        kind: 'link',
        label: 'Commission Transactions',
        to: '/billing/commission-transactions',
        icon: FileText,
        permission: 'commissions:read',
      },
      {
        kind: 'link',
        label: 'Commission Payments',
        to: '/billing/commission-payments',
        icon: FileText,
        permission: 'commissions:read',
      },
    ],
  },
  {
    kind: 'group',
    label: 'TIRAMIS',
    icon: Radar,
    children: [
      {
        kind: 'link',
        label: 'Submissions',
        to: '/tiramis/submissions',
        icon: FileText,
        permission: 'tiramis-submissions:read',
      },
      {
        kind: 'link',
        label: 'Dashboard',
        to: '/tiramis/dashboard',
        icon: Radar,
        permission: 'tiramis.monitoring.view',
      },
      {
        kind: 'link',
        label: 'Health',
        to: '/tiramis/health',
        icon: HeartPulse,
        permission: 'tiramis.monitoring.view',
      },
      {
        kind: 'link',
        label: 'Tracking',
        to: '/tiramis/tracking',
        icon: FileText,
        permission: 'tiramis.tracking.view',
      },
      {
        kind: 'link',
        label: 'Failed',
        to: '/tiramis/failed',
        icon: TriangleAlert,
        permission: 'tiramis.monitoring.view',
      },
      {
        kind: 'link',
        label: 'Retryable',
        to: '/tiramis/retryable',
        icon: RefreshCcw,
        permission: 'tiramis.monitoring.view',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Settings',
    icon: Settings,
    children: [
      { kind: 'link', label: 'Profile', to: '/settings/profile', icon: User },
    ],
  },
];
