import { environment } from '@insurance-max/shared-config';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';
import { Company } from '../../modules/platform/companies/entities/company.entity';
import { CompanyUser } from '../../modules/platform/companies/entities/company-user.entity';
import { CompanyUserRole } from '../../modules/platform/companies/entities/company-user-role.entity';
import { Branch } from '../../modules/tenant/branches/entities/branch.entity';
import { BranchUser } from '../../modules/tenant/branches/entities/branch-user.entity';
import { Permission } from '../../modules/platform/permissions/entities/permission.entity';
import { Role } from '../../modules/platform/roles/entities/role.entity';
import { User } from '../../modules/tenant/users/entities/user.entity';
import { ALLIANCE_BRANCHES, ALLIANCE_TENANT } from './data/alliance.seed-data';

type SeedScope = 'global' | 'default_company';

type PermissionSeed = {
  name: string;
  displayName: string;
  description: string;
  scopes: SeedScope[];
};

type RoleSeed = {
  name: string;
  displayName: string;
  description: string;
  permissionNames: string[];
  scopes: SeedScope[];
};

type SeedUserConfig = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  userNo: string;
  userType: 'OWNER' | 'COMPANY_USER';
  officerTitle: string;
};

type SeedBranchConfig = {
  name: string;
  code: string;
};

const GLOBAL_SCOPE: SeedScope[] = ['global'];
const GLOBAL_AND_DEFAULT_COMPANY_SCOPES: SeedScope[] = [
  'global',
  'default_company',
];

const DASHBOARD_ADMIN_PERMISSION_NAMES = [
  'dashboard:overview',
  'dashboard:sales',
  'dashboard:policies',
  'dashboard:finance',
  'dashboard:commissions',
  'dashboard:tiramis',
  'dashboard:tasks',
  'dashboard:claims',
  'dashboard:reinsurance',
  'dashboard:export',
];

const DASHBOARD_GENERAL_USER_PERMISSION_NAMES = [
  'dashboard:overview',
  'dashboard:sales',
  'dashboard:policies',
  'dashboard:tasks',
];

const DASHBOARD_VIEWER_PERMISSION_NAMES = [
  'dashboard:overview',
  'dashboard:sales',
  'dashboard:policies',
];

const ANALYTICS_ADMIN_PERMISSION_NAMES = [
  'analytics:read',
  'analytics:executive-dashboard',
  'analytics:scorecard-read',
  'analytics:scorecard-generate',
  'analytics:scorecard-publish',
  'analytics:kpi-configure',
  'analytics:anomaly-read',
  'analytics:anomaly-configure',
  'analytics:forecast-read',
  'analytics:forecast-run',
  'analytics:forecast-configure',
  'analytics:benchmark-read',
  'analytics:export',
  'analytics:admin',
];

const PHASE2_ADMIN_PERMISSION_NAMES = [
  'billing:invoice-issue',
  'billing:invoice-void',
  'billing:receipt-post',
  'billing:receipt-allocate',
  'billing:receipt-reverse',
  'billing:reconciliation-manage',
  'billing:closing-create',
  'billing:closing-submit',
  'billing:closing-approve',
  'billing:remittance-create',
  'billing:remittance-submit',
  'billing:remittance-approve',
  'billing:remittance-pay',
  'commissions:settle',
  'commissions:approve',
  'commissions:pay',
  'policies:endorsement-create',
  'policies:endorsement-approve',
  'policies:endorsement-apply',
  'policies:cancellation-create',
  'policies:cancellation-approve',
  'policies:cancellation-apply',
  'policies:renewal-create',
  'policies:renewal-approve',
  'policies:renewal-apply',
  'work-items:read',
  'work-items:manage',
  'notifications:read',
];

const PHASE2_GENERAL_USER_PERMISSION_NAMES = [
  'work-items:read',
  'notifications:read',
];

const CLAIMS_ADMIN_PERMISSION_NAMES = [
  'claims:read',
  'claims:create',
  'claims:update',
  'claims:assign',
  'claims:change-branch',
  'claims:document-upload',
  'claims:document-verify',
  'claims:reserve-create',
  'claims:reserve-approve',
  'claims:reserve-release',
  'claims:assessment-create',
  'claims:assessment-approve',
  'claims:discharge-create',
  'claims:discharge-approve',
  'claims:payment-create',
  'claims:payment-approve',
  'claims:payment-mark-paid',
  'claims:payment-reverse',
  'claims:reject',
  'claims:reopen',
  'claims:close',
  'claims:recovery-create',
  'claims:recovery-update',
  'claims:tiramis-submit',
  'claims:tiramis-retry',
  'claims:override-cover-validation',
  'complaints:read',
  'complaints:create',
  'complaints:assign',
  'complaints:resolve',
  'complaints:escalate',
];

const CLAIMS_PARTNER_PERMISSION_NAMES = [
  'claims:read',
  'claims:create',
  'claims:update',
  'claims:document-upload',
  'claims:tiramis-submit',
  'complaints:read',
  'complaints:create',
];

const REINSURANCE_ADMIN_PERMISSION_NAMES = [
  'reinsurance:read',
  'reinsurance:treaty-create',
  'reinsurance:treaty-update',
  'reinsurance:treaty-submit',
  'reinsurance:treaty-approve',
  'reinsurance:treaty-activate',
  'reinsurance:treaty-suspend',
  'reinsurance:placement-create',
  'reinsurance:placement-update',
  'reinsurance:placement-market',
  'reinsurance:placement-close',
  'reinsurance:offer-read',
  'reinsurance:offer-respond',
  'reinsurance:cession-create',
  'reinsurance:cession-calculate',
  'reinsurance:cession-submit',
  'reinsurance:cession-approve',
  'reinsurance:cession-apply',
  'reinsurance:declaration-create',
  'reinsurance:tiramis-submit',
  'reinsurance:tiramis-retry',
  'reinsurance:bordereau-create',
  'reinsurance:bordereau-submit',
  'reinsurance:bordereau-approve',
  'reinsurance:account-create',
  'reinsurance:account-submit',
  'reinsurance:account-approve',
  'reinsurance:recovery-create',
  'reinsurance:recovery-update',
  'reinsurance:recovery-approve',
  'reinsurance:settlement-create',
  'reinsurance:settlement-approve',
  'reinsurance:settlement-pay',
  'reinsurance:settlement-reconcile',
];

const REINSURANCE_PARTNER_PERMISSION_NAMES = [
  'reinsurance:read',
  'reinsurance:offer-read',
  'reinsurance:offer-respond',
  'reinsurance:recovery-update',
  'reinsurance:recovery-approve',
  'reinsurance:settlement-approve',
  'reinsurance:settlement-reconcile',
];

