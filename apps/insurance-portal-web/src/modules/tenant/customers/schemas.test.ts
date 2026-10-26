import { describe, expect, it } from 'vitest';

import {
  buildCustomerPayload,
  customerFormSchema,
  getCustomerDefaultValues,
  normalizePolicyholderFormValues,
} from './schemas';
import type { CustomerFormValues, CustomerRecord } from './types';

function validIndividual(
  overrides: Partial<CustomerFormValues> = {},
): CustomerFormValues {
  return {
    ...getCustomerDefaultValues(),
    policy_holder_name: 'Asha Juma',
    policy_holder_birth_date: '1990-01-01',
    policy_holder_type: 1,
    policy_holder_id_number: '19900101123450000112',
    policy_holder_id_type: 1,
    gender: 'F',
    country_code: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    street: 'Samora Ave',
    policy_holder_phone_number: '+255700000000',
    ...overrides,
  };
}

function issuePaths(values: CustomerFormValues) {
  const result = customerFormSchema.safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('customerFormSchema', () => {
  it('accepts a complete individual policyholder', () => {
    expect(issuePaths(validIndividual())).toEqual([]);
  });

  it('requires every mandatory policyholder field', () => {
    const paths = issuePaths(getCustomerDefaultValues());

    expect(paths).toEqual(
      expect.arrayContaining([
        'policy_holder_name',
        'policy_holder_birth_date',
        'policy_holder_id_number',
        'policy_holder_id_type',
        'gender',
        'region',
        'district',
        'street',
        'policy_holder_phone_number',
      ]),
    );
  });

  it('makes gender optional for corporate policyholders', () => {
    expect(
      issuePaths(validIndividual({ policy_holder_type: 2, gender: '' })),
    ).toEqual([]);
  });

  it('enforces the TIRA maximum lengths', () => {
    const paths = issuePaths(
      validIndividual({
        policy_holder_name: 'x'.repeat(101),
        street: 'x'.repeat(51),
        postal_address: 'x'.repeat(51),
      }),
    );

    expect(paths).toEqual(
      expect.arrayContaining([
        'policy_holder_name',
        'street',
        'postal_address',
      ]),
    );
  });

  it('rejects an invalid email and a non ISO alpha-3 country code', () => {
    const paths = issuePaths(
      validIndividual({ email_address: 'not-an-email', country_code: 'TZ' }),
    );

    expect(paths).toEqual(
      expect.arrayContaining(['email_address', 'country_code']),
    );
  });
});

describe('buildCustomerPayload', () => {
  it('sends only the policyholder fields, with empty optionals as null', () => {
    const payload = buildCustomerPayload(
      validIndividual({
        policy_holder_name: '  Asha Juma ',
        country_code: 'tza',
      }),
    );

    expect(payload).toEqual({
      policy_holder_name: 'Asha Juma',
      policy_holder_birth_date: '1990-01-01',
      policy_holder_type: 1,
      policy_holder_id_number: '19900101123450000112',
      policy_holder_id_type: 1,
      gender: 'F',
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      street: 'Samora Ave',
      policy_holder_phone_number: '+255700000000',
      policy_holder_fax: null,
      postal_address: null,
      email_address: null,
    });
  });
});

describe('getCustomerDefaultValues', () => {
  it('maps a stored customer onto the policyholder fields', () => {
    const values = getCustomerDefaultValues({
      customer_type: 'CORPORATE',
      policy_holder_type: 2,
      company_name: 'Kilimo Ltd',
      date_of_birth: '2010-05-20',
      id_type: 6,
      id_number: '100200300',
      phone: '0222110000',
      fax: '0222110001',
      email: 'info@kilimo.tz',
      street: 'Uhuru St',
    } as Partial<CustomerRecord>);

    expect(values).toMatchObject({
      policy_holder_name: 'Kilimo Ltd',
      policy_holder_type: 2,
      policy_holder_birth_date: '2010-05-20',
      policy_holder_id_type: 6,
      policy_holder_id_number: '100200300',
      policy_holder_phone_number: '0222110000',
      policy_holder_fax: '0222110001',
      email_address: 'info@kilimo.tz',
      street: 'Uhuru St',
    });
  });
});

describe('normalizePolicyholderFormValues', () => {
  it('converts a draft saved with the old customer form fields', () => {
    const values = normalizePolicyholderFormValues({
      customer_type: 'CORPORATE',
      full_name: '',
      company_name: 'Kilimo Ltd',
      date_of_birth: '2010-05-20',
      id_type: 7,
      id_number: 'INC-1',
      phone: '0754000111',
      email: 'a@b.tz',
      fax: '',
      country: 'Tanzania',
      country_code: 'TZA',
      region: 'Arusha',
      district: 'Arusha',
      status: 'ACTIVE',
    });

    expect(values).toEqual({
      ...getCustomerDefaultValues(),
      policy_holder_name: 'Kilimo Ltd',
      policy_holder_type: 2,
      policy_holder_birth_date: '2010-05-20',
      policy_holder_id_type: 7,
      policy_holder_id_number: 'INC-1',
      policy_holder_phone_number: '0754000111',
      email_address: 'a@b.tz',
      region: 'Arusha',
      district: 'Arusha',
    });
  });

  it('passes current-shape values through unchanged', () => {
    const current = validIndividual({ postal_address: 'P.O. Box 1' });

    expect(normalizePolicyholderFormValues(current)).toEqual(current);
  });
});
