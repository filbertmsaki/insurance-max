import { z } from 'zod';
import type { QuotationPolicyDataScope, UserStatus } from '@/types';
import type {
  CreateUserDto,
  PermissionGrant,
  UpdateUserAccessDto,
  UserAccess,
} from '@/modules/tenant/users/api/users';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHONE_REGEX = /^(\+255|255|0)[67]\d{8}$/;

const DATA_SCOPE_VALUES = ['USER', 'DEPARTMENT', 'BRANCH', 'COMPANY'] as const;

/** A direct grant without its own scope inherits the user's data scope. */
export const INHERIT_SCOPE = 'INHERIT';

/** Lock and suspension come from security policy, not from the profile form. */
export const EDITABLE_STATUSES = [
  'active',
  'inactive',
] as const satisfies UserStatus[];

export const STATUS_OPTIONS = EDITABLE_STATUSES.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));

export const DATA_SCOPE_OPTIONS: Array<{
  value: QuotationPolicyDataScope;
  label: string;
  description: string;
}> = [
  {
    value: 'USER',
    label: 'User Only',
    description: 'Can see only their own quotations and policies.',
  },
  {
    value: 'DEPARTMENT',
    label: 'Department',
    description: 'Can see quotations and policies in their department.',
  },
  {
    value: 'BRANCH',
    label: 'Branch',
    description: 'Can see quotations and policies in authorized branches.',
  },
  {
    value: 'COMPANY',
    label: 'Company',
    description: 'Can see all quotations and policies in this company.',
  },
];

// ─── Section schemas ──────────────────────────────────────────────────────────

const name = z.string().min(1, 'Required');
const phone = z
  .string()
  .regex(PHONE_REGEX, 'Must be a valid Tanzanian phone number');

export const createProfileSchema = z.object({
  first_name: name,
  last_name: name,
  email: z.string().email('Invalid email'),
  phone,
  password: z.string().min(6, 'Min 6 characters'),
  officer_title: z.string().min(1, 'Required'),
});

export const editProfileSchema = z.object({
  first_name: name,
  last_name: name,
  phone,
  // Absent while the user is locked or suspended.
  status: z.enum(EDITABLE_STATUSES).optional(),
});

export const organisationSchema = z
  .object({
    branch_ids: z.array(z.string()).min(1, 'Select at least one branch'),
    active_branch_id: z.string().min(1, 'Choose the active branch'),
    department_ids: z.array(z.string()),
    active_department_id: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.active_branch_id &&
      !value.branch_ids.includes(value.active_branch_id)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['active_branch_id'],
        message: 'The active branch must be one of the selected branches',
      });
    }
    if (
      value.active_department_id &&
      !value.department_ids.includes(value.active_department_id)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['active_department_id'],
        message:
          'The active department must be one of the selected departments',
      });
    }
  });

export const rolesSchema = z.object({ role_ids: z.array(z.string()) });

const grantSchema = z
  .object({
    permission_id: z.string(),
    data_scope: z.enum([INHERIT_SCOPE, ...DATA_SCOPE_VALUES]),
    scope_branch_id: z.string(),
    scope_department_id: z.string(),
  })
  .superRefine((grant, ctx) => {
    if (grant.data_scope !== 'BRANCH' && grant.scope_branch_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope_branch_id'],
        message: 'Only branch-scoped grants can target a branch',
      });
    }
    if (grant.data_scope !== 'DEPARTMENT' && grant.scope_department_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope_department_id'],
        message: 'Only department-scoped grants can target a department',
      });
    }
  });

export const permissionsSchema = z.object({
  permission_grants: z.array(grantSchema),
  /** Role permissions unchecked for this user. */
  excluded_permission_ids: z.array(z.string()),
});

export const dataAccessSchema = z.object({
  quotation_policy_data_scope: z.enum(DATA_SCOPE_VALUES),
  insurance_channel_access: z.boolean(),
});

