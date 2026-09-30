import { z } from 'zod';
import type {
  BusinessLine,
  ClaimantPayload,
  ClaimClaimant,
  ClaimDetail,
  CreateClaimPayload,
} from '../types';
import { fromDateTimeLocal, toDateTimeLocal } from '../utils';

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use at most ${max} characters`).optional();

const money = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0),
    'Enter an amount with up to 2 decimals',
  );

/**
 * A claimant as TIRAMIS knows it (§10.1). With "use policyholder" the backend
 * copies the policy customer's identity, so only the role is entered here.
 * The remaining TIRA identity fields are needed before intimation, not at
 * notification, so they are optional here but format-checked.
 */
export const claimantSchema = z
  .object({
    id: z.string().optional(),
    uses_policyholder: z.boolean(),
    claimant_type: z.enum([
      'POLICYHOLDER',
      'INSURED',
      'BENEFICIARY',
      'THIRD_PARTY',
      'SERVICE_PROVIDER',
      'OTHER',
    ]),
    is_primary: z.boolean(),
    full_name: optionalText(100),
    claimant_category: z.string().optional(),
    party_type: z.string().optional(),
    id_type: z.string().optional(),
    identification_number: optionalText(50),
    birth_date: z.string().optional(),
    gender: z.string().optional(),
    country_code: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || /^[A-Z]{3}$/.test(value),
        'Use the 3-letter country code, e.g. TZA',
      ),
    region: optionalText(50),
    district: optionalText(50),
    street: optionalText(100),
    phone: optionalText(50),
    fax: optionalText(50),
    postal_address: optionalText(100),
    email: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        'Enter a valid email address',
      ),
    amount_claimed: money,
  })
  .superRefine((claimant, ctx) => {
    if (!claimant.uses_policyholder && !claimant.full_name?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['full_name'],
        message: 'Enter the claimant name',
      });
    }
  });

export const claimFormSchema = z
  .object({
    policy_id: z.string().min(1, 'Select the policy the loss is claimed under'),
    policy_risk_id: z.string().optional(),
    loss_date: z.string().min(1, 'Enter the date and time of loss'),
    claim_report_date: z.string().min(1, 'Enter when the loss was reported'),
    loss_nature: z.string().trim().min(1, 'Enter the nature of loss').max(100),
    loss_type: z.string().trim().min(1, 'Enter the type of loss').max(100),
    loss_location: z
      .string()
      .trim()
      .min(1, 'Enter where the loss happened')
      .max(100),
    description: z.string().trim().min(1, 'Describe what happened').max(5000),
    claim_title: optionalText(200),
    cause_of_loss: optionalText(2000),
    police_report_number: optionalText(100),
    estimated_amount: money,
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    claim_form_dully_filled: z.boolean(),
    notification_source: z.string().optional(),
    reporter_name: optionalText(180),
    reporter_phone: optionalText(50),
    reporter_email: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        'Enter a valid email address',
      ),
    internal_notes: optionalText(5000),
    incident_details: z.record(z.string(), z.string()),
    claimants: z.array(claimantSchema).min(1, 'Add at least one claimant'),
    duplicate_override_reason: optionalText(2000),
  })
  .superRefine((values, ctx) => {
    const loss = new Date(values.loss_date).getTime();
    const report = new Date(values.claim_report_date).getTime();

    if (Number.isFinite(loss) && loss > Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['loss_date'],
        message: 'Loss date cannot be in the future',
      });
    }

    if (Number.isFinite(loss) && Number.isFinite(report) && report < loss) {
      ctx.addIssue({
        code: 'custom',
        path: ['claim_report_date'],
        message: 'Report date cannot be before the loss date',
      });
    }

    if (values.claimants.filter((claimant) => claimant.is_primary).length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['claimants'],
        message: 'Only one claimant can be primary',
      });
    }
  });

export type ClaimFormValues = z.infer<typeof claimFormSchema>;
export type ClaimantFormValues = z.infer<typeof claimantSchema>;

/** Class-specific incident questions; stored in incident_details, never sent to TIRA. */
export const INCIDENT_FIELDS: Record<
  'MOTOR' | 'NON_MOTOR',
  Array<{ key: string; label: string; multiline?: boolean }>
> = {
  MOTOR: [
    { key: 'driver_name', label: 'Driver name' },
    { key: 'driver_licence_number', label: 'Driver licence number' },
    { key: 'third_parties_involved', label: 'Third parties involved' },
    { key: 'vehicle_location', label: 'Current vehicle location' },
    { key: 'repairer', label: 'Repairer / garage' },
  ],
  NON_MOTOR: [
    { key: 'property_affected', label: 'Property or items affected' },
    { key: 'extent_of_damage', label: 'Extent of damage', multiline: true },
    {
      key: 'authority_notified',
      label: 'Authority notified (fire, police...)',
    },
  ],
};

export function incidentFieldsFor(line: BusinessLine | null | undefined) {
  return line === 'NON_MOTOR'
    ? INCIDENT_FIELDS.NON_MOTOR
    : INCIDENT_FIELDS.MOTOR;
}

export function emptyClaimant(
  overrides: Partial<ClaimantFormValues> = {},
): ClaimantFormValues {
  return {
    uses_policyholder: false,
    claimant_type: 'THIRD_PARTY',
    is_primary: false,
    full_name: '',
    claimant_category: '2',
    party_type: '1',
    id_type: '',
    identification_number: '',
    birth_date: '',
    gender: '',
    country_code: 'TZA',
    region: '',
    district: '',
    street: '',
    phone: '',
    fax: '',
    postal_address: '',
    email: '',
    amount_claimed: '',
    ...overrides,
  };
}

export function policyholderClaimant(isPrimary: boolean): ClaimantFormValues {
  return emptyClaimant({
    uses_policyholder: true,
    claimant_type: 'POLICYHOLDER',
    claimant_category: '1',
    is_primary: isPrimary,
  });
}

export function defaultClaimValues(): ClaimFormValues {
  return {
    policy_id: '',
    policy_risk_id: '',
    loss_date: '',
    claim_report_date: toDateTimeLocal(new Date().toISOString()),
    loss_nature: '',
    loss_type: '',
    loss_location: '',
    description: '',
    claim_title: '',
    cause_of_loss: '',
    police_report_number: '',
    estimated_amount: '',
    priority: 'MEDIUM',
    claim_form_dully_filled: false,
    notification_source: '',
    reporter_name: '',
    reporter_phone: '',
    reporter_email: '',
    internal_notes: '',
    incident_details: {},
    claimants: [],
    duplicate_override_reason: '',
  };
}

const blank = (value?: string | null) => value?.trim() || undefined;
const number = (value?: string | null) => (value ? Number(value) : undefined);

export function toClaimantPayload(
  claimant: ClaimantFormValues,
): ClaimantPayload {
  if (claimant.uses_policyholder) {
    return {
      claimant_type: claimant.claimant_type,
      uses_policyholder: true,
      is_primary: claimant.is_primary,
      amount_claimed: blank(claimant.amount_claimed),
    };
  }

  return {
    claimant_type: claimant.claimant_type,
    uses_policyholder: false,
    is_primary: claimant.is_primary,
    full_name: blank(claimant.full_name),
    claimant_category: number(claimant.claimant_category),
    party_type: number(claimant.party_type),
    id_type: number(claimant.id_type),
    identification_number: blank(claimant.identification_number),
    birth_date: blank(claimant.birth_date),
    gender: (blank(claimant.gender) as 'M' | 'F' | undefined) ?? undefined,
    country_code: blank(claimant.country_code),
    region: blank(claimant.region),
    district: blank(claimant.district),
    street: blank(claimant.street),
    phone: blank(claimant.phone),
    fax: blank(claimant.fax),
    postal_address: blank(claimant.postal_address),
    email: blank(claimant.email),
    amount_claimed: blank(claimant.amount_claimed),
  };
}

/** The draft fields shared by create (POST) and edit (PATCH). */
export function toIncidentPayload(values: ClaimFormValues) {
  const incidentDetails = Object.fromEntries(
    Object.entries(values.incident_details).filter(([, value]) =>
      value?.trim(),
    ),
  );

  return {
    policy_risk_id: blank(values.policy_risk_id),
    loss_date: fromDateTimeLocal(values.loss_date)!,
    claim_report_date: fromDateTimeLocal(values.claim_report_date),
    loss_nature: values.loss_nature.trim(),
    loss_type: values.loss_type.trim(),
    loss_location: values.loss_location.trim(),
    description: values.description.trim(),
    claim_title: blank(values.claim_title),
    cause_of_loss: blank(values.cause_of_loss),
    police_report_number: blank(values.police_report_number),
    estimated_amount: blank(values.estimated_amount),
    priority: values.priority,
    claim_form_dully_filled: values.claim_form_dully_filled,
    notification_source: blank(values.notification_source) as
      | CreateClaimPayload['notification_source']
      | undefined,
    reporter_name: blank(values.reporter_name),
    reporter_phone: blank(values.reporter_phone),
    reporter_email: blank(values.reporter_email),
    internal_notes: blank(values.internal_notes),
    incident_details:
      Object.keys(incidentDetails).length > 0 ? incidentDetails : undefined,
  };
}

export function toCreatePayload(values: ClaimFormValues): CreateClaimPayload {
  return {
    policy_id: values.policy_id,
    ...toIncidentPayload(values),
    claimants: values.claimants.map(toClaimantPayload),
    duplicate_override_reason: blank(values.duplicate_override_reason),
  };
}

const text = (value: unknown) => (value == null ? '' : String(value));

export function claimantFromRecord(
  claimant: ClaimClaimant,
): ClaimantFormValues {
  return emptyClaimant({
    id: claimant.id,
    uses_policyholder: !!claimant.uses_policyholder,
    claimant_type:
      (claimant.claimant_type as ClaimantFormValues['claimant_type']) ??
      'OTHER',
    is_primary: !!claimant.is_primary,
    full_name: text(claimant.full_name),
    claimant_category: text(claimant.claimant_category),
    party_type: text(claimant.party_type),
    id_type: text(claimant.id_type),
    identification_number: text(claimant.identification_number),
    birth_date: text(claimant.birth_date).slice(0, 10),
    gender: text(claimant.gender),
    country_code: text(claimant.country_code) || 'TZA',
    region: text(claimant.region),
    district: text(claimant.district),
    street: text(claimant.street),
    phone: text(claimant.phone),
    fax: text(claimant.fax),
    postal_address: text(claimant.postal_address),
    email: text(claimant.email),
    amount_claimed:
      claimant.amount_claimed != null && Number(claimant.amount_claimed) > 0
        ? String(claimant.amount_claimed)
        : '',
  });
}

export function valuesFromClaim(claim: ClaimDetail): ClaimFormValues {
  const details = Object.fromEntries(
    Object.entries(claim.incident_details ?? {}).map(([key, value]) => [
      key,
      text(value),
    ]),
  );

  return {
    ...defaultClaimValues(),
    policy_id: claim.policy_id ?? claim.policy?.id ?? '',
    policy_risk_id: claim.policy_risk_id ?? '',
    loss_date: toDateTimeLocal(claim.loss_date),
    claim_report_date: toDateTimeLocal(claim.claim_report_date),
    loss_nature: text(claim.loss_nature),
    loss_type: text(claim.loss_type),
    loss_location: text(claim.loss_location),
    description: text(claim.description),
    claim_title: text(claim.claim_title),
    cause_of_loss: text(claim.cause_of_loss),
    police_report_number: text(claim.police_report_number),
    estimated_amount:
      claim.estimated_amount != null && Number(claim.estimated_amount) > 0
        ? String(claim.estimated_amount)
        : '',
    priority: claim.priority ?? 'MEDIUM',
    claim_form_dully_filled:
      claim.claim_form_dully_filled === true ||
      claim.claim_form_dully_filled === 'Y',
    notification_source: text(claim.notification_source),
    reporter_name: text(claim.reporter_name),
    reporter_phone: text(claim.reporter_phone),
    reporter_email: text(claim.reporter_email),
    internal_notes: text(claim.internal_notes),
    incident_details: details,
    claimants: (claim.claimants ?? [])
      .filter((claimant) => claimant.status !== 'REMOVED')
      .map(claimantFromRecord),
  };
}
