import { describe, expect, it, vi } from 'vitest';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import { getCustomerDefaultValues } from '@/modules/tenant/customers/schemas';
import type { VerificationResult } from '@/modules/tenant/verifications/api';
import { createEmptyMotorDetails } from '../../schemas';
import {
  applyOwnerDefaults,
  inferMotorCategory,
  lookupVehicleWithTira,
  missingMotorFieldKeys,
  ownerDefaultsFromPolicyholder,
  vehicleRecordToMotorDetails,
} from './motorVehicleSelection';

const verified = (details: Record<string, unknown>): VerificationResult => ({
  success: true,
  verificationType: 'MOTOR',
  status: 'SUCCESS',
  responseCode: 'TIRA001',
  requestId: null,
  transactionId: null,
  responseMessage: null,
  registrationNumber: null,
  coverNoteReferenceNumber: null,
  respondedAt: null,
  fullResponse: {},
  verifiedRecordDetails: { responseDetails: details },
});

const notFound: VerificationResult = {
  ...verified({}),
  success: false,
  responseCode: 'TIRA007',
  verifiedRecordDetails: null,
};

describe('vehicleRecordToMotorDetails', () => {
  it('fills the form from a register entry and strips spaces from identifiers', () => {
    const details = vehicleRecordToMotorDetails({
      id: 'v1',
      registration_no: 'T 123 ABC',
      chassis_no: 'jte 0001234',
      engine_no: '1GR 998',
      make: 'Toyota',
      model: 'Land Cruiser',
      manufacture_year: 2022,
      motor_category: 1,
      motor_type: 2,
      motor_usage: null,
      usage_type: 'Commercial',
      seating_capacity: 7,
      owner_category: 2,
      metadata: null,
    } as unknown as MotorVehicleRecord);

    expect(details).toMatchObject({
      vehicle_id: 'v1',
      registration_no: 'T123ABC',
      chassis_no: 'JTE0001234',
      engine_no: '1GR998',
      make: 'TOYOTA',
      model: 'LAND CRUISER',
      manufacture_year: '2022',
      motor_category_code: '1',
      motor_type_code: '2',
      motor_usage_code: '2',
      seating_capacity: '7',
      owner_category: '2',
    });
  });
});

describe('missingMotorFieldKeys', () => {
  it('lists only the required fields that are still empty or invalid', () => {
    const motor = {
      ...createEmptyMotorDetails(),
      motor_category_code: '1' as const,
      registration_no: 'T123ABC',
      chassis_no: 'JTE0001234',
      engine_no: 'ENG123',
      make: 'TOYOTA',
      model: 'HILUX',
      body_type: 'PICKUP',
      color: 'WHITE',
      manufacture_year: '2020',
      cubic_capacity: '2800',
      fuel_type: 'DIESEL',
      tare_weight: '2000',
      gross_weight: '1500',
      owner_name: 'Jane',
      owner_category: '1' as const,
    };
    expect(missingMotorFieldKeys(motor)).toEqual(['gross_weight']);
  });

  it('does not ask for a registration on an in-transit vehicle', () => {
    expect(
      missingMotorFieldKeys({
        ...createEmptyMotorDetails(),
        motor_type_code: '2',
      }),
    ).not.toContain('registration_no');
  });
});

describe('owner defaults', () => {
  const customer = {
    customer_type: 'CORPORATE',
    company_name: 'Kiswigu Ltd',
    first_name: null,
    middle_name: null,
    last_name: null,
    postal_address: '',
    street: 'Samora Ave',
    district: 'Ilala',
    region: 'Dar es Salaam',
  } as unknown as CustomerRecord;

  it('uses the selected customer', () => {
    expect(
      ownerDefaultsFromPolicyholder(
        {
          policyholder_mode: 'existing',
          policyholder: getCustomerDefaultValues(),
        },
        customer,
      ),
    ).toEqual({
      owner_name: 'Kiswigu Ltd',
      owner_category: '2',
      owner_address: 'Samora Ave, Ilala, Dar es Salaam',
    });
  });

  it('uses the new policyholder details', () => {
    expect(
      ownerDefaultsFromPolicyholder({
        policyholder_mode: 'new',
        policyholder: {
          ...getCustomerDefaultValues(),
          full_name: 'John Mwita',
          postal_address: 'P.O. Box 1, Dodoma',
        },
      }),
    ).toEqual({
      owner_name: 'John Mwita',
      owner_category: '1',
      owner_address: 'P.O. Box 1, Dodoma',
    });
  });

  it('fills empty owner fields and never overwrites typed ones', () => {
    const motor = { ...createEmptyMotorDetails(), owner_name: 'TIRA OWNER' };
    expect(
      applyOwnerDefaults(motor, {
        owner_name: 'John',
        owner_category: '1',
        owner_address: 'Ilala',
      }),
    ).toEqual({ owner_address: 'Ilala' });
  });

  it('replaces defaults applied for a previous policyholder', () => {
    const previous = {
      owner_name: 'John',
      owner_category: '1' as const,
      owner_address: 'Ilala',
    };
    const motor = { ...createEmptyMotorDetails(), ...previous };
    expect(
      applyOwnerDefaults(
        motor,
        {
          owner_name: 'Kiswigu Ltd',
          owner_category: '2',
          owner_address: 'Arusha',
        },
        previous,
      ),
    ).toEqual({
      owner_name: 'Kiswigu Ltd',
      owner_category: '2',
      owner_address: 'Arusha',
    });
  });
});

describe('lookupVehicleWithTira', () => {
  it('infers motorcycles from MC plates', () => {
    expect(inferMotorCategory('mc 123 abc')).toBe(2);
    expect(inferMotorCategory('T123ABC')).toBe(1);
  });

  it('tries a short value as a registration first', async () => {
    const verify = vi
      .fn()
      .mockResolvedValue(
        verified({ RegistrationNumber: 'T123ABC', Make: 'Toyota' }),
      );
    const result = await lookupVehicleWithTira(' t 123 abc ', verify);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({
      motorCategory: 1,
      motorRegistrationNumber: 'T123ABC',
    });
    expect(result).toMatchObject({
      status: 'found',
      details: { registration_no: 'T123ABC', make: 'TOYOTA' },
    });
  });

  it('falls back to the chassis number when the registration is unknown', async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(
        verified({ ChassisNumber: 'ABC12345', Make: 'Isuzu' }),
      );
    const result = await lookupVehicleWithTira('ABC12345', verify);
    expect(verify).toHaveBeenNthCalledWith(2, {
      motorCategory: 1,
      motorChassisNumber: 'ABC12345',
    });
    expect(result.status).toBe('found');
  });

  it('looks up long values as chassis numbers only', async () => {
    const verify = vi.fn().mockResolvedValue(notFound);
    const result = await lookupVehicleWithTira('JTEBU5JR0A5012345', verify);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({
      motorCategory: 1,
      motorChassisNumber: 'JTEBU5JR0A5012345',
    });
    expect(result).toEqual({ status: 'not-found' });
  });

  it('reports pending lookups and TIRA errors without a second call', async () => {
    const pending = vi
      .fn()
      .mockResolvedValue({
        ...notFound,
        responseCode: null,
        status: 'PENDING',
      });
    expect(await lookupVehicleWithTira('T123ABC', pending)).toEqual({
      status: 'pending',
    });

    const failing = vi.fn().mockResolvedValue({
      ...notFound,
      responseCode: 'TIRA999',
      responseMessage: 'Service unavailable',
    });
    expect(await lookupVehicleWithTira('T123ABC', failing)).toEqual({
      status: 'error',
      message: 'Service unavailable',
    });
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
