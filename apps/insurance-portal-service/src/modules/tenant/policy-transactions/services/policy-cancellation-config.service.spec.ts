import {
  CancellationMethod,
  CancellationReasonType,
} from '@insurance-max/contracts';
import { PolicyCancellationConfigService } from './policy-cancellation-config.service';

describe('PolicyCancellationConfigService', () => {
  const companyId = 'company-1';

  function makeService(value: unknown) {
    return new PolicyCancellationConfigService({
      getValue: jest.fn().mockResolvedValue(value),
    } as any);
  }

  it('resolves the TIRA-mandated cancellation endorsement type (4) even with no company config at all', async () => {
    const service = makeService({});

    await expect(
      service.resolve(companyId, CancellationReasonType.CUSTOMER_REQUEST),
    ).resolves.toMatchObject({
      cancellationMethod: CancellationMethod.PRO_RATA,
      tiraEndorsementType: 4,
    });
  });

  it('rejects an invalid configured cancellation method', async () => {
    const service = makeService({
      default: {
        cancellationMethod: 'NOT_A_REAL_METHOD',
      },
    });

    await expect(
      service.resolve(companyId, CancellationReasonType.CUSTOMER_REQUEST),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_CANCELLATION_METHOD',
      }),
    });
  });

  it('merges reason-specific rules over the default rule', async () => {
    const service = makeService({
      default: {
        cancellationMethod: CancellationMethod.PRO_RATA,
        cancellationCharge: '0',
        minimumRetainedPremium: '0',
        requireApproval: true,
      },
      reasons: {
        [CancellationReasonType.NON_PAYMENT]: {
          cancellationMethod: CancellationMethod.NO_REFUND,
          cancellationCharge: '25000',
        },
      },
    });

    await expect(
      service.resolve(companyId, CancellationReasonType.NON_PAYMENT),
    ).resolves.toMatchObject({
      cancellationMethod: CancellationMethod.NO_REFUND,
      tiraEndorsementType: 4,
      cancellationCharge: '25000',
      requireApproval: true,
    });
  });
});
