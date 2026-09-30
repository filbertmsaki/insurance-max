import { useFieldArray } from 'react-hook-form';
import { Info, Plus, Trash2, UserRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { ClaimField } from '../../components/ClaimField';
import {
  CLAIMANT_CATEGORY_OPTIONS,
  CLAIMANT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ID_TYPE_OPTIONS,
  PARTY_TYPE_OPTIONS,
} from '../../constants';
import {
  emptyClaimant,
  policyholderClaimant,
  type ClaimFormValues,
} from '../schema';
import type { ClaimWizard } from '../useClaimWizard';

export function ClaimantsStep({ wizard }: { wizard: ClaimWizard }) {
  const { form, policy } = wizard;
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'claimants',
  });
  const claimants = form.watch('claimants');
  const hasPolicyholder = claimants.some(
    (claimant) => claimant.uses_policyholder,
  );
  const policyholderName = policy.data?.customer?.name ?? 'Policyholder';
  const listError =
    form.formState.errors.claimants?.message ??
    form.formState.errors.claimants?.root?.message;

  function makePrimary(index: number) {
    claimants.forEach((claimant, position) => {
      if (claimant.is_primary !== (position === index)) {
        update(position, { ...claimant, is_primary: position === index });
      }
    });
  }

  return (
    <div className="space-y-6">
      <StepSection
        title="Claimants"
        description="Everyone claiming under this loss. The primary claimant receives correspondence."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={hasPolicyholder}
              onClick={() =>
                append(policyholderClaimant(claimants.length === 0))
              }
            >
              <UserRound className="mr-1.5 h-4 w-4" />
              Add policyholder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append(emptyClaimant({ is_primary: claimants.length === 0 }))
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add claimant
            </Button>
          </div>
        }
        first
      >
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            TIRA needs each claimant’s category, type, ID, country, district and
            phone number at intimation. You can complete them later, but the
            intimation cannot be submitted without them.
          </AlertDescription>
        </Alert>
        {listError ? (
          <p className="text-sm font-medium text-red-600">{listError}</p>
        ) : null}
      </StepSection>

      {fields.map((field, index) => {
        const claimant = claimants[index];
        if (!claimant) return null;
        const prefix = `claimants.${index}` as const;
        const isIndividual = claimant.party_type !== '2';

        return (
          <StepSection
            key={field.id}
            variant="item"
            title={
              <span className="flex items-center gap-2">
                {claimant.uses_policyholder
                  ? policyholderName
                  : claimant.full_name?.trim() || `Claimant ${index + 1}`}
                {claimant.is_primary ? (
                  <Badge variant="primary">Primary</Badge>
                ) : null}
                {claimant.uses_policyholder ? (
                  <Badge variant="secondary">Policyholder record</Badge>
                ) : null}
              </span>
            }
            action={
              <div className="flex gap-1">
                {!claimant.is_primary ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => makePrimary(index)}
                  >
                    Make primary
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove claimant ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => {
                    const wasPrimary = claimant.is_primary;
                    remove(index);
                    if (wasPrimary && fields.length > 1) {
                      const next = form.getValues('claimants')[0];
                      if (next) update(0, { ...next, is_primary: true });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ClaimField<ClaimFormValues>
                form={form}
                name={`${prefix}.claimant_type`}
                label="Role"
                options={CLAIMANT_TYPE_OPTIONS}
                required
              />
              {!claimant.uses_policyholder ? (
                <>
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.full_name`}
                    label="Full name"
                    required
                    maxLength={100}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.claimant_category`}
                    label="TIRA category"
                    options={CLAIMANT_CATEGORY_OPTIONS}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.party_type`}
                    label="Individual or corporate"
                    options={PARTY_TYPE_OPTIONS}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.id_type`}
                    label="ID type"
                    options={ID_TYPE_OPTIONS}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.identification_number`}
                    label="ID number"
                    maxLength={50}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.birth_date`}
                    label={isIndividual ? 'Birth date' : 'Registration date'}
                    type="date"
                  />
                  {isIndividual ? (
                    <ClaimField<ClaimFormValues>
                      form={form}
                      name={`${prefix}.gender`}
                      label="Gender"
                      options={GENDER_OPTIONS}
                    />
                  ) : null}
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.phone`}
                    label="Phone"
                    type="tel"
                    maxLength={50}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.email`}
                    label="Email"
                    type="email"
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.country_code`}
                    label="Country (ISO code)"
                    uppercase
                    maxLength={3}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.region`}
                    label="Region"
                    maxLength={50}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.district`}
                    label="District"
                    maxLength={50}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.street`}
                    label="Street"
                    maxLength={100}
                  />
                  <ClaimField<ClaimFormValues>
                    form={form}
                    name={`${prefix}.postal_address`}
                    label="Postal address"
                    maxLength={100}
                  />
                </>
              ) : null}
              <ClaimField<ClaimFormValues>
                form={form}
                name={`${prefix}.amount_claimed`}
                label="Amount claimed"
                type="number"
              />
            </div>
            {claimant.uses_policyholder ? (
              <p className="mt-2 text-xs text-slate-500">
                Name, ID and address are copied from the policyholder’s customer
                record when the claim is saved.
              </p>
            ) : null}
          </StepSection>
        );
      })}
    </div>
  );
}