export type CreateProfileValues = z.infer<typeof createProfileSchema>;
export type EditProfileValues = z.infer<typeof editProfileSchema>;
export type OrganisationValues = z.infer<typeof organisationSchema>;
export type RolesValues = z.infer<typeof rolesSchema>;
export type PermissionGrantValues = z.infer<typeof grantSchema>;
export type PermissionsValues = z.infer<typeof permissionsSchema>;
export type DataAccessValues = z.infer<typeof dataAccessSchema>;

/** The create wizard keeps every section in one form. */
export const createUserSchema = createProfileSchema
  .merge(rolesSchema)
  .merge(permissionsSchema)
  .merge(dataAccessSchema)
  .and(organisationSchema);

export type CreateUserValues = z.infer<typeof createUserSchema>;

/** Fields each wizard step validates before moving on. */
export const STEP_FIELDS = {
  profile: Object.keys(createProfileSchema.shape),
  organisation: [
    'branch_ids',
    'active_branch_id',
    'department_ids',
    'active_department_id',
  ],
  roles: ['role_ids'],
  permissions: ['permission_grants', 'excluded_permission_ids'],
  data_access: ['quotation_policy_data_scope', 'insurance_channel_access'],
} as const satisfies Record<string, readonly string[]>;

// ─── Defaults & payload mapping ───────────────────────────────────────────────

export const EMPTY_ACCESS_VALUES: OrganisationValues &
  RolesValues &
  PermissionsValues &
  DataAccessValues = {
  branch_ids: [],
  active_branch_id: '',
  department_ids: [],
  active_department_id: '',
  role_ids: [],
  permission_grants: [],
  excluded_permission_ids: [],
  quotation_policy_data_scope: 'USER',
  insurance_channel_access: false,
};

export function grantToValues(grant: PermissionGrant): PermissionGrantValues {
  return {
    permission_id: grant.permission_id,
    data_scope: grant.data_scope ?? INHERIT_SCOPE,
    scope_branch_id: grant.scope_branch_id ?? '',
    scope_department_id: grant.scope_department_id ?? '',
  };
}

export function grantToPayload(grant: PermissionGrantValues): PermissionGrant {
  return {
    permission_id: grant.permission_id,
    data_scope: grant.data_scope === INHERIT_SCOPE ? null : grant.data_scope,
    scope_branch_id: grant.scope_branch_id || undefined,
    scope_department_id: grant.scope_department_id || undefined,
  };
}

export function accessToValues(access: UserAccess) {
  return {
    branch_ids: access.branch_ids,
    active_branch_id: access.active_branch_id ?? '',
    department_ids: access.department_ids,
    active_department_id: access.active_department_id ?? '',
    role_ids: access.role_ids,
    permission_grants: access.permission_grants.map(grantToValues),
    excluded_permission_ids: access.excluded_permission_ids,
    quotation_policy_data_scope: access.quotation_policy_data_scope,
    insurance_channel_access: access.insurance_channel_access,
  };
}

export function organisationToPayload(
  values: OrganisationValues,
): UpdateUserAccessDto {
  return {
    branch_ids: values.branch_ids,
    active_branch_id: values.active_branch_id,
    department_ids: values.department_ids,
    active_department_id: values.active_department_id || null,
  };
}

export function createValuesToPayload(
  values: CreateUserValues,
  sections: readonly string[],
): CreateUserDto {
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    email: values.email,
    phone: values.phone,
    password: values.password,
    officer_title: values.officer_title,
    branch_ids: values.branch_ids,
    active_branch_id: values.active_branch_id,
    department_ids: values.department_ids,
    active_department_id: values.active_department_id || undefined,
    // Only send sections the actor may manage; the API rejects the rest.
    ...(sections.includes('roles') && { role_ids: values.role_ids }),
    ...(sections.includes('permissions') && {
      permission_grants: values.permission_grants.map(grantToPayload),
      excluded_permission_ids: values.excluded_permission_ids,
    }),
    ...(sections.includes('data_access') && {
      quotation_policy_data_scope: values.quotation_policy_data_scope,
      insurance_channel_access: values.insurance_channel_access,
    }),
  };
}
