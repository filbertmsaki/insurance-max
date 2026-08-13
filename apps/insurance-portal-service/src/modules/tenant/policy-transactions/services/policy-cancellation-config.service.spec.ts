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

  it('rejects cancellation rules without a configured TIRAMIS cancellation type', async () => {
    const service = makeService({
      default: {
        cancellationMethod: CancellationMethod.PRO_RATA,
        tiraEndorsementType: 0,
      },
    });

    await expect(
      service.resolve(companyId, CancellationReasonType.CUSTOMER_REQUEST),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TIRA_CANCELLATION_TYPE_NOT_CONFIGURED',
      }),
    });
  });

  it('merges reason-specific rules over the default rule', async () => {
    const service = makeService({
      default: {
        cancellationMethod: CancellationMethod.PRO_RATA,
        tiraEndorsementType: 33,
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
      tiraEndorsementType: 33,
      cancellationCharge: '25000',
      requireApproval: true,
    });
  });
});
