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
        anyRole: ['SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR'],
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
        permission: 'risk-rating-rules:read',
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
      },
    ],
  },
  {
    kind: 'group',
    label: 'Motor Insurance',
    icon: CarFront,
    children: [
      {
        kind: 'link',
        label: 'Motor Vehicles',
        to: '/motor/vehicles',
        icon: CarFront,
        permission: 'motor:read',
      },
      {
        kind: 'link',
        label: 'Motor Fleets',
        to: '/motor/fleets',
        icon: Truck,
        permission: 'motor:read',
      },
      {
        kind: 'link',
        label: 'Quotation Details',
        to: '/motor/quotation-details',
        icon: FileText,
        permission: 'motor:read',
      },
      {
        kind: 'link',
        label: 'Policy Details',
        to: '/motor/policy-details',
        icon: FileText,
        permission: 'motor:read',
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
        label: 'Quotations',
        to: '/quotations',
        icon: FileText,
        permission: 'quotations:read',
      },
      {
        kind: 'link',
        label: 'Policies',
        to: '/policies',
        icon: FileText,
        permission: 'policies:read',
      },
      {
        kind: 'link',
        label: 'Quotation Wizard',
        to: '/quotations/wizard',
        icon: Calculator,
        permission: 'quotations:create',
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
