import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Car,
  Check,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { formatMoney } from '@/components/shared/detailFormat';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { LocationReferenceSelects } from '@/modules/platform/reference-data/components/LocationReferenceSelects';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import {
  CUSTOMER_ID_TYPE_OPTIONS,
  getCustomerIdFieldName,
  type CustomerFormValues,
  type CustomerIdType,
  type CustomerType,
} from '@/modules/tenant/customers/types';
import {
  buildQuotationDraftPayload,
  buildQuotationPayload,
  createEmptyFleetDetails,
  createEmptyMotorDetails,
  createEmptyNonMotorDetails,
  createEmptyRiskRow,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import { AccordionStepSection } from '@/modules/tenant/quotations/wizard/components/AccordionStepSection';
import {
  computeCoverNoteDateRange,
  dateOnlyPart,
} from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import {
  motorFieldError,
  mergeVerifiedMotor,
  motorFields,
} from '@/modules/tenant/quotations/wizard/utils/motorFields';
import { VehicleLookup } from '@/modules/tenant/quotations/wizard/components/VehicleLookup';
import type { MotorVerificationRequest } from '@/modules/tenant/verifications/api';

import { portalApi, type PortalProfileRecord } from '../api';

type PolicyholderFormState = Partial<
  Record<
    | 'full_name'
    | 'company_name'
    | 'gender'
    | 'date_of_birth'
    | 'id_type'
    | 'id_number'
    | 'phone'
    | 'email'
    | 'country'
    | 'country_code'
    | 'region'
    | 'district'
    | 'street'
    | 'postal_address'
    | 'customer_type',
    string
  >
>;

type MotorFormState = QuotationFormSchemaValues['motor'];
type MotorFieldDefinition = (typeof motorFields)[number];
type DetailsSectionId = 'policyholder' | 'vehicle';

const CORE_MOTOR_FIELD_KEYS = new Set<keyof MotorFormState>([
  'motor_category_code',
  'motor_type_code',
  'motor_usage_code',
  'registration_no',
  'chassis_no',
  'make',
  'model',
]);

const CORE_MOTOR_FIELDS = motorFields.filter((field) =>
  CORE_MOTOR_FIELD_KEYS.has(field.key),
);
const ADVANCED_MOTOR_FIELDS = motorFields.filter(
  (field) => !CORE_MOTOR_FIELD_KEYS.has(field.key),
);

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function InlineStatus({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function InlineError({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-700">
      {label}
    </div>
  );
}

function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium uppercase text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function SummaryField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value || 'Not selected'}
      </div>
    </div>
  );
}

function formatPremiumSummary(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return 'Calculated on submit';
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? formatMoney(amount, 'TZS') : String(value);
}

function MotorFieldInput({
  field,
  motor,
  onChange,
}: {
  field: MotorFieldDefinition;
  motor: MotorFormState;
  onChange: (field: keyof MotorFormState, value: string) => void;
}) {
  return (
    <FormField label={field.label} required={!field.optional}>
      {field.options ? (
        <NativeSelect
          value={String(motor[field.key] ?? '')}
          onChange={(value) => onChange(field.key, value)}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input
          value={String(motor[field.key] ?? '')}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      )}
    </FormField>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {children}
    </select>
  );
}

function asCustomerType(value?: string | null): CustomerType {
  return value === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL';
}

function asCustomerIdType(value?: string | number | null): CustomerIdType | '' {
  const parsed = Number(value);
  return CUSTOMER_ID_TYPE_OPTIONS.some((option) => option.value === parsed)
    ? (parsed as CustomerIdType)
    : '';
}

