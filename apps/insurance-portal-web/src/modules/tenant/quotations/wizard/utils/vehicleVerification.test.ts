import { describe, expect, it } from 'vitest';
import type { VerificationResult } from '@/modules/tenant/verifications/api';
import {
  readVerifiedMotorDetails,
  toFleetMotorDetails,
} from './vehicleVerification';

function response(overrides: Partial<VerificationResult>): VerificationResult {
  return {
    success: true,
    verificationType: 'MOTOR',
    requestId: null,
    transactionId: null,
    status: 'SUCCESS',
    responseCode: 'TIRA001',
    responseMessage: null,
    registrationNumber: null,
    coverNoteReferenceNumber: null,
    verifiedRecordDetails: null,
    respondedAt: null,
    fullResponse: {},
    ...overrides,
  };
}

describe('vehicle verification mapping', () => {
  it('maps normalized details, numeric codes and zero values into single and fleet fields', () => {
    const motor = readVerifiedMotorDetails(
      response({
        verifiedRecordDetails: {
          responseHeader: { ResponseStatusCode: 'TIRA001' },
          responseDetails: {
            RegistrationNumber: ' t123abc ',
            ChassisNumber: 'abc123',
            Make: 'Toyota',
            Model: 'Corolla',
            ModelNumber: 'abc',
            EngineNumber: 'eng123',
            EngineCapacity: 1500,
            SittingCapacity: 5,
            YearOfManufacture: 2020,
            MotorUsage: 2,
            MotorType: 1,
            OwnerCategory: 1,
            OwnerName: 'Jane Doe',
            OwnerAddress: 'Dar es Salaam',
            AxleDistance: 0,
            TareWeight: 1200,
            GrossWeight: 1500,
            BodyType: 'Saloon',
            Color: 'White',
            FuelUsed: 'Petrol',
            NumberOfAxles: 2,
          },
        },
      }),
      '1',
    );
    expect(motor).toMatchObject({
      registration_no: 'T123ABC',
      chassis_no: 'ABC123',
      make: 'TOYOTA',
      model: 'COROLLA',
      engine_no: 'ENG123',
      cubic_capacity: '1500',
      seating_capacity: '5',
      manufacture_year: '2020',
      motor_usage_code: '2',
      usage_type: 'Commercial',
      owner_category: '1',
      owner_name: 'Jane Doe',
      axle_distance: '0',
    });
    expect(toFleetMotorDetails(motor!)).toMatchObject({
      registration_number: 'T123ABC',
      chassis_number: 'ABC123',
      motor_category: '1',
      engine_capacity: '1500',
      sitting_capacity: '5',
      year_of_manufacture: '2020',
      motor_usage: '2',
      owner_category: '1',
      axle_distance: '0',
    });
  });

  it('supports XML-only records and skips empty fields without inventing values', () => {
    const motor = readVerifiedMotorDetails(
      response({
        xml: '<MotorVerificationRes><VerificationDtl><RegistrationNumber>mc123</RegistrationNumber><Make>Honda</Make><Model/><EngineNumber>N/A</EngineNumber><OwnerCategory>9</OwnerCategory></VerificationDtl></MotorVerificationRes>',
      }),
      '2',
    );
    expect(motor).toEqual({
      registration_no: 'MC123',
      make: 'HONDA',
      motor_category_code: '2',
      vehicle_category: 'Motor Cycle',
    });
  });

  it('accepts direct details with motor-prefixed identifiers', () => {
    expect(
      readVerifiedMotorDetails(
        response({
          verifiedRecordDetails: {
            MotorChassisNumber: 'ch123',
            MotorRegistrationNumber: 't123',
          },
        }),
        '1',
      ),
    ).toMatchObject({ chassis_no: 'CH123', registration_no: 'T123' });
  });

  it('rejects missing records, header-only responses and malformed XML', () => {
    for (const result of [
      response({}),
      response({
        verifiedRecordDetails: {
          responseHeader: { ResponseStatusCode: 'TIRA001' },
          responseDetails: {},
        },
      }),
      response({ xml: '<invalid' }),
      response({
        success: false,
        responseCode: 'TIRA007',
        verifiedRecordDetails: { Make: 'Toyota' },
      }),
    ]) {
      expect(readVerifiedMotorDetails(result, '1')).toBeNull();
    }
  });
});
