import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { ClaimField } from './ClaimField';
import {
  CLAIMANT_CATEGORY_OPTIONS,
  CLAIMANT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ID_TYPE_OPTIONS,
  PARTY_TYPE_OPTIONS,
} from '../constants';
import type { ClaimantFormValues } from '../wizard/schema';

/**
 * The TIRAMIS claimant fields (§10.1) for one claimant, found at `prefix`
 * in any form ('' for a form that is itself a claimant, or 'claimants.0').
 */
export function ClaimantFields<TValues extends FieldValues>({
  form,
  prefix,
  claimant,
}: {
  form: UseFormReturn<TValues>;
  prefix: string;
  claimant: ClaimantFormValues;
}) {
  const name = (field: keyof ClaimantFormValues) =>
    (prefix ? `${prefix}.${field}` : field) as FieldPath<TValues>;
  const isIndividual = claimant.party_type !== '2';

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ClaimField
        form={form}
        name={name('claimant_type')}
        label="Role"
        options={CLAIMANT_TYPE_OPTIONS}
        required
      />
      {!claimant.uses_policyholder ? (
        <>
          <ClaimField
            form={form}
            name={name('full_name')}
            label="Full name"
            required
            maxLength={100}
          />
          <ClaimField
            form={form}
            name={name('claimant_category')}
            label="TIRA category"
            options={CLAIMANT_CATEGORY_OPTIONS}
          />
          <ClaimField
            form={form}
            name={name('party_type')}
            label="Individual or corporate"
            options={PARTY_TYPE_OPTIONS}
          />
          <ClaimField
            form={form}
            name={name('id_type')}
            label="ID type"
            options={ID_TYPE_OPTIONS}
          />
          <ClaimField
            form={form}
            name={name('identification_number')}
            label="ID number"
            maxLength={50}
          />
          <ClaimField
            form={form}
            name={name('birth_date')}
            label={isIndividual ? 'Birth date' : 'Registration date'}
            type="date"
          />
          {isIndividual ? (
            <ClaimField
              form={form}
              name={name('gender')}
              label="Gender"
              options={GENDER_OPTIONS}
            />
          ) : null}
          <ClaimField
            form={form}
            name={name('phone')}
            label="Phone"
            type="tel"
            maxLength={50}
          />
          <ClaimField
            form={form}
            name={name('email')}
            label="Email"
            type="email"
          />
          <ClaimField
            form={form}
            name={name('country_code')}
            label="Country (ISO code)"
            uppercase
            maxLength={3}
          />
          <ClaimField
            form={form}
            name={name('region')}
            label="Region"
            maxLength={50}
          />
          <ClaimField
            form={form}
            name={name('district')}
            label="District"
            maxLength={50}
          />
          <ClaimField
            form={form}
            name={name('street')}
            label="Street"
            maxLength={100}
          />
          <ClaimField
            form={form}
            name={name('postal_address')}
            label="Postal address"
            maxLength={100}
          />
        </>
      ) : null}
      <ClaimField
        form={form}
        name={name('amount_claimed')}
        label="Amount claimed"
        type="number"
      />
    </div>
  );
}
