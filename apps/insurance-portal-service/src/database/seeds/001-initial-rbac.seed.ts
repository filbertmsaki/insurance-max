import { environment } from '@insurance-max/shared-config';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';
import { PermissionAssignmentScope, RoleScope } from '@insurance-max/contracts';
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

function resolvePermissionPolicy(definition: PermissionSeed): {
  assignmentScope: PermissionAssignmentScope;
  assignableToCompanyRole: boolean;
  assignableToPlatformRole: boolean;
} {
  const company = definition.scopes.includes('default_company');
  const platform = definition.scopes.includes('global');

  const assignmentScope =
    company && platform
      ? PermissionAssignmentScope.SHARED
      : company
        ? PermissionAssignmentScope.TENANT
        : PermissionAssignmentScope.PLATFORM;

  return {
    assignmentScope,
    assignableToCompanyRole: company,
    assignableToPlatformRole: platform,
  };
}

function resolveRoleScope(
  definition: RoleSeed,
  companyId: string | null,
): RoleScope {
  if (companyId) {
    return RoleScope.TENANT;
  }

  if (definition.scopes.includes('default_company')) {
    return RoleScope.TENANT_TEMPLATE;
  }

  return RoleScope.PLATFORM;
}

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
  'dashboards:executive:read',
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
  'analytics:metrics:read',
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
  'documents:read',
  'documents:upload',
  'documents:download',
  'documents:create-version',
  'documents:archive',
  'documents:rescan',
  'document-templates:read',
  'document-templates:create',
  'document-templates:update-draft',
  'document-templates:approve',
  'document-templates:publish',
  'document-templates:retire',
  'signatures:read',
  'signatures:create',
  'signatures:send',
  'signatures:remind',
  'signatures:cancel',
  'signatures:reconcile',
  'work-items:read',
  'work-items:claim',
  'work-items:assign',
  'work-items:reassign',
  'work-items:execute',
  'work-items:cancel',
  'work-items:manage',
  'notifications:read',
  'notifications:manage-preferences',
  'communications:read',
  'communications:create-thread',
  'communications:send',
  'communications:assign',
  'communications:close',
];

// Phase 13: granular policy-transaction (endorsement/cancellation/renewal)
// permissions, additive to the Phase-2 placeholder set above.
const POLICY_TRANSACTION_PERMISSION_NAMES = [
  'policy-transactions:read',
  'endorsements:create',
  'endorsements:update-draft',
  'endorsements:complete',
  'endorsements:submit-approval',
  'endorsements:approve',
  'endorsements:request-payment',
  'endorsements:submit-tiramis',
  'endorsements:retry-tiramis',
  'endorsements:cancel',
  'cancellations:read',
  'cancellations:create',
  'cancellations:complete',
  'cancellations:claims-review',
  'cancellations:approve',
  'cancellations:request-payment',
  'cancellations:submit-tiramis',
  'cancellations:retry-tiramis',
  'cancellations:cancel',
  'renewals:read',
  'renewals:create',
  'renewals:create-offer',
  'renewals:send-offer',
  'renewals:accept',
  'renewals:decline',
  'renewals:cancel',
  'policy-versions:read',
  'policy-versions:read-sensitive',
];

const POLICY_TRANSACTION_SUPPORT_PERMISSION_NAMES = [
  'endorsements:reconcile',
  'cancellations:reconcile',
];