function profileToPolicyholderDefaults(
  profile?: PortalProfileRecord | null,
): CustomerFormValues {
  const customerType = asCustomerType(profile?.customer_type);
  const defaults = getCustomerDefaultValues({
    customer_type: customerType,
    customer_no: profile?.customer_no ?? '',
    first_name: profile?.first_name ?? null,
    middle_name: profile?.middle_name ?? null,
    last_name: profile?.last_name ?? null,
    gender: profile?.gender ?? null,
    date_of_birth: profile?.date_of_birth ?? null,
    company_name: profile?.company_name ?? null,
    registration_no: profile?.registration_no ?? null,
    incorporation_certificate_no: profile?.incorporation_certificate_no ?? null,
    tin: profile?.tin ?? null,
    vrn: profile?.vrn ?? null,
    policy_holder_type: profile?.policy_holder_type ?? null,
    id_type: profile?.id_type ?? null,
    id_number: profile?.id_number ?? null,
    nida_no: profile?.nida_no ?? null,
    voter_no: profile?.voter_no ?? null,
    passport_no: profile?.passport_no ?? null,
    driving_license_no: profile?.driving_license_no ?? null,
    zanid_no: profile?.zanid_no ?? null,
    phone: profile?.phone ?? '',
    alternate_phone: profile?.alternate_phone ?? null,
    email: profile?.email ?? null,
    country: profile?.country ?? null,
    country_code: profile?.country_code ?? 'TZA',
    region: profile?.region ?? '',
    district: profile?.district ?? '',
    ward: profile?.ward ?? null,
    street: profile?.street ?? null,
    postal_address: profile?.postal_address ?? null,
  });

  return {
    ...defaults,
    full_name:
      defaults.full_name ||
      profile?.display_name ||
      profile?.company_name ||
      '',
    company_name: profile?.company_name ?? defaults.company_name,
  };
}

function buildPolicyholderValues(
  defaults: CustomerFormValues,
  form: PolicyholderFormState,
): CustomerFormValues {
  const idType = asCustomerIdType(
    form.id_type ?? (defaults.id_type ? String(defaults.id_type) : ''),
  );
  const next: CustomerFormValues = {
    ...defaults,
    customer_type: asCustomerType(form.customer_type ?? defaults.customer_type),
    full_name: form.full_name ?? defaults.full_name,
    company_name: form.company_name ?? defaults.company_name,
    gender: (form.gender ?? defaults.gender) as CustomerFormValues['gender'],
    date_of_birth: form.date_of_birth ?? defaults.date_of_birth,
    id_type: idType,
    id_number: form.id_number ?? defaults.id_number,
    phone: form.phone ?? defaults.phone,
    email: form.email ?? defaults.email,
    country: form.country ?? defaults.country,
    country_code: form.country_code ?? defaults.country_code,
    region: form.region ?? defaults.region,
    district: form.district ?? defaults.district,
    street: form.street ?? defaults.street,
    postal_address: form.postal_address ?? defaults.postal_address,
  };

  const idField = getCustomerIdFieldName(next.customer_type, next.id_type);
  if (idField) {
    next[idField] = next.id_number;
  }
  if (next.customer_type === 'CORPORATE' && !next.company_name.trim()) {
    next.company_name = next.full_name;
  }
  return next;
}

function validatePolicyholder(values: CustomerFormValues) {
  const errors: string[] = [];
  const holderName =
    values.customer_type === 'CORPORATE'
      ? values.company_name || values.full_name
      : values.full_name;

  if (!holderName.trim()) errors.push('Policyholder name is required.');
  if (values.customer_type === 'INDIVIDUAL' && !values.gender) {
    errors.push('Policyholder gender is required.');
  }
  if (!values.date_of_birth) {
    errors.push(
      values.customer_type === 'CORPORATE'
        ? 'Incorporation date is required.'
        : 'Date of birth is required.',
    );
  }
  if (!values.id_type) errors.push('Policyholder ID type is required.');
  if (!values.id_number.trim())
    errors.push('Policyholder ID number is required.');
  if (!values.phone.trim()) errors.push('Policyholder phone is required.');
  if (!values.country_code.trim())
    errors.push('Policyholder country code is required.');
  if (!values.region.trim()) errors.push('Policyholder region is required.');
  if (!values.district.trim())
    errors.push('Policyholder district is required.');

  return errors;
}

function validateMotor(values: MotorFormState) {
  return motorFields
    .map((field) => motorFieldError(field.key, values[field.key], values))
    .filter((message): message is string => Boolean(message));
}

function createInitialMotorDetails(): MotorFormState {
  return {
    ...createEmptyMotorDetails(),
    motor_category_code: '1',
    motor_type_code: '1',
    motor_usage_code: '1',
    owner_category: '1',
  };
}

function readPublicBuyCoverIntake() {
  try {
    const raw = window.sessionStorage.getItem('insurance-max.buy-cover-intake');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      motor?: {
        full_name?: string;
        registration_number?: string;
        phone?: string;
      } | null;
    };
    return parsed;
  } catch {
    return null;
  }
}

