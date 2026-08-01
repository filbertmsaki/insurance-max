import { BadRequestException } from '@nestjs/common';

import { MotorCategory } from '../constants/tiramis-verification.constants';
import { TiramisVerificationService } from './tiramis-verification.service';

describe('TiramisVerificationService motor validation', () => {
  const service = new (TiramisVerificationService as any)(
    ...new Array(10).fill(undefined),
  ) as TiramisVerificationService;

  const normalize = (value: any) =>
    (service as any).normalizeMotorVerificationDto(value);

  it.each([
    [MotorCategory.MOTOR_VEHICLE, 'T665CSF', null],
    [MotorCategory.MOTORCYCLE, null, 'CHASSIS-001'],
    [MotorCategory.MOTOR_VEHICLE, 'T665CSF', 'CHASSIS-001'],
  ])(
    'accepts category %s with registration=%s and chassis=%s',
    (motorCategory, motorRegistrationNumber, motorChassisNumber) => {
      expect(
        normalize({
          motorCategory,
          motorRegistrationNumber,
          motorChassisNumber,
        }),
      ).toMatchObject({
        motorCategory,
        motorRegistrationNumber,
        motorChassisNumber,
      });
    },
  );

  it('trims values before validation and payload generation', () => {
    expect(
      normalize({
        motorCategory: MotorCategory.MOTOR_VEHICLE,
        motorRegistrationNumber: '  T665CSF  ',
        motorChassisNumber: '  CHASSIS-001  ',
      }),
    ).toMatchObject({
      motorRegistrationNumber: 'T665CSF',
      motorChassisNumber: 'CHASSIS-001',
    });
  });

  it.each([undefined, null, 0, 3, '1'])(
    'rejects invalid motor category %p',
    (motorCategory) => {
      expect(() =>
        normalize({
          motorCategory,
          motorRegistrationNumber: 'T665CSF',
        }),
      ).toThrow(BadRequestException);
    },
  );

  it('rejects missing or whitespace-only search fields', () => {
    expect(() =>
      normalize({ motorCategory: MotorCategory.MOTOR_VEHICLE }),
    ).toThrow(
      'Either motorRegistrationNumber or motorChassisNumber must be provided',
    );

    expect(() =>
      normalize({
        motorCategory: MotorCategory.MOTOR_VEHICLE,
        motorRegistrationNumber: '   ',
        motorChassisNumber: '\t',
      }),
    ).toThrow(
      'Either motorRegistrationNumber or motorChassisNumber must be provided',
    );
  });

  it.each(['a'.repeat(51), 'b'.repeat(51)])(
    'rejects motor fields longer than 50 characters',
    (value) => {
      expect(() =>
        normalize({
          motorCategory: MotorCategory.MOTOR_VEHICLE,
          motorRegistrationNumber: value,
        }),
      ).toThrow('motorRegistrationNumber must not exceed 50 characters');
    },
  );
});