const REINSURANCE_PERMISSION_SEEDS: PermissionSeed[] = [
  {
    name: 'dashboard:reinsurance',
    displayName: 'View reinsurance dashboard',
    description:
      'Allow viewing reinsurance treaties, cessions, declarations and settlement metrics',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:read',
    displayName: 'Read reinsurance records',
    description:
      'Allow viewing reinsurance treaties, placements, cessions and declarations within scope',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:treaty-create',
    displayName: 'Create reinsurance treaties',
    description: 'Allow drafting treaty reinsurance arrangements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:treaty-update',
    displayName: 'Update reinsurance treaties',
    description:
      'Allow editing draft treaty structures, sections and participants',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:treaty-submit',
    displayName: 'Submit reinsurance treaties',
    description: 'Allow submitting draft treaties for approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:treaty-approve',
    displayName: 'Approve reinsurance treaties',
    description: 'Allow approving submitted treaties',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:treaty-activate',
    displayName: 'Activate reinsurance treaties',
    description: 'Allow activating approved treaties for use in cessions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:treaty-suspend',
    displayName: 'Suspend reinsurance treaties',
    description: 'Allow suspending active treaty arrangements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:placement-create',
    displayName: 'Create facultative placements',
    description: 'Allow opening facultative placements for policy risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:placement-update',
    displayName: 'Update facultative placements',
    description: 'Allow updating open facultative placements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:placement-market',
    displayName: 'Market facultative placements',
    description: 'Allow inviting reinsurers to quote facultative placements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:placement-close',
    displayName: 'Close facultative placements',
    description:
      'Allow accepting quotations and closing facultative placements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:offer-read',
    displayName: 'Read facultative offers',
    description: 'Allow viewing facultative offer invitations and quotes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:offer-respond',
    displayName: 'Respond to facultative offers',
    description: 'Allow reinsurers to quote or decline facultative offers',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:cession-create',
    displayName: 'Create policy cessions',
    description: 'Allow creating reinsurance cessions from policies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:cession-calculate',
    displayName: 'Calculate policy cessions',
    description: 'Allow calculating ceded shares and participant allocations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:cession-submit',
    displayName: 'Submit policy cessions',
    description: 'Allow submitting calculated cessions for approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:cession-approve',
    displayName: 'Approve policy cessions',
    description: 'Allow approving submitted cessions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:cession-apply',
    displayName: 'Apply policy cessions',
    description: 'Allow applying approved cessions back to policies and risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:declaration-create',
    displayName: 'Create reinsurance declarations',
    description:
      'Allow creating TIRAMIS-ready declarations from applied cessions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:tiramis-submit',
    displayName: 'Submit reinsurance declarations to TIRAMIS',
    description: 'Allow submitting reinsurance declarations to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:tiramis-retry',
    displayName: 'Retry reinsurance TIRAMIS submissions',
    description: 'Allow retrying failed reinsurance declaration submissions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:bordereau-create',
    displayName: 'Create reinsurance bordereaux',
    description:
      'Allow generating bordereaux for treaty and facultative business',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:bordereau-submit',
    displayName: 'Submit reinsurance bordereaux',
    description: 'Allow submitting generated bordereaux for review',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:bordereau-approve',
    displayName: 'Approve reinsurance bordereaux',
    description: 'Allow approving bordereaux before onward sharing',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:account-create',
    displayName: 'Create reinsurance premium accounts',
    description: 'Allow preparing reinsurance premium accounts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:account-submit',
    displayName: 'Submit reinsurance premium accounts',
    description: 'Allow submitting premium accounts to counterparties',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:account-approve',
    displayName: 'Approve reinsurance premium accounts',
    description: 'Allow confirming and approving premium accounts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:recovery-create',
    displayName: 'Create reinsurance recoveries',
    description: 'Allow calculating and opening claim recovery records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:recovery-update',
    displayName: 'Update reinsurance recoveries',
    description: 'Allow updating recovery progress and supporting details',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:recovery-approve',
    displayName: 'Approve reinsurance recoveries',
    description: 'Allow admitting or approving recovery amounts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:settlement-create',
    displayName: 'Create reinsurance settlements',
    description: 'Allow preparing settlement and reconciliation batches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:settlement-approve',
    displayName: 'Approve reinsurance settlements',
    description: 'Allow approving settlement instructions and net positions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:settlement-pay',
    displayName: 'Pay reinsurance settlements',
    description: 'Allow marking settlement payments as processed',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:settlement-reconcile',
    displayName: 'Reconcile reinsurance settlements',
    description: 'Allow reconciling counterparty balances and variances',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
];

const defaultBranchSeeds: SeedBranchConfig[] = ALLIANCE_BRANCHES.map(
  (branch) => ({
    name: branch.branchName,
    code: branch.branchCode,
  }),
);

const permissionSeeds: PermissionSeed[] = [
  {
    name: 'create_company',
    displayName: 'Create company',
    description: 'Allow creating a new company tenant',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'view_companies',
    displayName: 'View companies',
    description: 'Allow viewing companies across the platform',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'update_company',
    displayName: 'Update company',
    description: 'Allow updating company details',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'delete_company',
    displayName: 'Delete company',
    description: 'Allow deleting a company',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'create_company_admin',
    displayName: 'Create company administrator',
    description: 'Allow provisioning the first administrator for a company',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'view_company_dashboard',
    displayName: 'View company dashboard',
    description: 'Allow viewing the company dashboard',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'manage_company_users',
    displayName: 'Manage company users',
    description: 'Allow managing users within a company',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'create_company_user',
    displayName: 'Create company user',
    description: 'Allow creating users within a company',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'update_company_user',
    displayName: 'Update company user',
    description: 'Allow updating users within a company',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'delete_company_user',
    displayName: 'Delete company user',
    description: 'Allow deleting users within a company',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'view_company_data',
    displayName: 'View company data',
    description: 'Allow reading company-owned data',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'update_company_data',
    displayName: 'Update company data',
    description: 'Allow updating company-owned data',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'data-scope:company-all',
    displayName: 'Access all company records',
    description:
      'Allow access to all branches and records belonging to the active company',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'data-scope:assigned-branches',
    displayName: 'Access assigned branches',
    description:
      'Allow access to records belonging to all branches assigned to the user',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'data-scope:own-records',
    displayName: 'Access own records',
    description:
      'Restrict operational data to records created or assigned to the user',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'data-scope:partner-portfolio',
    displayName: 'Access partner portfolio',
    description:
      'Allow authorized insurers and intermediaries to read business where they participate as insurer or intermediary',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:overview',
    displayName: 'View dashboard overview',
    description: 'Allow viewing the active company dashboard overview',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:sales',
    displayName: 'View sales dashboard',
    description: 'Allow viewing quotation and sales statistics',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:policies',
    displayName: 'View policy dashboard',
    description: 'Allow viewing policy and cover-note statistics',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:finance',
    displayName: 'View finance dashboard',
    description: 'Allow viewing premium, invoice and receipt statistics',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:commissions',
    displayName: 'View commission dashboard',
    description: 'Allow viewing commission accrual and payment statistics',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:tiramis',
    displayName: 'View TIRAMIS dashboard',
    description: 'Allow viewing company-scoped TIRAMIS statistics and failures',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:tasks',
    displayName: 'View dashboard work queues',
    description: 'Allow viewing dashboard work queues, alerts and action items',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:claims',
    displayName: 'View claims dashboard',
    description: 'Allow viewing claim and complaint dashboard information',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'dashboard:export',
    displayName: 'Export dashboard reports',
    description: 'Allow exporting dashboard and management reports',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:read',
    displayName: 'Read analytics data',
    description: 'Allow reading KPI, scorecard, anomaly, forecast and benchmark analytics data',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:executive-dashboard',
    displayName: 'View analytics executive dashboard',
    description: 'Allow viewing executive analytics dashboards and summaries',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:scorecard-read',
    displayName: 'Read scorecard templates',
    description: 'Allow listing and viewing analytics scorecard templates',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:scorecard-generate',
    displayName: 'Generate scorecards',
    description: 'Allow generating analytics scorecards for selected templates and periods',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:scorecard-publish',
    displayName: 'Publish scorecards',
    description: 'Allow publishing generated analytics scorecard snapshots',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:kpi-configure',
    displayName: 'Configure KPIs',
    description: 'Allow managing analytics KPI definitions and configurations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:anomaly-read',
    displayName: 'Read anomaly findings',
    description: 'Allow reading analytics anomaly findings',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:anomaly-configure',
    displayName: 'Configure anomaly detection',
    description: 'Allow creating, updating and running anomaly detection rules',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:forecast-read',
    displayName: 'Read forecasts',
    description: 'Allow reading analytics forecast definitions and results',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:forecast-run',
    displayName: 'Run forecasts',
    description: 'Allow running analytics forecast definitions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:forecast-configure',
    displayName: 'Configure forecasts',
    description: 'Allow managing analytics forecast definitions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:benchmark-read',
    displayName: 'Read benchmarks',
    description: 'Allow reading benchmark snapshot data',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:export',
    displayName: 'Export analytics data',
    description: 'Allow exporting analytics reports and scorecards',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:admin',
    displayName: 'Manage analytics',
    description: 'Allow full analytics administration and configuration',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  ...REINSURANCE_PERMISSION_SEEDS,
  {
    name: 'companies:create',
    displayName: 'Create companies',
    description: 'Compatibility permission for company creation endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'companies:read',
    displayName: 'Read companies',
    description: 'Compatibility permission for company listing endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'companies:update',
    displayName: 'Update companies',
    description: 'Compatibility permission for company update endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'companies:delete',
    displayName: 'Delete companies',
    description: 'Compatibility permission for company delete endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'users:read',
    displayName: 'Read users',
    description: 'Compatibility permission for user listing endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:create',
    displayName: 'Create users',
    description: 'Compatibility permission for user creation endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:update',
    displayName: 'Update users',
    description: 'Compatibility permission for user update endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:delete',
    displayName: 'Delete users',
    description: 'Compatibility permission for user delete endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:assign-role',
    displayName: 'Assign user roles',
    description: 'Compatibility permission for role assignment endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:revoke-role',
    displayName: 'Revoke user roles',
    description: 'Compatibility permission for role revocation endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'roles:read',
    displayName: 'Read roles',
    description: 'Compatibility permission for role listing endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'roles:create',
    displayName: 'Create roles',
    description: 'Compatibility permission for role creation endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'roles:update',
    displayName: 'Update roles',
    description: 'Compatibility permission for role update endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'roles:delete',
    displayName: 'Delete roles',
    description: 'Compatibility permission for role delete endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'permissions:read',
    displayName: 'Read permissions',
    description: 'Compatibility permission for permission listing endpoints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'permissions:create',
    displayName: 'Create permissions',
    description: 'Compatibility permission for permission creation endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'permissions:update',
    displayName: 'Update permissions',
    description: 'Compatibility permission for permission update endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'permissions:delete',
    displayName: 'Delete permissions',
    description: 'Compatibility permission for permission delete endpoints',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'tiramis-submissions:read',
    displayName: 'Read TIRAMIS submissions',
    description:
      'View TIRAMIS submission status, tracking details, and event history',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis-submissions:create',
    displayName: 'Create TIRAMIS submission',
    description:
      'Submit prepared Motor or Non-Motor payload to TIRAMIS service',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.submit',
    displayName: 'Submit to TIRAMIS',
    description:
      'Allows user to submit cover notes, policies, reinsurance, and claims to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.validate',
    displayName: 'Validate TIRAMIS records',
    description: 'Allows validation of TIRAMIS business records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'verifications:motor:submit',
    displayName: 'Submit motor verifications',
    description: 'Allows motor registration and chassis verification requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'verifications:cover-note:submit',
    displayName: 'Submit cover note verifications',
    description: 'Allows cover note verification requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.tracking.view',
    displayName: 'View TIRAMIS Tracking',
    description:
      'Allows user to view TIRAMIS local tracking, status, and trace',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.monitoring.view',
    displayName: 'View TIRAMIS Monitoring',
    description: 'Allows user to view TIRAMIS admin dashboard and statistics',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.retry',
    displayName: 'Retry TIRAMIS Submissions',
    description: 'Allows user to retry failed or retryable TIRAMIS submissions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.sync',
    displayName: 'Sync TIRAMIS Status',
    description: 'Allows user to sync final responses and business records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.audit.view',
    displayName: 'View TIRAMIS audit logs',
    description: 'Allows viewing TIRAMIS audit history and correlation details',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.notification.view',
    displayName: 'View TIRAMIS notifications',
    description: 'Allows viewing and managing TIRAMIS notifications',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.config.view',
    displayName: 'View TIRAMIS configuration',
    description: 'Allows viewing TIRAMIS integration configuration',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.config.manage',
    displayName: 'Manage TIRAMIS configuration',
    description: 'Allows managing TIRAMIS integration configuration',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'tiramis.admin',
    displayName: 'TIRAMIS Admin',
    description: 'Full TIRAMIS administration permission',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:read',
    displayName: 'Read claims',
    description: 'Allow listing and viewing claim records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:create',
    displayName: 'Create claims',
    description: 'Allow creating claim notifications and related records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:update',
    displayName: 'Update claims',
    description: 'Allow updating claim details within permitted scope',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:assign',
    displayName: 'Assign claims',
    description: 'Allow assigning claims to users or service providers',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:change-branch',
    displayName: 'Change claim branch',
    description: 'Allow changing the operational branch for a claim',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:document-upload',
    displayName: 'Upload claim documents',
    description: 'Allow uploading supporting claim documents',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:document-verify',
    displayName: 'Verify claim documents',
    description: 'Allow verifying or rejecting uploaded claim documents',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:reserve-create',
    displayName: 'Create claim reserves',
    description: 'Allow drafting and submitting claim reserve records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:reserve-approve',
    displayName: 'Approve claim reserves',
    description: 'Allow approving submitted claim reserve records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:reserve-release',
    displayName: 'Release claim reserves',
    description: 'Allow releasing approved claim reserves',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:assessment-create',
    displayName: 'Create claim assessments',
    description: 'Allow creating and submitting claim assessments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:assessment-approve',
    displayName: 'Approve claim assessments',
    description: 'Allow approving submitted claim assessments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:discharge-create',
    displayName: 'Create discharge vouchers',
    description: 'Allow creating and submitting claim discharge vouchers',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:discharge-approve',
    displayName: 'Approve discharge vouchers',
    description: 'Allow approving claim discharge vouchers',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:payment-create',
    displayName: 'Create claim payments',
    description: 'Allow creating and submitting claim payment records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:payment-approve',
    displayName: 'Approve claim payments',
    description: 'Allow approving submitted claim payment records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:payment-mark-paid',
    displayName: 'Mark claim payments paid',
    description: 'Allow completing approved claim payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:payment-reverse',
    displayName: 'Reverse claim payments',
    description: 'Allow reversing completed claim payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:reject',
    displayName: 'Reject claims',
    description: 'Allow rejecting claim records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:reopen',
    displayName: 'Reopen claims',
    description: 'Allow reopening previously rejected or closed claims',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:close',
    displayName: 'Close claims',
    description: 'Allow closing claims after settlement or rejection',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:recovery-create',
    displayName: 'Create claim recoveries',
    description: 'Allow creating expected recovery records for claims',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:recovery-update',
    displayName: 'Update claim recoveries',
    description: 'Allow updating claim recovery lifecycle records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:tiramis-submit',
    displayName: 'Submit claim records to TIRAMIS',
    description: 'Allow submitting claim business records to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:tiramis-retry',
    displayName: 'Retry TIRAMIS claim submission',
    description: 'Allow retrying failed claim submissions to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claims:override-cover-validation',
    displayName: 'Override claim cover validation',
    description:
      'Allow creating a claim even when the loss date is outside policy cover',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:read',
    displayName: 'Read complaints',
    description: 'Allow viewing complaint records linked to claims or policies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:create',
    displayName: 'Create complaints',
    description: 'Allow logging customer complaints',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:assign',
    displayName: 'Assign complaints',
    description: 'Allow acknowledging and assigning complaint records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:resolve',
    displayName: 'Resolve complaints',
    description: 'Allow resolving complaint records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:escalate',
    displayName: 'Escalate complaints',
    description: 'Allow escalating complaint records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'branches:read',
    displayName: 'Read branches',
    description: 'Allow listing and viewing company branches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'branches:create',
    displayName: 'Create branches',
    description: 'Allow creating company branches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'branches:update',
    displayName: 'Update branches',
    description: 'Allow updating company branches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'branches:delete',
    displayName: 'Delete branches',
    description: 'Allow deleting company branches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'branches:manage-access',
    displayName: 'Manage branch access',
    description:
      'Allow granting and revoking branch-level access for company users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'departments:read',
    displayName: 'Read departments',
    description: 'Allow listing and viewing company departments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'departments:create',
    displayName: 'Create departments',
    description: 'Allow creating company departments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'departments:update',
    displayName: 'Update departments',
    description: 'Allow updating company departments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'departments:delete',
    displayName: 'Delete departments',
    description: 'Allow deleting company departments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'positions:read',
    displayName: 'Read positions',
    description: 'Allow listing and viewing company positions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'positions:create',
    displayName: 'Create positions',
    description: 'Allow creating company positions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'positions:update',
    displayName: 'Update positions',
    description: 'Allow updating company positions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'positions:delete',
    displayName: 'Delete positions',
    description: 'Allow deleting company positions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'employees:read',
    displayName: 'Read employees',
    description: 'Allow listing and viewing employee profiles',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'employees:create',
    displayName: 'Create employees',
    description: 'Allow creating employee profiles for existing company users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'employees:update',
    displayName: 'Update employees',
    description: 'Allow updating employee profiles and documents',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'employees:delete',
    displayName: 'Delete employees',
    description: 'Allow deleting employee profiles',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'employees:onboard',
    displayName: 'Onboard employees',
    description:
      'Allow onboarding employees by creating the user and HR profile',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'employees:change-status',
    displayName: 'Change employee status',
    description: 'Allow managing employee lifecycle statuses',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Insurance Categories ──────────────────────────────────────────────────
  {
    name: 'insurance-categories:read',
    displayName: 'Read insurance categories',
    description: 'Allow listing and viewing insurance categories',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-categories:create',
    displayName: 'Create insurance categories',
    description: 'Allow creating insurance categories',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-categories:update',
    displayName: 'Update insurance categories',
    description: 'Allow updating insurance categories',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-categories:delete',
    displayName: 'Delete insurance categories',
    description: 'Allow deleting insurance categories',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Insurance Products ────────────────────────────────────────────────────
  {
    name: 'insurance-products:read',
    displayName: 'Read insurance products',
    description: 'Allow listing and viewing insurance products',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-products:create',
    displayName: 'Create insurance products',
    description: 'Allow creating insurance products',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-products:update',
    displayName: 'Update insurance products',
    description: 'Allow updating insurance products',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-products:delete',
    displayName: 'Delete insurance products',
    description: 'Allow deleting insurance products',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Insurance Sub-Classes ─────────────────────────────────────────────────
  {
    name: 'insurance-sub-classes:read',
    displayName: 'Read insurance sub-classes',
    description: 'Allow listing and viewing insurance sub-classes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-sub-classes:create',
    displayName: 'Create insurance sub-classes',
    description: 'Allow creating insurance sub-classes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-sub-classes:update',
    displayName: 'Update insurance sub-classes',
    description: 'Allow updating insurance sub-classes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-sub-classes:delete',
    displayName: 'Delete insurance sub-classes',
    description: 'Allow deleting insurance sub-classes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Insurance Risks ───────────────────────────────────────────────────────
  {
    name: 'insurance-risks:read',
    displayName: 'Read insurance risks',
    description: 'Allow listing and viewing insurance risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-risks:create',
    displayName: 'Create insurance risks',
    description: 'Allow creating insurance risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-risks:update',
    displayName: 'Update insurance risks',
    description: 'Allow updating insurance risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-risks:delete',
    displayName: 'Delete insurance risks',
    description: 'Allow deleting insurance risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Rating Factors ────────────────────────────────────────────────────────
  {
    name: 'rating-factors:read',
    displayName: 'Read rating factors',
    description:
      'Allow listing and viewing rating factors and risk required factors',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'rating-factors:create',
    displayName: 'Create rating factors',
    description: 'Allow creating rating factors and assigning them to risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'rating-factors:update',
    displayName: 'Update rating factors',
    description:
      'Allow updating rating factors and risk required factor assignments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'rating-factors:delete',
    displayName: 'Delete rating factors',
    description:
      'Allow deleting rating factors and removing factor assignments from risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Risk Rating Rules & Conditions ────────────────────────────────────────
  {
    name: 'risk-rating-rules:read',
    displayName: 'Read rating rules',
    description:
      'Allow listing and viewing risk rating rules and their conditions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'risk-rating-rules:create',
    displayName: 'Create rating rules',
    description: 'Allow creating risk rating rules and rule conditions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'risk-rating-rules:update',
    displayName: 'Update rating rules',
    description: 'Allow updating risk rating rules and rule conditions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'risk-rating-rules:delete',
    displayName: 'Delete rating rules',
    description: 'Allow deleting risk rating rules and rule conditions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Category Access Control ───────────────────────────────────────────────
  {
    name: 'category-access:read',
    displayName: 'Read category access rules',
    description:
      'Allow viewing category access rules for branches, departments, and users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'category-access:manage',
    displayName: 'Manage category access',
    description:
      'Allow granting and revoking category access for branches, departments, and users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Product Access Control ────────────────────────────────────────────────
  {
    name: 'product-access:read',
    displayName: 'Read product access rules',
    description:
      'Allow viewing product access rules for branches, departments, and users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-access:manage',
    displayName: 'Manage product access',
    description:
      'Allow granting and revoking product access for branches, departments, and users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },

  // ── Premium Calculation ───────────────────────────────────────────────────
  {
    name: 'premium-calculation:calculate',
    displayName: 'Calculate premiums',
    description:
      'Allow invoking the premium calculation engine for single and multi-risk quotes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.calculate',
    displayName: 'Calculate premiums',
    description:
      'Allow invoking the pricing engine for premium calculations and rule explanations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.view_breakdown',
    displayName: 'View pricing breakdowns',
    description:
      'Allow viewing stored pricing quote snapshots and quotation pricing breakdown summaries',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.manage_rules',
    displayName: 'Manage pricing rules',
    description:
      'Allow managing pricing rules and their conditions for authoritative premium calculation',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.manage_rate_books',
    displayName: 'Manage pricing rate books',
    description:
      'Allow creating, editing, cloning, and deleting pricing rate books',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.publish_rate_books',
    displayName: 'Publish pricing rate books',
    description:
      'Allow progressing pricing rate books through review, approval, publication, and retirement',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.request_discount',
    displayName: 'Request pricing discounts',
    description:
      'Allow requesting discount adjustments on quotations that rely on authoritative pricing',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.approve_discount',
    displayName: 'Approve pricing discounts',
    description:
      'Allow approving or rejecting controlled discount adjustments on quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.request_override',
    displayName: 'Request pricing overrides',
    description: 'Allow requesting manual premium overrides on quotation risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.approve_override',
    displayName: 'Approve pricing overrides',
    description:
      'Allow approving or rejecting manual premium override requests on quotation risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.view_audit',
    displayName: 'View pricing audit trail',
    description:
      'Allow viewing pricing-specific override and audit trail information on quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customers:read',
    displayName: 'Read customers',
    description: 'Allow listing and viewing customers within a company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customers:create',
    displayName: 'Create customers',
    description: 'Allow creating customers within a company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customers:update',
    displayName: 'Update customers',
    description: 'Allow updating customers within a company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customers:delete',
    displayName: 'Delete customers',
    description: 'Allow deleting customers within a company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-partners:read',
    displayName: 'Read insurance partners',
    description: 'Allow listing insurer and intermediary partner relationships',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-partners:create',
    displayName: 'Create insurance partners',
    description:
      'Allow creating insurer and intermediary partner relationships',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-partners:update',
    displayName: 'Update insurance partners',
    description:
      'Allow updating insurer and intermediary partner relationships',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-partners:approve',
    displayName: 'Approve insurance partners',
    description:
      'Allow approving insurer and intermediary partner relationships',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-partners:suspend',
    displayName: 'Suspend insurance partners',
    description:
      'Allow suspending insurer and intermediary partner relationships',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insurance-partners:terminate',
    displayName: 'Terminate insurance partners',
    description:
      'Allow terminating insurer and intermediary partner relationships',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-distribution:read',
    displayName: 'Read product distribution rules',
    description:
      'Allow viewing distribution, commission, tax, and document rules',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-distribution:create',
    displayName: 'Create product distribution rules',
    description:
      'Allow creating distribution, commission, tax, and document rules',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-distribution:update',
    displayName: 'Update product distribution rules',
    description:
      'Allow updating distribution, commission, tax, and document rules',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-distribution:delete',
    displayName: 'Delete product distribution rules',
    description:
      'Allow deleting distribution, commission, tax, and document rules',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:read',
    displayName: 'Read quotations',
    description: 'Allow listing and viewing quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:create',
    displayName: 'Create quotations',
    description: 'Allow creating quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:update',
    displayName: 'Update quotations',
    description: 'Allow updating quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:submit',
    displayName: 'Submit quotations',
    description:
      'Allow validating payment and submitting quotations to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:delete',
    displayName: 'Delete quotations',
    description: 'Allow deleting quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.override.request',
    displayName: 'Request manual premium overrides',
    description: 'Allow requesting manual premium overrides on quotation risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.override.approve',
    displayName: 'Approve manual premium overrides',
    description:
      'Allow approving manual premium override requests on quotation risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.override.reject',
    displayName: 'Reject manual premium overrides',
    description:
      'Allow rejecting manual premium override requests on quotation risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing.override.view',
    displayName: 'View manual premium overrides',
    description:
      'Allow viewing manual premium override history on quotation risks',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'motor:read',
    displayName: 'Read motor details',
    description: 'Allow listing and viewing motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'motor:create',
    displayName: 'Create motor details',
    description: 'Allow creating motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'motor:update',
    displayName: 'Update motor details',
    description: 'Allow updating motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'motor:delete',
    displayName: 'Delete motor details',
    description: 'Allow deleting motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'non-motor:read',
    displayName: 'Read non-motor details',
    description: 'Allow listing and viewing non-motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'non-motor:create',
    displayName: 'Create non-motor details',
    description: 'Allow creating non-motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'non-motor:update',
    displayName: 'Update non-motor details',
    description: 'Allow updating non-motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'non-motor:delete',
    displayName: 'Delete non-motor details',
    description: 'Allow deleting non-motor detail records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:read',
    displayName: 'Read policies',
    description: 'Allow listing and viewing policies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:create',
    displayName: 'Create policies',
    description: 'Allow creating policies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:update',
    displayName: 'Update policies',
    description: 'Allow updating policies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:delete',
    displayName: 'Delete policies',
    description: 'Allow deleting policies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:read',
    displayName: 'Read billing records',
    description: 'Allow listing and viewing invoices, receipts, and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:create',
    displayName: 'Create billing records',
    description: 'Allow creating invoices, receipts, and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:update',
    displayName: 'Update billing records',
    description: 'Allow updating invoices, receipts, and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:delete',
    displayName: 'Delete billing records',
    description: 'Allow deleting invoices, receipts, and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:invoice-issue',
    displayName: 'Issue invoices',
    description: 'Allow issuing draft invoices',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:invoice-void',
    displayName: 'Void invoices',
    description: 'Allow voiding issued invoices',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:receipt-post',
    displayName: 'Post receipts',
    description: 'Allow posting received receipts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:receipt-allocate',
    displayName: 'Allocate receipts',
    description: 'Allow allocating receipts to invoices',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:receipt-reverse',
    displayName: 'Reverse receipts',
    description: 'Allow reversing posted receipts and allocations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:reconciliation-manage',
    displayName: 'Manage reconciliation',
    description: 'Allow managing reconciliation activities',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:closing-create',
    displayName: 'Create sales-point closings',
    description: 'Allow creating sales-point closing records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:closing-submit',
    displayName: 'Submit sales-point closings',
    description: 'Allow submitting sales-point closings for approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:closing-approve',
    displayName: 'Approve sales-point closings',
    description: 'Allow approving sales-point closings',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:remittance-create',
    displayName: 'Create premium remittances',
    description: 'Allow creating premium remittance records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:remittance-submit',
    displayName: 'Submit premium remittances',
    description: 'Allow submitting premium remittances',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:remittance-approve',
    displayName: 'Approve premium remittances',
    description: 'Allow approving premium remittances',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'billing:remittance-pay',
    displayName: 'Pay premium remittances',
    description: 'Allow marking premium remittances as paid',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:read',
    displayName: 'Read commission records',
    description:
      'Allow listing and viewing commission transactions and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:create',
    displayName: 'Create commission records',
    description: 'Allow creating commission transactions and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:update',
    displayName: 'Update commission records',
    description: 'Allow updating commission transactions and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:delete',
    displayName: 'Delete commission records',
    description: 'Allow deleting commission transactions and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:settle',
    displayName: 'Settle commissions',
    description: 'Allow settling commission balances',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:approve',
    displayName: 'Approve commissions',
    description: 'Allow approving commission settlements and payments',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'commissions:pay',
    displayName: 'Pay commissions',
    description: 'Allow marking commission payments as paid',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:endorsement-create',
    displayName: 'Create policy endorsements',
    description: 'Allow creating policy endorsement requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:endorsement-approve',
    displayName: 'Approve policy endorsements',
    description: 'Allow approving policy endorsement requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:endorsement-apply',
    displayName: 'Apply policy endorsements',
    description: 'Allow applying approved policy endorsements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:cancellation-create',
    displayName: 'Create policy cancellations',
    description: 'Allow creating policy cancellation requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:cancellation-approve',
    displayName: 'Approve policy cancellations',
    description: 'Allow approving policy cancellation requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:cancellation-apply',
    displayName: 'Apply policy cancellations',
    description: 'Allow applying approved policy cancellations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:renewal-create',
    displayName: 'Create policy renewals',
    description: 'Allow creating policy renewal requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:renewal-approve',
    displayName: 'Approve policy renewals',
    description: 'Allow approving policy renewal requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policies:renewal-apply',
    displayName: 'Apply policy renewals',
    description: 'Allow applying approved policy renewals',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:read',
    displayName: 'Read work items',
    description: 'Allow viewing work items assigned to the user or role',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:manage',
    displayName: 'Manage work items',
    description: 'Allow completing and managing work items',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'notifications:read',
    displayName: 'Read notifications',
    description: 'Allow viewing tenant notifications',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:customer-access',
    displayName: 'Access customer portal',
    description: 'Access the customer self-service portal',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:intermediary-access',
    displayName: 'Access intermediary portal',
    description: 'Access the intermediary self-service portal',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:account-read',
    displayName: 'Read portal accounts',
    description: 'View customer and intermediary portal accounts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:account-invite',
    displayName: 'Invite portal accounts',
    description: 'Invite customer and intermediary portal users',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:account-update',
    displayName: 'Update portal accounts',
    description: 'Update customer and intermediary portal accounts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:account-suspend',
    displayName: 'Suspend portal accounts',
    description: 'Suspend and activate portal accounts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:request-read',
    displayName: 'Read portal requests',
    description: 'View portal service requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:request-assign',
    displayName: 'Assign portal requests',
    description: 'Assign portal service requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:request-review',
    displayName: 'Review portal requests',
    description: 'Review portal service requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'portal:request-complete',
    displayName: 'Complete portal requests',
    description: 'Complete portal service requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
];

const PORTAL_ADMIN_PERMISSION_NAMES = [
  'portal:account-read',
  'portal:account-invite',
  'portal:account-update',
  'portal:account-suspend',
  'portal:request-read',
  'portal:request-assign',
  'portal:request-review',
  'portal:request-complete',
];

const TIRAMIS_ADMIN_PERMISSION_NAMES = [
  'tiramis.submit',
  'tiramis.validate',
  'verifications:motor:submit',
  'verifications:cover-note:submit',
  'tiramis.tracking.view',
  'tiramis.monitoring.view',
  'tiramis.retry',
  'tiramis.sync',
  'tiramis.audit.view',
  'tiramis.notification.view',
  'tiramis.config.view',
  'tiramis.config.manage',
  'tiramis.admin',
];

const roleSeeds: RoleSeed[] = [
  {
    name: 'OWNER',
    displayName: 'Platform Owner',
    description: 'Global platform-level owner with no company membership',
    scopes: GLOBAL_SCOPE,
    permissionNames: [
      'create_company',
      'view_companies',
      'update_company',
      'delete_company',
      'create_company_admin',
      'companies:create',
      'companies:read',
      'companies:update',
      'companies:delete',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'permissions:read',
      'permissions:create',
      'permissions:update',
      'permissions:delete',
      'tiramis-submissions:read',
      'tiramis.admin',
    ],
  },
  {
    name: 'ADMINISTRATOR',
    displayName: 'Company Administrator',
    description: 'Administrator with full access limited to their own company',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...ANALYTICS_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      ...CLAIMS_ADMIN_PERMISSION_NAMES,
      ...REINSURANCE_ADMIN_PERMISSION_NAMES,
      ...PORTAL_ADMIN_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'delete_company_user',
      'data-scope:company-all',
      'data-scope:partner-portfolio',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'permissions:read',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      'tiramis.tracking.view',
      'branches:read',
      'branches:create',
      'branches:update',
      'branches:delete',
      'branches:manage-access',
      'departments:read',
      'departments:create',
      'departments:update',
      'departments:delete',
      'positions:read',
      'positions:create',
      'positions:update',
      'positions:delete',
      'employees:read',
      'employees:create',
      'employees:update',
      'employees:delete',
      'employees:onboard',
      'employees:change-status',
      // Insurance Product Engine
      'insurance-categories:read',
      'insurance-categories:create',
      'insurance-categories:update',
      'insurance-categories:delete',
      'insurance-products:read',
      'insurance-products:create',
      'insurance-products:update',
      'insurance-products:delete',
      'insurance-sub-classes:read',
      'insurance-sub-classes:create',
      'insurance-sub-classes:update',
      'insurance-sub-classes:delete',
      'insurance-risks:read',
      'insurance-risks:create',
      'insurance-risks:update',
      'insurance-risks:delete',
      'rating-factors:read',
      'rating-factors:create',
      'rating-factors:update',
      'rating-factors:delete',
      'risk-rating-rules:read',
      'risk-rating-rules:create',
      'risk-rating-rules:update',
      'risk-rating-rules:delete',
      'category-access:read',
      'category-access:manage',
      'product-access:read',
      'product-access:manage',
      'premium-calculation:calculate',
      'insurance-partners:read',
      'insurance-partners:create',
      'insurance-partners:update',
      'insurance-partners:approve',
      'insurance-partners:suspend',
      'insurance-partners:terminate',
      'product-distribution:read',
      'product-distribution:create',
      'product-distribution:update',
      'product-distribution:delete',
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'quotations:delete',
      'pricing.override.request',
      'pricing.override.approve',
      'pricing.override.reject',
      'pricing.override.view',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      ...TIRAMIS_ADMIN_PERMISSION_NAMES,
      'motor:read',
      'motor:create',
      'motor:update',
      'motor:delete',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'policies:create',
      'policies:update',
      'policies:delete',
      'billing:read',
      'billing:create',
      'billing:update',
      'billing:delete',
      'commissions:read',
      'commissions:create',
      'commissions:update',
      'commissions:delete',
    ],
  },
  {
    name: 'INSURANCE_ADMIN',
    displayName: 'Insurance Company Administrator',
    description: 'Administrator for an Insurance Company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      ...CLAIMS_ADMIN_PERMISSION_NAMES,
      ...REINSURANCE_ADMIN_PERMISSION_NAMES,
      ...PORTAL_ADMIN_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'delete_company_user',
      'data-scope:company-all',
      'data-scope:partner-portfolio',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'permissions:read',
      'branches:read',
      'branches:create',
      'branches:update',
      'branches:delete',
      'branches:manage-access',
      'departments:read',
      'departments:create',
      'departments:update',
      'departments:delete',
      'insurance-categories:read',
      'insurance-categories:create',
      'insurance-categories:update',
      'insurance-categories:delete',
      'insurance-products:read',
      'insurance-products:create',
      'insurance-products:update',
      'insurance-products:delete',
      'insurance-sub-classes:read',
      'insurance-sub-classes:create',
      'insurance-sub-classes:update',
      'insurance-sub-classes:delete',
      'insurance-risks:read',
      'insurance-risks:create',
      'insurance-risks:update',
      'insurance-risks:delete',
      'rating-factors:read',
      'rating-factors:create',
      'rating-factors:update',
      'rating-factors:delete',
      'risk-rating-rules:read',
      'risk-rating-rules:create',
      'risk-rating-rules:update',
      'risk-rating-rules:delete',
      'insurance-partners:read',
      'insurance-partners:create',
      'insurance-partners:update',
      'insurance-partners:approve',
      'insurance-partners:suspend',
      'insurance-partners:terminate',
      'product-distribution:read',
      'product-distribution:create',
      'product-distribution:update',
      'product-distribution:delete',
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'quotations:delete',
      'pricing.override.request',
      'pricing.override.approve',
      'pricing.override.reject',
      'pricing.override.view',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      ...TIRAMIS_ADMIN_PERMISSION_NAMES,
      'motor:read',
      'motor:create',
      'motor:update',
      'motor:delete',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'policies:create',
      'policies:update',
      'policies:delete',
      'billing:read',
      'billing:create',
      'billing:update',
      'billing:delete',
      'commissions:read',
      'commissions:create',
      'commissions:update',
      'commissions:delete',
      'category-access:read',
      'category-access:manage',
      'product-access:read',
      'product-access:manage',
      'premium-calculation:calculate',
    ],
  },
  {
    name: 'REINSURANCE_ADMIN',
    displayName: 'Reinsurance Company Administrator',
    description: 'Administrator for a Reinsurance Company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      ...CLAIMS_PARTNER_PERMISSION_NAMES,
      ...REINSURANCE_ADMIN_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'data-scope:company-all',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'branches:read',
      'departments:read',
      'insurance-products:read',
      'insurance-risks:read',
      'product-distribution:read',
      'customers:read',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'quotations:delete',
      'pricing.override.request',
      'pricing.override.approve',
      'pricing.override.reject',
      'pricing.override.view',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      ...TIRAMIS_ADMIN_PERMISSION_NAMES,
      'motor:read',
      'motor:create',
      'motor:update',
      'motor:delete',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'policies:create',
      'policies:update',
      'policies:delete',
      'premium-calculation:calculate',
    ],
  },
  {
    name: 'BROKER_ADMIN',
    displayName: 'Broker Administrator',
    description: 'Administrator for a Broker company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      ...CLAIMS_PARTNER_PERMISSION_NAMES,
      ...REINSURANCE_PARTNER_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'data-scope:company-all',
      'data-scope:partner-portfolio',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'branches:read',
      'departments:read',
      'insurance-products:read',
      'insurance-risks:read',
      'product-distribution:read',
      'customers:read',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'quotations:delete',
      'pricing.override.request',
      'pricing.override.view',
      ...TIRAMIS_ADMIN_PERMISSION_NAMES,
      'motor:read',
      'motor:create',
      'motor:update',
      'motor:delete',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'policies:create',
      'policies:update',
      'policies:delete',
      'premium-calculation:calculate',
    ],
  },
  {
    name: 'AGENCY_ADMIN',
    displayName: 'Agency Administrator',
    description: 'Administrator for an Agency company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      ...CLAIMS_PARTNER_PERMISSION_NAMES,
      ...REINSURANCE_PARTNER_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'data-scope:company-all',
      'data-scope:partner-portfolio',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'branches:read',
      'departments:read',
      'insurance-products:read',
      'insurance-risks:read',
      'product-distribution:read',
      'customers:read',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'pricing.override.request',
      'pricing.override.view',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      ...TIRAMIS_ADMIN_PERMISSION_NAMES,
      'premium-calculation:calculate',
    ],
  },
  {
    name: 'BANCASSURANCE_ADMIN',
    displayName: 'Bancassurance Administrator',
    description: 'Administrator for a Bancassurance company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'data-scope:company-all',
      'data-scope:partner-portfolio',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'branches:read',
      'departments:read',
      'insurance-products:read',
      'insurance-risks:read',
      'product-distribution:read',
      'customers:read',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'pricing.override.request',
      'pricing.override.view',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      'tiramis.submit',
      'tiramis.tracking.view',
      'premium-calculation:calculate',
    ],
  },
  {
    name: 'SERVICE_PROVIDER_ADMIN',
    displayName: 'Service Provider Administrator',
    description: 'Administrator for a Service Provider company tenant',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      ...DASHBOARD_ADMIN_PERMISSION_NAMES,
      ...PHASE2_ADMIN_PERMISSION_NAMES,
      'view_company_dashboard',
      'manage_company_users',
      'create_company_user',
      'update_company_user',
      'data-scope:company-all',
      'view_company_data',
      'update_company_data',
      'users:read',
      'users:create',
      'users:update',
      'users:assign-role',
      'users:revoke-role',
      'roles:read',
      'branches:read',
      'departments:read',
      'tiramis-submissions:read',
      'tiramis-submissions:create',
      ...TIRAMIS_ADMIN_PERMISSION_NAMES,
    ],
  },
  {
    name: 'USER',
    displayName: 'Company User',
    description: 'Regular company user with read-only company access',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      'view_company_data',
      ...DASHBOARD_GENERAL_USER_PERMISSION_NAMES,
      ...PHASE2_GENERAL_USER_PERMISSION_NAMES,
      'claims:read',
      'complaints:read',
    ],
  },
  {
    name: 'VIEWER',
    displayName: 'Viewer',
    description:
      'Compatibility role mirroring the default read-only company user access',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      'view_company_data',
      ...DASHBOARD_VIEWER_PERMISSION_NAMES,
      ...PHASE2_GENERAL_USER_PERMISSION_NAMES,
    ],
  },
  {
    name: 'CUSTOMER_PORTAL',
    displayName: 'Customer Portal',
    description: 'Customer self-service portal user',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: ['portal:customer-access'],
  },
  {
    name: 'INTERMEDIARY_PORTAL',
    displayName: 'Intermediary Portal',
    description: 'Broker, agency, or bancassurance portal user',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: ['portal:intermediary-access'],
  },
];

function withPricingPermissionAliases(permissionNames: string[]): string[] {
  const expanded = new Set(permissionNames);

  if (expanded.has('premium-calculation:calculate')) {
    expanded.add('pricing.calculate');
    expanded.add('pricing.view_breakdown');
  }

  if (
    [
      'risk-rating-rules:read',
      'risk-rating-rules:create',
      'risk-rating-rules:update',
      'risk-rating-rules:delete',
    ].some((permission) => expanded.has(permission))
  ) {
    expanded.add('pricing.manage_rules');
    expanded.add('pricing.manage_rate_books');
  }

  if (expanded.has('risk-rating-rules:update')) {
    expanded.add('pricing.publish_rate_books');
  }

  if (expanded.has('quotations:create') || expanded.has('quotations:update')) {
    expanded.add('pricing.request_discount');
  }

  if (
    expanded.has('pricing.override.approve') ||
    expanded.has('pricing.override.reject')
  ) {
    expanded.add('pricing.approve_discount');
    expanded.add('pricing.approve_override');
  }

  if (expanded.has('pricing.override.request')) {
    expanded.add('pricing.request_override');
  }

  if (
    expanded.has('pricing.override.view') ||
    expanded.has('pricing.override.request') ||
    expanded.has('pricing.override.approve') ||
    expanded.has('pricing.override.reject')
  ) {
    expanded.add('pricing.view_audit');
  }

  return [...expanded];
}

export default class InitialRbacSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<void> {
    void factoryManager;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const permissionRepo = manager.getRepository(Permission);
      const roleRepo = manager.getRepository(Role);
      const userRepo = manager.getRepository(User);
      const companyRepo = manager.getRepository(Company);
      const companyUserRepo = manager.getRepository(CompanyUser);
      const companyUserRoleRepo = manager.getRepository(CompanyUserRole);
      const branchRepo = manager.getRepository(Branch);
      const branchUserRepo = manager.getRepository(BranchUser);

      const ownerConfig: SeedUserConfig = {
        firstName: environment.INITIAL_OWNER_FIRST_NAME ?? 'Filbert',
        lastName: environment.INITIAL_OWNER_LAST_NAME ?? 'Msaki',
        email: environment.INITIAL_OWNER_EMAIL ?? 'filbert@alliance.co.tz',
        phone: environment.INITIAL_OWNER_PHONE ?? '+255700000001',
        password: environment.INITIAL_OWNER_PASSWORD ?? 'Owner123!',
        userNo: environment.INITIAL_OWNER_USER_NO ?? 'OWNER-00001',
        userType: 'OWNER',
        officerTitle: 'Owner',
      };

      const companyName =
        environment.DEFAULT_COMPANY_NAME ?? ALLIANCE_TENANT.companyName;

      const adminConfig: SeedUserConfig = {
        firstName: environment.INITIAL_COMPANY_ADMIN_FIRST_NAME ?? 'Inocent',
        lastName: environment.INITIAL_COMPANY_ADMIN_LAST_NAME ?? 'Nuruva',
        email:
          environment.INITIAL_COMPANY_ADMIN_EMAIL ?? 'inocent@alliance.co.tz',
        phone: environment.INITIAL_COMPANY_ADMIN_PHONE ?? '+255700000002',
        password: environment.INITIAL_COMPANY_ADMIN_PASSWORD ?? 'Admin123!',
        userNo: environment.INITIAL_COMPANY_ADMIN_USER_NO ?? 'ADMIN-00001',
        userType: 'COMPANY_USER',
        officerTitle: 'Underwriter',
      };

      if (
        ownerConfig.email.toLowerCase() === adminConfig.email.toLowerCase() ||
        ownerConfig.phone === adminConfig.phone
      ) {
        throw new Error(
          'OWNER and company administrator must use different email addresses and phone numbers',
        );
      }

      const defaultCompany = await this.ensureCompany(companyRepo, companyName);

      const permissionsByName = await this.syncPermissions(
        permissionRepo,
        permissionSeeds,
      );

      const rolesByScopeAndName = await this.syncRoles(
        roleRepo,
        roleSeeds,
        permissionsByName,
        defaultCompany.id,
      );

      const ownerRole = this.requireRole(rolesByScopeAndName, 'OWNER', null);
      const defaultAdminRoleName = this.getDefaultCompanyAdminRoleName(
        defaultCompany.company_type ?? CompanyType.INSURANCE_COMPANY,
      );
      const adminRole = this.requireRole(
        rolesByScopeAndName,
        defaultAdminRoleName,
        defaultCompany.id,
      );

      const ownerUser = await this.findUserByIdentity(
        userRepo,
        ownerConfig.email,
        ownerConfig.phone,
      );

      const savedOwner = await this.ensureOwnerUser(
        userRepo,
        ownerUser,
        ownerConfig,
        ownerRole,
      );

      await companyUserRepo.update(
        { user_id: savedOwner.id },
        { is_default: false },
      );

      const adminUser = await this.findUserByIdentity(
        userRepo,
        adminConfig.email,
        adminConfig.phone,
      );

      const savedAdmin = await this.ensureCompanyUser(
        userRepo,
        adminUser,
        adminConfig,
      );

      await this.ensureUserPermissions(
        userRepo,
        savedAdmin,
        [...TIRAMIS_ADMIN_PERMISSION_NAMES],
        permissionsByName,
      );

      const membership = await this.ensureCompanyMembership(
        companyUserRepo,
        defaultCompany.id,
        savedAdmin.id,
      );

      await this.ensureMembershipRole(
        companyUserRoleRepo,
        membership.id,
        adminRole.id,
      );

      await this.ensureDefaultBranches(
        branchRepo,
        defaultCompany.id,
        defaultBranchSeeds,
      );
      await this.ensureBranchAssignments(
        branchRepo,
        branchUserRepo,
        defaultCompany.id,
        savedAdmin.id,
      );

      await queryRunner.commitTransaction();

      console.log('Multi-tenant seed completed successfully');
      console.log(`OWNER: ${savedOwner.email}`);
      console.log(`COMPANY: ${defaultCompany.name} (${defaultCompany.slug})`);
      console.log(`ADMIN: ${savedAdmin.email}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Seeding failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private buildScopeKey(name: string, companyId: string | null): string {
    return `${companyId ?? 'global'}::${name}`;
  }

  private getDefaultCompanyAdminRoleName(companyType: CompanyType): string {
    switch (companyType) {
      case CompanyType.REINSURANCE_COMPANY:
        return 'REINSURANCE_ADMIN';
      case CompanyType.BROKER:
        return 'BROKER_ADMIN';
      case CompanyType.AGENCY:
        return 'AGENCY_ADMIN';
      case CompanyType.BANCASSURANCE:
        return 'BANCASSURANCE_ADMIN';
      case CompanyType.SERVICE_PROVIDER:
        return 'SERVICE_PROVIDER_ADMIN';
      case CompanyType.INSURANCE_COMPANY:
      default:
        return 'INSURANCE_ADMIN';
    }
  }

  private resolveScopeCompanyId(
    scope: SeedScope,
    defaultCompanyId: string,
  ): string | null {
    return scope === 'default_company' ? defaultCompanyId : null;
  }

  private async syncPermissions(
    permissionRepo: Repository<Permission>,
    definitions: PermissionSeed[],
  ): Promise<Map<string, Permission>> {
    const permissionsByName = new Map<string, Permission>();

    for (const definition of definitions) {
      let permission = await permissionRepo.findOne({
        where: { name: definition.name },
      });

      if (!permission) {
        permission = permissionRepo.create({
          name: definition.name,
          display_name: definition.displayName,
          description: definition.description,
          is_system_generated: true,
        });
      } else {
        permission.display_name = definition.displayName;
        permission.description = definition.description;
      }

      permission.is_system_generated = true;

      permission = await permissionRepo.save(permission);
      permissionsByName.set(permission.name, permission);
    }

    return permissionsByName;
  }

  private async syncRoles(
    roleRepo: Repository<Role>,
    definitions: RoleSeed[],
    permissionsByName: Map<string, Permission>,
    defaultCompanyId: string,
  ): Promise<Map<string, Role>> {
    const rolesByScopeAndName = new Map<string, Role>();

    for (const definition of definitions) {
      for (const scope of definition.scopes) {
        const companyId = this.resolveScopeCompanyId(scope, defaultCompanyId);

        let role = await roleRepo.findOne({
          where: {
            name: definition.name,
            company_id: companyId === null ? IsNull() : companyId,
          },
          relations: { permissions: true },
        });

        if (!role) {
          role = roleRepo.create({
            name: definition.name,
            display_name: definition.displayName,
            description: definition.description,
            company_id: companyId,
            is_system_generated: true,
          });
        } else {
          role.display_name = definition.displayName;
          role.description = definition.description;
          role.company_id = companyId;
        }

        role.is_system_generated = true;
        const permissionNames = [
          ...new Set(withPricingPermissionAliases(definition.permissionNames)),
        ];

        role.permissions = permissionNames.map((permissionName) => {
          const permission = permissionsByName.get(permissionName);

          if (!permission) {
            throw new Error(
              `Permission "${permissionName}" is missing for scope "${scope}"`,
            );
          }

          return permission;
        });

        role = await roleRepo.save(role);
        rolesByScopeAndName.set(this.buildScopeKey(role.name, companyId), role);
      }
    }

    return rolesByScopeAndName;
  }

  private requireRole(
    rolesByScopeAndName: Map<string, Role>,
    roleName: string,
    companyId: string | null,
  ): Role {
    const role = rolesByScopeAndName.get(
      this.buildScopeKey(roleName, companyId),
    );

    if (!role) {
      throw new Error(`Role "${roleName}" could not be resolved`);
    }

    return role;
  }

  private async findUserByIdentity(
    userRepo: Repository<User>,
    email: string,
    phone: string,
  ): Promise<User | null> {
    const userByEmail = await userRepo.findOne({
      where: { email },
      relations: { roles: true },
    });
    const userByPhone = await userRepo.findOne({
      where: { phone },
      relations: { roles: true },
    });

    if (userByEmail && userByPhone && userByEmail.id !== userByPhone.id) {
      throw new Error(
        `Email ${email} and phone ${phone} belong to different users`,
      );
    }

    return userByEmail ?? userByPhone;
  }

  private async ensureOwnerUser(
    userRepo: Repository<User>,
    existingUser: User | null,
    config: SeedUserConfig,
    ownerRole: Role,
  ): Promise<User> {
    let user = existingUser;

    if (!user) {
      user = userRepo.create({
        user_no: config.userNo,
        first_name: config.firstName,
        last_name: config.lastName,
        phone: config.phone,
        email: config.email,
        password: await hashPassword(config.password),
        status: 'active',
        user_type: config.userType,
        officer_title: config.officerTitle,
        is_email_verified: true,
        roles: [ownerRole],
      });
    } else {
      user.first_name = config.firstName;
      user.last_name = config.lastName;
      user.status = 'active';
      user.user_type = 'OWNER';
      user.officer_title = config.officerTitle;
      user.is_email_verified = true;
      user.roles = this.mergeRole(user.roles, ownerRole);
    }

    return userRepo.save(user);
  }

  private async ensureCompanyUser(
    userRepo: Repository<User>,
    existingUser: User | null,
    config: SeedUserConfig,
  ): Promise<User> {
    if (existingUser?.user_type === 'OWNER') {
      throw new Error(
        `User ${config.email} is already marked as OWNER and cannot also be a company administrator`,
      );
    }

    let user = existingUser;

    if (!user) {
      user = userRepo.create({
        user_no: config.userNo,
        first_name: config.firstName,
        last_name: config.lastName,
        phone: config.phone,
        email: config.email,
        password: await hashPassword(config.password),
        status: 'active',
        user_type: config.userType,
        officer_title: config.officerTitle,
        is_email_verified: true,
      });
    } else {
      user.first_name = config.firstName;
      user.last_name = config.lastName;
      user.status = 'active';
      user.user_type = 'COMPANY_USER';
      user.officer_title = config.officerTitle;
      user.is_email_verified = true;
    }

    return userRepo.save(user);
  }

  private async ensureUserPermissions(
    userRepo: Repository<User>,
    user: User,
    permissionNames: string[],
    permissionsByName: Map<string, Permission>,
  ) {
    const persistedUser = await userRepo.findOne({
      where: { id: user.id },
      relations: { permissions: true },
    });

    if (!persistedUser) return;

    const permissions = new Map(
      (persistedUser.permissions ?? []).map((permission) => [
        permission.name,
        permission,
      ]),
    );

    for (const permissionName of permissionNames) {
      const permission = permissionsByName.get(permissionName);
      if (permission) permissions.set(permissionName, permission);
    }

    persistedUser.permissions = Array.from(permissions.values());
    await userRepo.save(persistedUser);
  }

  private async ensureCompany(
    companyRepo: Repository<Company>,
    companyName: string,
  ): Promise<Company> {
    const normalizedCompanyName = companyName.trim();
    const identifierPrefix =
      normalizedCompanyName === ALLIANCE_TENANT.companyName
        ? ALLIANCE_TENANT.identifierPrefix
        : this.deriveIdentifierPrefix(normalizedCompanyName);
    let company = await companyRepo.findOne({
      where: { name: normalizedCompanyName },
    });

    if (!company) {
      const uniqueSlug = await this.generateUniqueCompanySlug(
        companyRepo,
        normalizedCompanyName,
      );
      company = companyRepo.create({
        name: normalizedCompanyName,
        slug: uniqueSlug,
        identifier_prefix: identifierPrefix,
        status: 'active',
        company_type: CompanyType.INSURANCE_COMPANY,
        metadata: {
          seeded: true,
          purpose: 'default-aicl',
        },
      });
    } else {
      company.name = normalizedCompanyName;
      company.identifier_prefix ??= identifierPrefix;
      company.status = 'active';
      company.company_type ??= CompanyType.INSURANCE_COMPANY;
      company.metadata = {
        ...(company.metadata ?? {}),
        seeded: true,
        purpose: 'default-aicl',
      };
    }

    return companyRepo.save(company);
  }

  private deriveIdentifierPrefix(companyName: string): string | null {
    const prefix = companyName
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean)
      .map((word) => word[0].toUpperCase())
      .join('')
      .replace(/[^A-Z0-9]/g, '');

    return prefix || null;
  }

  private slugifyCompanyName(value: string): string {
    return value
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private buildSlugCandidate(baseSlug: string, suffix: number): string {
    if (suffix === 0) {
      return baseSlug;
    }

    const suffixText = `-${suffix}`;
    const maxBaseLength = Math.max(1, 120 - suffixText.length);
    const trimmedBase = baseSlug.slice(0, maxBaseLength).replace(/-+$/g, '');
    const safeBase = trimmedBase || 'company';

    return `${safeBase}${suffixText}`;
  }

  private async generateUniqueCompanySlug(
    companyRepo: Repository<Company>,
    companyName: string,
  ): Promise<string> {
    const baseSlug = this.slugifyCompanyName(companyName);

    if (!baseSlug) {
      throw new Error('Company slug could not be generated from company name');
    }

    let suffix = 0;
    while (true) {
      const slugCandidate = this.buildSlugCandidate(baseSlug, suffix);
      const existingCompany = await companyRepo.findOne({
        where: { slug: slugCandidate },
        select: { id: true },
      });

      if (!existingCompany) {
        return slugCandidate;
      }

      suffix += 1;
    }
  }

  private async ensureCompanyMembership(
    companyUserRepo: Repository<CompanyUser>,
    companyId: string,
    userId: string,
  ): Promise<CompanyUser> {
    await companyUserRepo.update({ user_id: userId }, { is_default: false });

    let membership = await companyUserRepo.findOne({
      where: {
        company_id: companyId,
        user_id: userId,
      },
    });

    if (!membership) {
      membership = companyUserRepo.create({
        company_id: companyId,
        user_id: userId,
        status: 'active',
        is_default: true,
      });
    } else {
      membership.status = 'active';
      membership.is_default = true;
    }

    return companyUserRepo.save(membership);
  }

  private async ensureMembershipRole(
    companyUserRoleRepo: Repository<CompanyUserRole>,
    companyUserId: string,
    roleId: string,
  ): Promise<CompanyUserRole> {
    const existingAssignment = await companyUserRoleRepo.findOne({
      where: {
        company_user_id: companyUserId,
        role_id: roleId,
      },
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    return companyUserRoleRepo.save(
      companyUserRoleRepo.create({
        company_user_id: companyUserId,
        role_id: roleId,
      }),
    );
  }

  private async ensureDefaultBranches(
    branchRepo: Repository<Branch>,
    companyId: string,
    definitions: SeedBranchConfig[],
  ): Promise<void> {
    for (const definition of definitions) {
      const normalizedName = definition.name.trim();
      const normalizedCode = definition.code.trim().toUpperCase();

      let branch = await branchRepo.findOne({
        where: {
          company_id: companyId,
          code: normalizedCode,
        },
      });

      if (!branch) {
        branch = branchRepo.create({
          company_id: companyId,
          name: normalizedName,
          code: normalizedCode,
          status: 'active',
          sale_point_code: null,
          sale_point_name: null,
          address: null,
          phone: null,
          email: null,
          manager_id: null,
        });
      } else {
        branch.name = normalizedName;
        branch.status = 'active';
      }

      await branchRepo.save(branch);
    }
  }

  private async ensureBranchAssignments(
    branchRepo: Repository<Branch>,
    branchUserRepo: Repository<BranchUser>,
    companyId: string,
    userId: string,
  ): Promise<void> {
    const companyUserRepo = branchUserRepo.manager.getRepository(CompanyUser);
    const membership = await companyUserRepo.findOne({
      where: { company_id: companyId, user_id: userId, status: 'active' },
    });
    if (!membership) return;

    const branches = await branchRepo.find({
      where: { company_id: companyId, status: 'active' },
      order: { created_at: 'ASC' },
    });
    if (branches.length === 0) return;

    const activeBranch = branches[0];
    const now = new Date();

    // Seed the administrator with access to every default branch while keeping
    // the first branch as the single active branch for the company user.
    await branchUserRepo.update(
      { company_user_id: membership.id },
      { is_active_branch: false, is_primary: false },
    );

    for (const branch of branches) {
      let assignment = await branchUserRepo.findOne({
        where: { branch_id: branch.id, company_user_id: membership.id },
      });

      const isActiveBranch = branch.id === activeBranch.id;
      if (!assignment) {
        assignment = branchUserRepo.create({
          branch_id: branch.id,
          company_user_id: membership.id,
          is_primary: isActiveBranch,
          is_active_branch: isActiveBranch,
          assigned_by: userId,
          activated_at: isActiveBranch ? now : null,
          activated_by: isActiveBranch ? userId : null,
        });
      } else {
        assignment.is_primary = isActiveBranch;
        assignment.is_active_branch = isActiveBranch;
        assignment.assigned_by = assignment.assigned_by ?? userId;
        if (isActiveBranch) {
          assignment.activated_at = assignment.activated_at ?? now;
          assignment.activated_by = assignment.activated_by ?? userId;
        }
      }

      await branchUserRepo.save(assignment);
    }
  }

  private mergeRole(existingRoles: Role[] | undefined, role: Role): Role[] {
    const roles = existingRoles ?? [];

    if (roles.some((existingRole) => existingRole.id === role.id)) {
      return roles;
    }

    return [...roles, role];
  }
}