function createInitialPolicyholderFromIntake(): PolicyholderFormState {
  const intake = readPublicBuyCoverIntake();
  return {
    full_name: intake?.motor?.full_name ?? '',
    phone: intake?.motor?.phone ?? '',
  };
}

function createInitialMotorFromIntake(): MotorFormState {
  const intake = readPublicBuyCoverIntake();
  return {
    ...createInitialMotorDetails(),
    registration_no: intake?.motor?.registration_number ?? '',
  };
}

function policyholderName(values: CustomerFormValues) {
  return values.customer_type === 'CORPORATE'
    ? values.company_name || values.full_name
    : values.full_name;
}

function policyholderAddress(values: CustomerFormValues) {
  return [values.street, values.district, values.region]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

export function PortalBuyCoverPage() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);
  const [openDetailsSection, setOpenDetailsSection] =
    useState<DetailsSectionId | null>('policyholder');
  const [policyholderForm, setPolicyholderForm] =
    useState<PolicyholderFormState>(createInitialPolicyholderFromIntake);
  const [motor, setMotor] = useState<MotorFormState>(
    createInitialMotorFromIntake,
  );

  const profileQuery = useQuery({
    queryKey: ['portal', 'customer', 'profile'],
    queryFn: () => portalApi.getProfile('customer'),
  });

  const companiesQuery = useQuery({
    queryKey: ['customer-marketplace', 'companies'],
    queryFn: () => portalApi.listCustomerCompanies(),
  });

  const selectedCompanyId =
    companyId ??
    (companiesQuery.data?.length === 1 ? companiesQuery.data[0].id : null);

  const productsQuery = useQuery({
    queryKey: ['customer-marketplace', selectedCompanyId, 'products'],
    queryFn: () => portalApi.listCustomerCompanyProducts(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const selectedProductId =
    productId ??
    (productsQuery.data?.length === 1 ? productsQuery.data[0].id : null);

  const risksQuery = useQuery({
    queryKey: [
      'customer-marketplace',
      selectedCompanyId,
      selectedProductId,
      'risks',
    ],
    queryFn: () =>
      portalApi.listCustomerCompanyProductRisks(
        selectedCompanyId!,
        selectedProductId!,
      ),
    enabled: Boolean(selectedCompanyId && selectedProductId),
  });

  const selectedRiskId =
    riskId ?? (risksQuery.data?.length === 1 ? risksQuery.data[0].id : null);

  const selectedCompany = useMemo(
    () =>
      companiesQuery.data?.find((item) => item.id === selectedCompanyId) ??
      null,
    [companiesQuery.data, selectedCompanyId],
  );

  const selectedProduct = useMemo(
    () =>
      productsQuery.data?.find((item) => item.id === selectedProductId) ?? null,
    [productsQuery.data, selectedProductId],
  );

  const selectedRisk = useMemo(
    () => risksQuery.data?.find((item) => item.id === selectedRiskId) ?? null,
    [risksQuery.data, selectedRiskId],
  );

  const policyholderDefaults = useMemo(
    () => profileToPolicyholderDefaults(profileQuery.data),
    [profileQuery.data],
  );
  const policyholderValues = useMemo(
    () => buildPolicyholderValues(policyholderDefaults, policyholderForm),
    [policyholderDefaults, policyholderForm],
  );

  const motorForDraft = useMemo(() => {
    const holderName = policyholderName(policyholderValues);
    return {
      ...motor,
      owner_name: motor.owner_name || holderName,
      owner_address:
        motor.owner_address || policyholderAddress(policyholderValues),
      owner_category:
        motor.owner_category ||
        (policyholderValues.customer_type === 'CORPORATE' ? '2' : '1'),
    };
  }, [motor, policyholderValues]);

  const policyholderErrors = useMemo(
    () => validatePolicyholder(policyholderValues),
    [policyholderValues],
  );
  const motorErrors = useMemo(
    () => validateMotor(motorForDraft),
    [motorForDraft],
  );
  const advancedMotorHasMissingFields = useMemo(
    () =>
      ADVANCED_MOTOR_FIELDS.some((field) =>
        Boolean(
          motorFieldError(field.key, motorForDraft[field.key], motorForDraft),
        ),
      ),
    [motorForDraft],
  );

  const selectionsReady = Boolean(
    selectedCompany && selectedProduct && selectedRisk,
  );
  const canSubmitCover =
    selectionsReady &&
    policyholderErrors.length === 0 &&
    motorErrors.length === 0 &&
    !profileQuery.isLoading;

  const currentStep = !selectedCompany
    ? 1
    : !selectedProduct
      ? 2
      : !selectedRisk
        ? 3
        : policyholderErrors.length
          ? 4
          : 5;

  const updatePolicyholder = (
    field: keyof PolicyholderFormState,
    value: string,
  ) => {
    setPolicyholderForm((current) => ({ ...current, [field]: value }));
  };

  const updatePolicyholderType = (value: CustomerType) => {
    setPolicyholderForm((current) => {
      const currentIdType = asCustomerIdType(
        current.id_type ??
          (policyholderDefaults.id_type
            ? String(policyholderDefaults.id_type)
            : ''),
      );
      const idTypeStillValid = CUSTOMER_ID_TYPE_OPTIONS.some(
        (option) =>
          option.value === currentIdType &&
          (option.appliesTo === 'BOTH' || option.appliesTo === value),
      );

      return {
        ...current,
        customer_type: value,
        id_type: idTypeStillValid ? current.id_type : '',
        gender: value === 'CORPORATE' ? '' : current.gender,
      };
    });
  };

  const updateMotor = (field: keyof MotorFormState, value: string) => {
    setMotor((current) => ({ ...current, [field]: value }));
  };

  const toggleDetailsSection = (sectionId: string) => {
    setOpenDetailsSection((current) =>
      current === sectionId ? null : (sectionId as DetailsSectionId),
    );
  };

  const verifyMotorFromPortal = useCallback(
    async (payload: MotorVerificationRequest) => {
      if (!selectedCompany) {
        throw new Error(
          'Select an insurance company before fetching vehicle details.',
        );
      }

      await portalApi.ensureCustomerCompanyContext(selectedCompany.id);
      return portalApi.verifyCustomerMotor(payload);
    },
    [selectedCompany],
  );

  const coverDates = useMemo(() => computeCoverNoteDateRange(365), []);

  const submitCoverMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany || !selectedProduct || !selectedRisk) {
        throw new Error('Select a company, product, and cover first.');
      }

      if (!selectedProduct.category) {
        throw new Error(
          'This product has no insurance category configured; contact support.',
        );
      }

      const validationErrors = [
        ...validatePolicyholder(policyholderValues),
        ...validateMotor(motorForDraft),
      ];
      if (validationErrors.length) {
        throw new Error(validationErrors[0]);
      }

      const companyContext = await portalApi.ensureCustomerCompanyContext(
        selectedCompany.id,
      );
      const productCode =
        selectedProduct.tiramis_product_code ||
        selectedProduct.product_code ||
        selectedProduct.id;

      const risk = {
        ...createEmptyRiskRow(),
        risk_id: selectedRisk.id,
        risk_code:
          selectedRisk.tiramis_risk_code ||
          selectedRisk.risk_code ||
          selectedRisk.id,
        sum_insured: motorForDraft.vehicle_value,
        sum_insured_equivalent: motorForDraft.vehicle_value,
        factor_values: {
          motor_category: motorForDraft.motor_category_code,
          motor_type: motorForDraft.motor_type_code,
          motor_usage: motorForDraft.motor_usage_code,
          owner_category: motorForDraft.owner_category,
        },
      };
      const subjectReference =
        motorForDraft.registration_no || motorForDraft.chassis_no;
      const vehicleLabel = [motorForDraft.make, motorForDraft.model]
        .filter(Boolean)
        .join(' ');
      const values: QuotationFormSchemaValues = {
        insurer_company_id: selectedCompany.id,
        intermediary_company_id: '',
        branch_id: '',
        department_id: '',
        sale_point_id: '',
        policyholder_mode: 'new',
        customer_id: '',
        policyholder: policyholderValues,
        category_id: selectedProduct.category.id,
        product_id: selectedProduct.id,
        sub_class_id: '',
        quotation_flow: 'MOTOR_SINGLE',
        quotation_type: 'MOTOR',
        is_fleet: false,
        channel_type: 'DIRECT',
        status: 'DRAFT',
        currency: 'TZS',
        exchange_rate: '1',
        sum_insured: motorForDraft.vehicle_value,
        basic_premium: '',
        total_discount: '',
        total_tax: '',
        total_charges: '',
        total_commission: '',
        total_premium: '',
        net_premium: '',
        valid_from: dateOnlyPart(coverDates.validFrom),
        valid_until: dateOnlyPart(coverDates.validUntil),
        rating_version: '',
        rejection_reason: '',
        cover_note_number: '',
        cover_note_desc: `${selectedRisk.name} cover for ${
          subjectReference || vehicleLabel || 'vehicle'
        }`,
        operative_clause:
          selectedRisk.description ||
          selectedProduct.description ||
          `${selectedRisk.name} cover`,
        cover_note_type: '1',
        prev_cover_note_reference: '',
        endorsement_type: '',
        endorsement_reason: '',
        endorsement_premium_earned: '',
        commission_paid: '',
        commission_rate: '',
        officer_name: '',
        officer_title: '',
        payment_mode_tira: '1',
        risks: [risk],
        addons: [],
        motor_mode: 'new',
        motor: motorForDraft,
        fleet: createEmptyFleetDetails(),
        nonMotor: createEmptyNonMotorDetails(),
      };

      return portalApi.submitQuotationDirect({
        draft: buildQuotationDraftPayload(values, 'motor'),
        payload: buildQuotationPayload(values, {
          salePointCode: companyContext.sale_point_code,
          productCode,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Cover submitted to TIRAMIS.');
      navigate('/customer/quotations');
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not submit cover',
      );
    },
  });

  const idTypeOptions = CUSTOMER_ID_TYPE_OPTIONS.filter(
    (option) =>
      option.appliesTo === 'BOTH' ||
      option.appliesTo === policyholderValues.customer_type,
  );
  const policyholderSummary = policyholderErrors.length
    ? policyholderErrors[0]
    : policyholderName(policyholderValues);
  const vehicleSummary = motorErrors.length
    ? motorErrors[0]
    : motorForDraft.registration_no ||
      motorForDraft.chassis_no ||
      [motorForDraft.make, motorForDraft.model].filter(Boolean).join(' ');
  const vehicleMakeModel =
    [motorForDraft.make, motorForDraft.model].filter(Boolean).join(' ') ||
    undefined;
  const policyholderLocation = [
    policyholderValues.district,
    policyholderValues.region,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer Portal"
        title="Buy Cover"
        description="Start with the insurer, pick the product, then choose the cover."
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-5">
        {[
          ['1', 'Insurer', selectedCompany?.name],
          ['2', 'Product', selectedProduct?.name],
          ['3', 'Cover', selectedRisk?.name],
          [
            '4',
            'Policyholder',
            policyholderErrors.length
              ? undefined
              : policyholderName(policyholderValues),
          ],
          [
            '5',
            'Vehicle',
            motorErrors.length
              ? undefined
              : motorForDraft.registration_no || motorForDraft.chassis_no,
          ],
        ].map(([step, label, value], index) => {
          const active = currentStep === index + 1;
          const done = Boolean(value);

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                active
                  ? 'border-blue-500 bg-blue-50'
                  : done
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-100 bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done
                    ? 'bg-emerald-600 text-white'
                    : active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-slate-500">
                  {label}
                </div>
                <div className="truncate text-sm font-semibold text-slate-950">
                  {value || 'Not selected'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="min-w-0 rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            Cover Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <FormField label="Insurance company" required>
            {companiesQuery.isLoading ? (
              <InlineStatus label="Loading companies..." />
            ) : companiesQuery.isError ? (
              <div className="flex gap-2">
                <InlineError label="Could not load companies." />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void companiesQuery.refetch();
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <NativeSelect
                value={selectedCompanyId ?? ''}
                onChange={(value) => {
                  setCompanyId(value || null);
                  setProductId(null);
                  setRiskId(null);
                }}
              >
                <option value="">Select insurer</option>
                {(companiesQuery.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.tira_ready ? ' - TIRAMIS ready' : ''}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField label="Product" required>
            {!selectedCompanyId ? (
              <InlineError label="Select insurer first." />
            ) : productsQuery.isLoading ? (
              <InlineStatus label="Loading products..." />
            ) : productsQuery.isError ? (
              <div className="flex gap-2">
                <InlineError label="Could not load products." />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void productsQuery.refetch();
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <NativeSelect
                value={selectedProductId ?? ''}
                onChange={(value) => {
                  setProductId(value || null);
                  setRiskId(null);
                }}
              >
                <option value="">Select product</option>
                {(productsQuery.data ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField label="Cover" required>
            {!selectedProductId ? (
              <InlineError label="Select product first." />
            ) : risksQuery.isLoading ? (
              <InlineStatus label="Loading covers..." />
            ) : risksQuery.isError ? (
              <div className="flex gap-2">
                <InlineError label="Could not load covers." />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void risksQuery.refetch();
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <NativeSelect
                value={selectedRiskId ?? ''}
                onChange={(value) => setRiskId(value || null)}
              >
                <option value="">Select cover</option>
                {(risksQuery.data ?? []).map((risk) => (
                  <option key={risk.id} value={risk.id}>
                    {risk.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </CardContent>
      </Card>

      <section className="min-w-0 space-y-4">
        <AccordionStepSection
          id="policyholder"
          title={
            <span className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-slate-500" />
              Policyholder Details
            </span>
          }
          summary={policyholderSummary}
          isOpen={openDetailsSection === 'policyholder'}
          onToggle={toggleDetailsSection}
          isComplete={policyholderErrors.length === 0}
          hasError={policyholderErrors.length > 0}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {profileQuery.isLoading ? (
              <div className="sm:col-span-2">
                <LoadingState label="Loading profile..." />
              </div>
            ) : null}
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <Label className="text-xs font-medium uppercase text-slate-500">
                Policyholder type
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: 'INDIVIDUAL' as const,
                    label: 'Private',
                    description: 'Personal policyholder',
                  },
                  {
                    value: 'CORPORATE' as const,
                    label: 'Commercial',
                    description: 'Company or organization',
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updatePolicyholderType(option.value)}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-left transition-colors',
                      policyholderValues.customer_type === option.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        'mt-1 block text-xs',
                        policyholderValues.customer_type === option.value
                          ? 'text-slate-200'
                          : 'text-slate-500',
                      )}
                    >
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <FormField
              label={
                policyholderValues.customer_type === 'CORPORATE'
                  ? 'Company name'
                  : 'Full name'
              }
              required
            >
              <Input
                value={
                  policyholderValues.customer_type === 'CORPORATE'
                    ? policyholderValues.company_name
                    : policyholderValues.full_name
                }
                onChange={(event) =>
                  updatePolicyholder(
                    policyholderValues.customer_type === 'CORPORATE'
                      ? 'company_name'
                      : 'full_name',
                    event.target.value,
                  )
                }
              />
            </FormField>
            {policyholderValues.customer_type === 'INDIVIDUAL' ? (
              <FormField label="Gender" required>
                <NativeSelect
                  value={policyholderValues.gender}
                  onChange={(value) => updatePolicyholder('gender', value)}
                >
                  <option value="">Select gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </NativeSelect>
              </FormField>
            ) : null}
            <FormField
              label={
                policyholderValues.customer_type === 'CORPORATE'
                  ? 'Incorporation date'
                  : 'Date of birth'
              }
              required
            >
              <Input
                type="date"
                value={policyholderValues.date_of_birth}
                onChange={(event) =>
                  updatePolicyholder('date_of_birth', event.target.value)
                }
              />
            </FormField>
            <FormField label="ID type" required>
              <NativeSelect
                value={
                  policyholderValues.id_type
                    ? String(policyholderValues.id_type)
                    : ''
                }
                onChange={(value) => updatePolicyholder('id_type', value)}
              >
                <option value="">Select ID type</option>
                {idTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="ID number" required>
              <Input
                value={policyholderValues.id_number}
                onChange={(event) =>
                  updatePolicyholder('id_number', event.target.value)
                }
              />
            </FormField>
            <FormField label="Phone" required>
              <Input
                value={policyholderValues.phone}
                onChange={(event) =>
                  updatePolicyholder('phone', event.target.value)
                }
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={policyholderValues.email}
                onChange={(event) =>
                  updatePolicyholder('email', event.target.value)
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <LocationReferenceSelects
                country={policyholderValues.country}
                countryCode={policyholderValues.country_code}
                region={policyholderValues.region}
                district={policyholderValues.district}
                errors={{
                  country: policyholderValues.country_code.trim()
                    ? undefined
                    : 'Country is required',
                  region: policyholderValues.region.trim()
                    ? undefined
                    : 'Region is required',
                  district: policyholderValues.district.trim()
                    ? undefined
                    : 'District is required',
                }}
                onCountryChange={(country, code) => {
                  updatePolicyholder('country', country);
                  updatePolicyholder('country_code', code);
                }}
                onRegionChange={(region) =>
                  updatePolicyholder('region', region)
                }
                onDistrictChange={(district) =>
                  updatePolicyholder('district', district)
                }
              />
            </div>
            <details className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Address details
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField label="Street">
                  <Input
                    value={policyholderValues.street}
                    onChange={(event) =>
                      updatePolicyholder('street', event.target.value)
                    }
                  />
                </FormField>
                <FormField label="Postal address">
                  <Input
                    value={policyholderValues.postal_address}
                    onChange={(event) =>
                      updatePolicyholder('postal_address', event.target.value)
                    }
                  />
                </FormField>
              </div>
            </details>
          </div>
        </AccordionStepSection>

        <AccordionStepSection
          id="vehicle"
          title={
            <span className="flex items-center gap-2">
              <Car className="h-4 w-4 text-slate-500" />
              Vehicle Details
            </span>
          }
          summary={vehicleSummary}
          isOpen={openDetailsSection === 'vehicle'}
          onToggle={toggleDetailsSection}
          isComplete={motorErrors.length === 0}
          hasError={motorErrors.length > 0}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <VehicleLookup
                initialCategory={motor.motor_category_code}
                verifyMotor={verifyMotorFromPortal}
                onFound={(details) => {
                  setMotor((current) =>
                    mergeVerifiedMotor(
                      current,
                      details,
                      createInitialMotorDetails(),
                    ),
                  );
                }}
              />
            </div>
            {CORE_MOTOR_FIELDS.map((field) => (
              <MotorFieldInput
                key={field.key}
                field={field}
                motor={motor}
                onChange={updateMotor}
              />
            ))}
            <details
              className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2"
              open={advancedMotorHasMissingFields}
            >
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Additional vehicle details
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {ADVANCED_MOTOR_FIELDS.map((field) => (
                  <MotorFieldInput
                    key={field.key}
                    field={field}
                    motor={motor}
                    onChange={updateMotor}
                  />
                ))}
              </div>
            </details>
          </div>
        </AccordionStepSection>
      </section>

      <Card className="min-w-0 rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-slate-500" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-4">
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Cover</h3>
            <SummaryField label="Insurer" value={selectedCompany?.name} />
            <SummaryField label="Product" value={selectedProduct?.name} />
            <SummaryField label="Cover" value={selectedRisk?.name} />
            <SummaryField
              label="Period"
              value={`${dateOnlyPart(coverDates.validFrom)} to ${dateOnlyPart(
                coverDates.validUntil,
              )}`}
            />
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Premium</h3>
            <SummaryField label="Before tax" value={formatPremiumSummary()} />
            <SummaryField label="After tax" value={formatPremiumSummary()} />
            <SummaryField label="Currency" value="TZS" />
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Policyholder
            </h3>
            <SummaryField
              label="Type"
              value={
                policyholderValues.customer_type === 'CORPORATE'
                  ? 'Commercial'
                  : 'Private'
              }
            />
            <SummaryField
              label="Name"
              value={policyholderName(policyholderValues)}
            />
            <SummaryField
              label="ID number"
              value={policyholderValues.id_number}
            />
            <SummaryField label="Phone" value={policyholderValues.phone} />
            <SummaryField label="Location" value={policyholderLocation} />
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Vehicle</h3>
            <SummaryField
              label="Registration"
              value={motorForDraft.registration_no}
            />
            <SummaryField label="Chassis" value={motorForDraft.chassis_no} />
            <SummaryField label="Make / model" value={vehicleMakeModel} />
            <SummaryField
              label="Usage"
              value={
                motorForDraft.motor_usage_code === '2'
                  ? 'Commercial'
                  : 'Private'
              }
            />
            <SummaryField
              label="Submission"
              value={canSubmitCover ? 'Ready for TIRAMIS' : 'Incomplete'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {canSubmitCover
            ? `${selectedCompany?.name} / ${selectedProduct?.name} / ${selectedRisk?.name}`
            : selectionsReady
              ? (policyholderErrors[0] ?? motorErrors[0])
              : 'Complete the selections to submit your cover.'}
        </div>
        <Button
          disabled={!canSubmitCover || submitCoverMutation.isPending}
          onClick={() => submitCoverMutation.mutate()}
          className="sm:min-w-44"
        >
          {submitCoverMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit to TIRAMIS
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