const PHASE2_GENERAL_USER_PERMISSION_NAMES = [
  'documents:read',
  'documents:download',
  'document-templates:read',
  'signatures:read',
  'work-items:read',
  'work-items:claim',
  'work-items:execute',
  'notifications:read',
  'notifications:manage-preferences',
  'communications:read',
  'communications:send',
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
  'claims:duplicate-review',
  'claim-decisions:create',
  'claim-decisions:submit',
  'claim-decisions:approve',
  'claim-decisions:reject',
  'claim-payments:request-disbursement',
  'claim-payments:confirm-disbursement',
  'claim-recoveries:create',
  'claim-recoveries:request',
  'claim-recoveries:record-receipt',
  'claim-recoveries:write-off',
  'claim-recoveries:cancel',
  'complaints:read',
  'complaints:create',
  'complaints:assign',
  'complaints:resolve',
  'complaints:escalate',
  'complaints:close',
  'complaints:reopen',
  'complaints:cancel',
  'complaints:appeal-review',
  'documents:register',
  'documents:verify',
  'documents:reject',
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
  'reinsurance:capacity-evaluate',
  'reinsurance:program-create',
  'reinsurance:program-update',
  'reinsurance:counterparty-create',
  'reinsurance:counterparty-update',
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
  {
    name: 'reinsurance:capacity-evaluate',
    displayName: 'Evaluate reinsurance capacity',
    description: 'Allow read-only evaluation of treaty capacity and exposure',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:program-create',
    displayName: 'Create reinsurance programmes',
    description: 'Allow creating reinsurance programmes/treaty groupings',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:program-update',
    displayName: 'Update reinsurance programmes',
    description: 'Allow updating reinsurance programmes/treaty groupings',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:counterparty-create',
    displayName: 'Create reinsurance counterparties',
    description: 'Allow creating reinsurer/broker counterparty profiles',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reinsurance:counterparty-update',
    displayName: 'Update reinsurance counterparties',
    description: 'Allow updating reinsurer/broker counterparty profiles',
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
    name: 'dashboards:executive:read',
    displayName: 'View executive dashboard',
    description:
      'Allow viewing the executive metric dashboard built from the metric catalogue',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:metrics:read',
    displayName: 'Read metric catalogue values',
    description:
      'Allow reading metric catalogue definitions and computed metric values',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'analytics:read',
    displayName: 'Read analytics data',
    description:
      'Allow reading KPI, scorecard, anomaly, forecast and benchmark analytics data',
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
    description:
      'Allow generating analytics scorecards for selected templates and periods',
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
    name: 'users:grant-permission',
    displayName: 'Grant direct user permission',
    description:
      'Grant an approved tenant permission directly to a company membership',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:revoke-permission',
    displayName: 'Revoke direct user permission',
    description: 'Remove a direct permission from a company membership',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'users:manage-data-scope',
    displayName: 'Manage user data scope',
    description: 'Change user quotation and policy data access scope',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'audit:read',
    displayName: 'Read audit logs',
    description: 'View audit records within the current authorized scope',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'audit:read-all',
    displayName: 'Read all platform audit logs',
    description: 'View audit records across all companies',
    scopes: GLOBAL_SCOPE,
  },
  {
    name: 'audit:export',
    displayName: 'Export audit logs',
    description: 'Export authorized audit records',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'audit:verify-chain',
    displayName: 'Verify audit chain integrity',
    description: 'Validate the tamper-evident audit hash chain',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'operations:health-read',
    displayName: 'Read operational health metrics',
    description: 'View protected operational metrics and health telemetry',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'operations:release-read',
    displayName: 'Read release gate status',
    description: 'View deployment and release readiness status',
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
    name: 'company-configs:read',
    displayName: 'Read company configs',
    description: "Allow viewing a company's platform-managed runtime settings",
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'company-configs:update',
    displayName: 'Update company configs',
    description:
      "Allow updating a company's number, currency, and runtime settings",
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'system-configs:read',
    displayName: 'Read system configs',
    description: 'Allow viewing platform-wide runtime settings',
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
    name: 'claims:duplicate-review',
    displayName: 'Review possible duplicate claims',
    description:
      'Allow reviewing and overriding possible-duplicate claim flags',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-decisions:create',
    displayName: 'Create claim decisions',
    description: 'Allow drafting a claim liability decision',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-decisions:submit',
    displayName: 'Submit claim decisions',
    description: 'Allow submitting a claim decision for approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-decisions:approve',
    displayName: 'Approve claim decisions',
    description:
      'Allow approving a claim liability decision (maker-checker enforced)',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-decisions:reject',
    displayName: 'Reject claim decisions',
    description: 'Allow rejecting a submitted claim decision',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-payments:request-disbursement',
    displayName: 'Request claim payment disbursement',
    description:
      'Allow requesting Finance to disburse an approved claim payment',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-payments:confirm-disbursement',
    displayName: 'Confirm claim payment disbursement',
    description: 'Finance-only: confirm an actual claim payment disbursement',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-recoveries:create',
    displayName: 'Create claim recoveries',
    description: 'Allow creating expected recovery records for claims',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-recoveries:request',
    displayName: 'Request claim recoveries',
    description: 'Allow moving an expected recovery into requested status',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-recoveries:record-receipt',
    displayName: 'Record claim recovery receipts',
    description: 'Finance-confirmed: record an actual recovery receipt',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-recoveries:write-off',
    displayName: 'Write off claim recoveries',
    description: 'Allow writing off an uncollectable claim recovery',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'claim-recoveries:cancel',
    displayName: 'Cancel claim recoveries',
    description: 'Allow cancelling a claim recovery record',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:close',
    displayName: 'Close complaints',
    description: 'Allow closing a resolved complaint',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:reopen',
    displayName: 'Reopen complaints',
    description: 'Allow reopening a closed complaint (maker-checker enforced)',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:cancel',
    displayName: 'Cancel complaints',
    description: 'Allow cancelling a complaint record',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'complaints:appeal-review',
    displayName: 'Review complaint appeals',
    description: 'Allow filing and reviewing a complaint appeal',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:read',
    displayName: 'Read documents',
    description: 'Allow viewing documents in the engagement document centre',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:upload',
    displayName: 'Upload documents',
    description:
      'Allow creating secure upload sessions and uploading document files',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:download',
    displayName: 'Download documents',
    description: 'Allow downloading available document versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:create-version',
    displayName: 'Create document versions',
    description: 'Allow uploading replacement versions for existing documents',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:archive',
    displayName: 'Archive documents',
    description: 'Allow archiving and restoring documents',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:rescan',
    displayName: 'Rescan documents',
    description: 'Allow rerunning document security scans',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'document-templates:read',
    displayName: 'Read document templates',
    description: 'Allow viewing document templates and versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'document-templates:create',
    displayName: 'Create document templates',
    description: 'Allow creating document templates',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'document-templates:update-draft',
    displayName: 'Update draft document templates',
    description: 'Allow creating and editing draft template versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'document-templates:approve',
    displayName: 'Approve document templates',
    description: 'Allow approving document template versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'document-templates:publish',
    displayName: 'Publish document templates',
    description: 'Allow publishing approved template versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'document-templates:retire',
    displayName: 'Retire document templates',
    description: 'Allow retiring published template versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:register',
    displayName: 'Register documents',
    description:
      'Allow registering an uploaded document in the controlled document registry',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:verify',
    displayName: 'Verify documents',
    description: 'Allow verifying a registered document',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'documents:reject',
    displayName: 'Reject documents',
    description: 'Allow rejecting a registered document',
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
    name: 'departments:manage-users',
    displayName: 'Manage department users',
    description:
      'Allow assigning users to departments and setting active department',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'sale-points:read',
    displayName: 'Read sales points',
    description: 'Allow listing and viewing branch sales points',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'sale-points:create',
    displayName: 'Create sales points',
    description: 'Allow creating branch sales points',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'sale-points:update',
    displayName: 'Update sales points',
    description: 'Allow updating branch sales points',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'sale-points:delete',
    displayName: 'Delete sales points',
    description: 'Allow deleting or deactivating branch sales points',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'company-tiramis-config:read',
    displayName: 'Read company TIRA configuration',
    description: "Allow reading the company's TIRAMIS configuration",
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'company-tiramis-config:update',
    displayName: 'Update company TIRA configuration',
    description: "Allow updating the company's TIRAMIS configuration",
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'company-tiramis-config:validate',
    displayName: 'Validate company TIRA configuration',
    description: "Allow validating the company's TIRAMIS configuration",
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

  // ── Product Definitions (versioned catalogue) ─────────────────────────────
  {
    name: 'product-definitions:read',
    displayName: 'Read product definitions',
    description:
      'View insurance product versions and approved cover definitions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:create-version',
    displayName: 'Create product versions',
    description: 'Create a new draft from the current product definition',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:update',
    displayName: 'Update product definitions',
    description: 'Edit draft cover wording, add-ons and requirements',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:submit-review',
    displayName: 'Submit product definitions',
    description: 'Submit a draft product definition for approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:review',
    displayName: 'Review product definitions',
    description: 'Review and reject proposed product definitions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:publish',
    displayName: 'Publish product definitions',
    description: 'Approve and publish insurance product versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:retire',
    displayName: 'Retire product definitions',
    description: 'Retire published insurance product versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'product-definitions:use',
    displayName: 'Use published products',
    description: 'Use approved product definitions in quotations',
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
    name: 'pricing-rate-books:read',
    displayName: 'Read pricing rate books',
    description: 'Read pricing rate books',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing-rate-books:create',
    displayName: 'Create pricing rate books',
    description: 'Create pricing rate books',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing-rate-books:update',
    displayName: 'Update pricing rate books',
    description: 'Update pricing rate books',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing-rate-books:submit-review',
    displayName: 'Submit pricing rate books for review',
    description: 'Submit pricing rate books for review',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing-rate-books:review',
    displayName: 'Approve or reject pricing rate books under review',
    description: 'Approve or reject pricing rate books under review',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing-rate-books:publish',
    displayName: 'Publish pricing rate books',
    description: 'Publish pricing rate books',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing-rate-books:retire',
    displayName: 'Retire pricing rate books',
    description: 'Retire pricing rate books',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing:calculate',
    displayName: 'Calculate premiums',
    description: 'Calculate premiums',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'pricing:simulate',
    displayName: 'Simulate premium calculations without persisting a quotation',
    description: 'Simulate premium calculations without persisting a quotation',
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
    name: 'customers:audit-history:read',
    displayName: 'Read customer audit history',
    description: 'Allow viewing immutable customer change history',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customers:duplicate-override',
    displayName: 'Override possible customer duplicates',
    description:
      'Create a customer despite matching phone or email information',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customers:merge',
    displayName: 'Merge customer records',
    description:
      'Merge duplicate customer master records while preserving history',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customer-kyc:read',
    displayName: 'Read customer KYC',
    description: 'Allow reading customer KYC status, evidence, and history',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customer-kyc:submit',
    displayName: 'Submit customer KYC',
    description: 'Allow submitting customer KYC for reviewer approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customer-kyc:review',
    displayName: 'Review customer KYC',
    description: 'Allow reviewing submitted customer KYC evidence',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'customer-kyc:approve',
    displayName: 'Approve customer KYC',
    description: 'Allow approving verified customer KYC reviews',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insured-assets:read',
    displayName: 'Read insured assets',
    description: 'Allow listing and viewing reusable insured assets',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insured-assets:create',
    displayName: 'Create insured assets',
    description: 'Allow creating reusable insured assets',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insured-assets:update',
    displayName: 'Update insured assets',
    description: 'Allow updating reusable insured assets',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'insured-assets:retire',
    displayName: 'Retire insured assets',
    description: 'Allow retiring reusable insured assets',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'motor-ownership:update',
    displayName: 'Change motor vehicle ownership',
    description: 'Allow changing effective-dated motor vehicle ownership',
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
    name: 'quotations:complete',
    displayName: 'Complete quotations',
    description:
      'Allow finalizing quotations after validation and pricing refresh',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:submit-approval',
    displayName: 'Submit quotations for approval',
    description:
      'Allow submitting completed quotations into the approval workflow',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:approve',
    displayName: 'Approve quotations',
    description: 'Allow approving quotations within the standard workflow',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:approve-high-risk',
    displayName: 'Approve high-risk quotations',
    description:
      'Allow approving quotations that exceed normal workflow thresholds',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:request-changes',
    displayName: 'Request quotation changes',
    description:
      'Allow returning submitted quotations for changes before approval',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:reject',
    displayName: 'Reject quotations',
    description: 'Allow rejecting submitted quotations during approval review',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:request-payment',
    displayName: 'Request quotation payment',
    description:
      'Allow generating and marking quotation payment requests for collection',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:submit-tiramis',
    displayName: 'Submit quotations to TIRAMIS',
    description:
      'Allow submitting completed, approved, and paid quotations to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:retry-tiramis',
    displayName: 'Retry quotation TIRAMIS submissions',
    description: 'Allow retrying failed quotation submissions to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:cancel',
    displayName: 'Cancel quotations',
    description:
      'Allow cancelling quotations before external submission completes',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:delete-draft',
    displayName: 'Delete quotation drafts',
    description: 'Allow deleting draft quotations before submission',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotations:delete',
    displayName: 'Delete quotations',
    description: 'Allow deleting quotations',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotation-approvals:read',
    displayName: 'Read quotation approvals',
    description: 'Allow viewing quotation approval queues and decisions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotation-approvals:assign',
    displayName: 'Assign quotation approvals',
    description: 'Allow assigning quotation approvals to reviewers',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'quotation-requirements:waive',
    displayName: 'Waive quotation requirements',
    description:
      'Allow waiving quotation approval or payment requirements when authorized',
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
    name: 'motor:audit-history:read',
    displayName: 'Read motor vehicle audit history',
    description: 'Allow viewing immutable motor vehicle change history',
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
    name: 'cover-notes:read',
    displayName: 'Read cover notes',
    description: 'Allow listing and viewing cover notes',
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
    name: 'invoices:read',
    displayName: 'Read invoices',
    description: 'Allow viewing invoices within finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'invoices:issue',
    displayName: 'Issue invoices',
    description: 'Allow issuing draft invoices in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'invoices:void',
    displayName: 'Void invoices',
    description: 'Allow voiding invoices in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'payments:read',
    displayName: 'Read payment transactions',
    description: 'Allow viewing payment transactions in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'payments:record-manual',
    displayName: 'Record manual payment transactions',
    description:
      'Allow recording manual payment transactions in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'receipts:read',
    displayName: 'Read receipts',
    description: 'Allow viewing receipts in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'receipts:post',
    displayName: 'Post receipts',
    description: 'Allow posting receipts in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'receipts:allocate',
    displayName: 'Allocate receipts',
    description: 'Allow allocating receipts in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'receipts:reverse',
    displayName: 'Reverse receipts',
    description: 'Allow reversing receipts in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'refunds:read',
    displayName: 'Read refunds',
    description: 'Allow viewing refunds in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'refunds:request',
    displayName: 'Request refunds',
    description: 'Allow requesting refunds in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'refunds:approve',
    displayName: 'Approve refunds',
    description: 'Allow approving refunds in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'refunds:pay',
    displayName: 'Pay refunds',
    description: 'Allow paying approved refunds in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'refunds:cancel',
    displayName: 'Cancel refunds',
    description: 'Allow canceling refunds in finance operations.',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reconciliation:read',
    displayName: 'Read reconciliation batches',
    description: 'Allow viewing finance reconciliation batches and items',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reconciliation:create',
    displayName: 'Create reconciliation batches',
    description: 'Allow creating finance reconciliation batches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reconciliation:import',
    displayName: 'Import reconciliation statements',
    description: 'Allow importing reconciliation statement lines',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reconciliation:match',
    displayName: 'Match reconciliation items',
    description: 'Allow matching reconciliation items to payments and receipts',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reconciliation:approve',
    displayName: 'Approve reconciliation batches',
    description: 'Allow approving matched reconciliation batches',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'reconciliation:post',
    displayName: 'Post reconciliation batches',
    description: 'Allow posting approved reconciliation batches',
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
    name: 'policy-transactions:read',
    displayName: 'View policy transactions',
    description:
      'Allow viewing endorsement, cancellation, and renewal transactions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:create',
    displayName: 'Create endorsements',
    description: 'Allow creating a policy endorsement transaction',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:update-draft',
    displayName: 'Edit draft endorsements',
    description: 'Allow recording changes on a draft endorsement',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:complete',
    displayName: 'Complete endorsements',
    description: 'Allow completing an endorsement for approval/submission',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:submit-approval',
    displayName: 'Submit endorsements for approval',
    description:
      'Allow submitting a completed endorsement into the approval queue',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:approve',
    displayName: 'Approve endorsements',
    description:
      'Allow approving, rejecting, or requesting changes on an endorsement',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:request-payment',
    displayName: 'Request endorsement payment',
    description:
      'Allow requesting the additional-premium payment for an endorsement',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:submit-tiramis',
    displayName: 'Submit endorsements to TIRAMIS',
    description: 'Allow submitting a ready endorsement to the regulator',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:retry-tiramis',
    displayName: 'Retry endorsement TIRAMIS submission',
    description: 'Allow retrying a failed endorsement regulatory submission',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:reconcile',
    displayName: 'Reconcile endorsements',
    description:
      'Allow inspecting and repairing safe endorsement issuance inconsistencies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'endorsements:cancel',
    displayName: 'Cancel endorsements',
    description: 'Allow cancelling a draft endorsement',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:read',
    displayName: 'View cancellations',
    description: 'Allow viewing policy cancellation transactions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:create',
    displayName: 'Create cancellations',
    description: 'Allow requesting cancellation of an active policy',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:complete',
    displayName: 'Complete cancellations',
    description: 'Allow completing a cancellation for approval/submission',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:claims-review',
    displayName: 'Review cancellations with open claims',
    description:
      'Allow clearing or blocking a cancellation pending claims review',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:approve',
    displayName: 'Approve cancellations',
    description: 'Allow approving a cancellation',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:request-payment',
    displayName: 'Process cancellation refunds',
    description: 'Allow processing the refund/charge for a cancellation',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:submit-tiramis',
    displayName: 'Submit cancellations to TIRAMIS',
    description: 'Allow submitting a ready cancellation to the regulator',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:retry-tiramis',
    displayName: 'Retry cancellation TIRAMIS submissions',
    description:
      'Allow retrying failed or retryable cancellation submissions to TIRAMIS',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:reconcile',
    displayName: 'Reconcile cancellations',
    description:
      'Allow inspecting and repairing safe cancellation issuance inconsistencies',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'cancellations:cancel',
    displayName: 'Withdraw cancellations',
    description: 'Allow withdrawing a draft cancellation request',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:read',
    displayName: 'View renewals',
    description: 'Allow viewing renewal offers',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:create',
    displayName: 'Create renewals',
    description:
      'Allow manually creating a renewal offer ahead of the scheduled job',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:create-offer',
    displayName: 'Link renewal quotations',
    description: 'Allow linking a renewal offer to its quotation',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:send-offer',
    displayName: 'Send renewal offers',
    description: 'Allow marking a renewal offer as sent to the customer',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:accept',
    displayName: 'Accept renewals',
    description: 'Allow recording customer acceptance of a renewal offer',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:decline',
    displayName: 'Decline renewals',
    description: 'Allow recording customer decline of a renewal offer',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'renewals:cancel',
    displayName: 'Cancel renewals',
    description: 'Allow cancelling a renewal transaction',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policy-versions:read',
    displayName: 'View policy versions',
    description: 'Allow viewing policy version history',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'policy-versions:read-sensitive',
    displayName: 'View sensitive policy version data',
    description: 'Allow viewing sensitive fields on historical policy versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'signatures:read',
    displayName: 'Read signature requests',
    description: 'Allow viewing signature requests and participants',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'signatures:create',
    displayName: 'Create signature requests',
    description: 'Allow creating signature requests for documents',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'signatures:send',
    displayName: 'Send signature requests',
    description: 'Allow sending signature requests to participants',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'signatures:remind',
    displayName: 'Remind signature participants',
    description: 'Allow sending signature reminders',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'signatures:cancel',
    displayName: 'Cancel signature requests',
    description: 'Allow cancelling signature requests',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'signatures:reconcile',
    displayName: 'Reconcile signature requests',
    description: 'Allow reconciling signature request completion state',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:claim',
    displayName: 'Claim work items',
    description: 'Allow claiming open work items',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:assign',
    displayName: 'Assign work items',
    description: 'Allow assigning work items to users or teams',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:reassign',
    displayName: 'Reassign work items',
    description: 'Allow reassigning existing work items',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:execute',
    displayName: 'Execute work items',
    description: 'Allow starting and completing work item actions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'work-items:cancel',
    displayName: 'Cancel work items',
    description: 'Allow cancelling work items',
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
    name: 'notifications:manage-preferences',
    displayName: 'Manage notification preferences',
    description: 'Allow updating notification preference overrides',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'communications:read',
    displayName: 'Read communications',
    description: 'Allow viewing communication threads and history',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'communications:create-thread',
    displayName: 'Create communication threads',
    description: 'Allow opening new communication threads',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'communications:send',
    displayName: 'Send communications',
    description: 'Allow posting outbound communication messages',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'communications:assign',
    displayName: 'Assign communication threads',
    description: 'Allow assigning communication follow-up',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
  },
  {
    name: 'communications:close',
    displayName: 'Close communication threads',
    description: 'Allow closing and reopening communication threads',
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

const ALL_COMPANY_PERMISSION_NAMES = permissionSeeds
  .filter((permission) => permission.scopes.includes('default_company'))
  .map((permission) => permission.name);

const FULL_COMPANY_PERMISSION_ROLE_NAMES = new Set([
  'ADMINISTRATOR',
  'INSURANCE_ADMIN',
]);

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

const PHASE18_GOVERNANCE_PERMISSION_NAMES = [
  'audit:verify-chain',
  'operations:health-read',
  'operations:release-read',
];

const FINANCE_RECONCILIATION_PERMISSION_NAMES = [
  'reconciliation:read',
  'reconciliation:create',
  'reconciliation:import',
  'reconciliation:match',
  'reconciliation:approve',
  'reconciliation:post',
];

const FINANCE_OPERATION_PERMISSION_NAMES = [
  'invoices:read',
  'invoices:issue',
  'invoices:void',
  'payments:read',
  'payments:record-manual',
  'receipts:read',
  'receipts:post',
  'receipts:allocate',
  'receipts:reverse',
  'refunds:read',
  'refunds:request',
  'refunds:approve',
  'refunds:pay',
  'refunds:cancel',
];

const COMPANY_TIRAMIS_CONFIGURATION_PERMISSION_NAMES = [
  'company-tiramis-config:read',
  'company-tiramis-config:update',
  'company-tiramis-config:validate',
];

const PORTAL_ADMIN_ROLE_PERMISSION_NAMES = [
  ...PORTAL_ADMIN_PERMISSION_NAMES,
  ...PHASE2_GENERAL_USER_PERMISSION_NAMES,
  ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
  ...FINANCE_OPERATION_PERMISSION_NAMES,
  ...FINANCE_RECONCILIATION_PERMISSION_NAMES,
  ...COMPANY_TIRAMIS_CONFIGURATION_PERMISSION_NAMES,
  'view_company_dashboard',
  'view_company_data',
  'users:read',
  'branches:read',
  'departments:read',
  'customers:read',
  'work-items:assign',
  'work-items:reassign',
  'work-items:cancel',
  'work-items:manage',
  'communications:assign',
  'communications:close',
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
      'company-configs:read',
      'company-configs:update',
      'system-configs:read',
      'permissions:create',
      'permissions:update',
      'permissions:delete',
      'tiramis-submissions:read',
      'tiramis.admin',
      'audit:read',
      'audit:read-all',
      'audit:export',
      ...COMPANY_TIRAMIS_CONFIGURATION_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...POLICY_TRANSACTION_SUPPORT_PERMISSION_NAMES,
      ...CLAIMS_ADMIN_PERMISSION_NAMES,
      ...REINSURANCE_ADMIN_PERMISSION_NAMES,
      ...PORTAL_ADMIN_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
      ...FINANCE_OPERATION_PERMISSION_NAMES,
      ...FINANCE_RECONCILIATION_PERMISSION_NAMES,
      ...COMPANY_TIRAMIS_CONFIGURATION_PERMISSION_NAMES,
      'customer-kyc:read',
      'customer-kyc:submit',
      'customer-kyc:review',
      'customer-kyc:approve',
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
      'users:grant-permission',
      'users:revoke-permission',
      'audit:read',
      'audit:export',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'permissions:read',
      'company-configs:read',
      'company-configs:update',
      'system-configs:read',
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
      'departments:manage-users',
      'sale-points:read',
      'sale-points:create',
      'sale-points:update',
      'sale-points:delete',
      'company-tiramis-config:read',
      'company-tiramis-config:update',
      'company-tiramis-config:validate',
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
      'customers:audit-history:read',
      'customer-kyc:read',
      'customer-kyc:submit',
      'customer-kyc:review',
      'customer-kyc:approve',
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
      'motor:audit-history:read',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'cover-notes:read',
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...POLICY_TRANSACTION_SUPPORT_PERMISSION_NAMES,
      ...CLAIMS_ADMIN_PERMISSION_NAMES,
      ...REINSURANCE_ADMIN_PERMISSION_NAMES,
      ...PORTAL_ADMIN_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
      ...FINANCE_OPERATION_PERMISSION_NAMES,
      ...FINANCE_RECONCILIATION_PERMISSION_NAMES,
      ...COMPANY_TIRAMIS_CONFIGURATION_PERMISSION_NAMES,
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
      'company-configs:read',
      'company-configs:update',
      'system-configs:read',
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
      'customers:audit-history:read',
      'customer-kyc:read',
      'customer-kyc:submit',
      'customer-kyc:review',
      'customer-kyc:approve',
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
      'motor:audit-history:read',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'cover-notes:read',
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...CLAIMS_PARTNER_PERMISSION_NAMES,
      ...REINSURANCE_ADMIN_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
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
      'motor:audit-history:read',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'cover-notes:read',
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...CLAIMS_PARTNER_PERMISSION_NAMES,
      ...REINSURANCE_PARTNER_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
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
      'motor:audit-history:read',
      'non-motor:read',
      'non-motor:create',
      'non-motor:update',
      'non-motor:delete',
      'policies:read',
      'cover-notes:read',
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...CLAIMS_PARTNER_PERMISSION_NAMES,
      ...REINSURANCE_PARTNER_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
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
      'customers:read',
      'customers:create',
      'customers:update',
      'customer-kyc:read',
      'customer-kyc:submit',
      'insured-assets:read',
      'insured-assets:create',
      'insured-assets:update',
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
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
      ...POLICY_TRANSACTION_PERMISSION_NAMES,
      ...PHASE18_GOVERNANCE_PERMISSION_NAMES,
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
    description:
      'Regular branch-scoped company user with standard customer and quotation access',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      'view_company_data',
      'data-scope:assigned-branches',
      ...DASHBOARD_GENERAL_USER_PERMISSION_NAMES,
      ...PHASE2_GENERAL_USER_PERMISSION_NAMES,
      'insurance-products:read',
      'insurance-categories:read',
      'insurance-sub-classes:read',
      'insurance-risks:read',
      'product-definitions:read',
      'product-definitions:use',
      'product-distribution:read',
      'customers:read',
      'customers:create',
      'customers:update',
      'customer-kyc:read',
      'customer-kyc:submit',
      'insured-assets:read',
      'insured-assets:create',
      'insured-assets:update',
      'motor:read',
      'motor:create',
      'motor:update',
      'motor:delete',
      'non-motor:read',
      'policies:read',
      'policy-transactions:read',
      'endorsements:create',
      'endorsements:update-draft',
      'endorsements:complete',
      'endorsements:submit-tiramis',
      'cancellations:read',
      'cancellations:create',
      'cancellations:complete',
      'cancellations:submit-tiramis',
      'verifications:motor:submit',
      'verifications:cover-note:submit',
      'pricing.manage_rules',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:complete',
      'quotations:submit-tiramis',
      'quotations:retry-tiramis',
      'quotations:delete-draft',
      'tiramis.submit',
      'premium-calculation:calculate',
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
    name: 'PORTAL_ADMIN',
    displayName: 'Portal Administrator',
    description:
      'Administrator for portal accounts, requests, communications, and operational readiness workflows',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [...PORTAL_ADMIN_ROLE_PERMISSION_NAMES],
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
  {
    name: 'PRODUCT_ADMINISTRATOR',
    displayName: 'Product Administrator',
    description:
      'Authors and maintains the insurance product catalogue and its versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      'insurance-products:read',
      'insurance-products:create',
      'insurance-products:update',
      'insurance-products:delete',
      'insurance-categories:read',
      'insurance-sub-classes:read',
      'product-definitions:read',
      'product-definitions:create-version',
      'product-definitions:update',
      'product-definitions:submit-review',
      'product-definitions:use',
      'product-distribution:read',
    ],
  },
  {
    name: 'PRODUCT_APPROVER',
    displayName: 'Product Approver',
    description:
      'Reviews, publishes and retires proposed product-definition versions',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      'insurance-products:read',
      'insurance-categories:read',
      'insurance-sub-classes:read',
      'product-definitions:read',
      'product-definitions:review',
      'product-definitions:publish',
      'product-definitions:retire',
      'product-definitions:use',
    ],
  },
  {
    name: 'UNDERWRITER',
    displayName: 'Underwriter',
    description: 'Uses approved product definitions to quote and bind risk',
    scopes: GLOBAL_AND_DEFAULT_COMPANY_SCOPES,
    permissionNames: [
      'insurance-products:read',
      'insurance-categories:read',
      'insurance-sub-classes:read',
      'insurance-risks:read',
      'product-definitions:read',
      'product-definitions:use',
      'quotations:read',
      'quotations:create',
      'quotations:update',
      'quotations:submit',
      'customers:read',
      'customers:create',
      'customers:update',
      'customer-kyc:read',
      'customer-kyc:submit',
      'insured-assets:read',
      'insured-assets:create',
      'insured-assets:update',
    ],
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

  if (
    [
      'pricing-rate-books:read',
      'pricing-rate-books:create',
      'pricing-rate-books:update',
      'pricing-rate-books:submit-review',
      'pricing-rate-books:review',
    ].some((permission) => expanded.has(permission))
  ) {
    expanded.add('pricing.manage_rate_books');
  }

  if (expanded.has('pricing-rate-books:publish')) {
    expanded.add('pricing.publish_rate_books');
  }

  if (expanded.has('quotations:create') || expanded.has('quotations:update')) {
    expanded.add('pricing.request_discount');
  }

  if (expanded.has('quotations:update')) {
    expanded.add('quotations:complete');
    expanded.add('quotations:submit-approval');
    expanded.add('quotations:approve');
    expanded.add('quotations:approve-high-risk');
    expanded.add('quotations:request-changes');
    expanded.add('quotations:reject');
    expanded.add('quotations:request-payment');
    expanded.add('quotations:cancel');
    expanded.add('quotation-approvals:read');
    expanded.add('quotation-approvals:assign');
    expanded.add('quotation-requirements:waive');
  }

  if (expanded.has('quotations:submit')) {
    expanded.add('quotations:submit-tiramis');
    expanded.add('quotations:retry-tiramis');
  }

  if (expanded.has('quotations:delete')) {
    expanded.add('quotations:delete-draft');
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
        firstName: environment.INITIAL_OWNER_FIRST_NAME ?? 'Asha',
        lastName: environment.INITIAL_OWNER_LAST_NAME ?? 'Mtemi',
        email: environment.INITIAL_OWNER_EMAIL ?? 'asha.mtemi@gmail.com',
        phone: environment.INITIAL_OWNER_PHONE ?? '+255700000001',
        password: environment.INITIAL_OWNER_PASSWORD ?? 'Owner123!',
        userNo: environment.INITIAL_OWNER_USER_NO ?? 'OWNER-00001',
        userType: 'OWNER',
        officerTitle: 'Owner',
      };

      const companyName =
        environment.DEFAULT_COMPANY_NAME ?? ALLIANCE_TENANT.companyName;

      const adminConfig: SeedUserConfig = {
        firstName: environment.INITIAL_COMPANY_ADMIN_FIRST_NAME ?? 'Baraka',
        lastName: environment.INITIAL_COMPANY_ADMIN_LAST_NAME ?? 'Mushi',
        email:
          environment.INITIAL_COMPANY_ADMIN_EMAIL ?? 'baraka.mushi@gmail.com',
        phone: environment.INITIAL_COMPANY_ADMIN_PHONE ?? '+255700000002',
        password: environment.INITIAL_COMPANY_ADMIN_PASSWORD ?? 'Admin123!',
        userNo: environment.INITIAL_COMPANY_ADMIN_USER_NO ?? 'ADMIN-00001',
        userType: 'COMPANY_USER',
        officerTitle: 'Underwriter',
      };

      const standardUserConfig: SeedUserConfig = {
        firstName: environment.INITIAL_COMPANY_USER_FIRST_NAME ?? 'Neema',
        lastName: environment.INITIAL_COMPANY_USER_LAST_NAME ?? 'Kato',
        email:
          environment.INITIAL_COMPANY_USER_EMAIL ??
          'neema.alliance.user@example.test',
        phone: environment.INITIAL_COMPANY_USER_PHONE ?? '+255700000003',
        password: environment.INITIAL_COMPANY_USER_PASSWORD ?? 'User123!',
        userNo: environment.INITIAL_COMPANY_USER_USER_NO ?? 'USER-00001',
        userType: 'COMPANY_USER',
        officerTitle: 'Standard User',
      };

      if (
        ownerConfig.email.toLowerCase() === adminConfig.email.toLowerCase() ||
        ownerConfig.phone === adminConfig.phone
      ) {
        throw new Error(
          'OWNER and company administrator must use different email addresses and phone numbers',
        );
      }

      const seedUserIdentities = [ownerConfig, adminConfig, standardUserConfig];
      const seedEmails = new Set<string>();
      const seedPhones = new Set<string>();

      for (const config of seedUserIdentities) {
        const email = config.email.toLowerCase();
        if (seedEmails.has(email) || seedPhones.has(config.phone)) {
          throw new Error(
            'Seeded owner, company administrator, and standard company user must use distinct email addresses and phone numbers',
          );
        }
        seedEmails.add(email);
        seedPhones.add(config.phone);
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
      const portalAdminRole = this.requireRole(
        rolesByScopeAndName,
        'PORTAL_ADMIN',
        defaultCompany.id,
      );
      const standardUserRole = this.requireRole(
        rolesByScopeAndName,
        'USER',
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
      await this.ensureMembershipRole(
        companyUserRoleRepo,
        membership.id,
        portalAdminRole.id,
      );

      const standardUser = await this.findUserByIdentity(
        userRepo,
        standardUserConfig.email,
        standardUserConfig.phone,
      );

      const savedStandardUser = await this.ensureCompanyUser(
        userRepo,
        standardUser,
        standardUserConfig,
      );

      const standardMembership = await this.ensureCompanyMembership(
        companyUserRepo,
        defaultCompany.id,
        savedStandardUser.id,
      );

      await this.ensureMembershipRole(
        companyUserRoleRepo,
        standardMembership.id,
        standardUserRole.id,
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
      await this.ensureBranchAssignments(
        branchRepo,
        branchUserRepo,
        defaultCompany.id,
        savedStandardUser.id,
      );

      await queryRunner.commitTransaction();

      console.log('Multi-tenant seed completed successfully');
      console.log(`OWNER: ${savedOwner.email}`);
      console.log(`COMPANY: ${defaultCompany.name} (${defaultCompany.slug})`);
      console.log(`ADMIN: ${savedAdmin.email}`);
      console.log(`USER: ${savedStandardUser.email}`);
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

      const policy = resolvePermissionPolicy(definition);

      permission.assignment_scope = policy.assignmentScope;
      permission.assignable_to_company_role = policy.assignableToCompanyRole;
      permission.assignable_to_platform_role = policy.assignableToPlatformRole;
      permission.is_deprecated = false;

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
        role.scope = resolveRoleScope(definition, companyId);
        role.is_administrative =
          ['OWNER', 'SUPER_ADMIN', 'ADMINISTRATOR'].includes(definition.name) ||
          definition.name.endsWith('_ADMIN');

        const basePermissionNames = FULL_COMPANY_PERMISSION_ROLE_NAMES.has(
          definition.name,
        )
          ? ALL_COMPANY_PERMISSION_NAMES
          : definition.permissionNames;
        const sourcePermissionNames =
          role.is_administrative && role.scope !== RoleScope.PLATFORM
            ? [...basePermissionNames, 'users:manage-data-scope']
            : basePermissionNames;

        const permissionNames = [
          ...new Set(withPricingPermissionAliases(sourcePermissionNames)),
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
