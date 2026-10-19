import { TiramisRequestType } from '../../tiramis/enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../../tiramis/enums/tiramis-submission-status.enum';
import { VerificationsService } from './verifications.service';

describe('VerificationsService', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;

  it('submits a fresh motor lookup after a previous lookup completed', async () => {
    const tiramisClient = {
      findLatestSubmissionForSameBusiness: jest.fn().mockResolvedValue({
        id: 'tracking-1',
        status: TiramisSubmissionStatus.FINAL_SUCCESS,
        tiramisRequestId: 'request-1',
        submittedAt: new Date(),
      }),
      submit: jest.fn().mockResolvedValue({
        success: true,
        tracking: { status: TiramisSubmissionStatus.PENDING },
      }),
    };
    const tiramisStatusSync = { syncOne: jest.fn() };
    const service = new VerificationsService(
      tiramisClient as any,
      tiramisStatusSync as any,
    );

    await service.verifyMotor(user, {
      motorCategory: 1,
      motorRegistrationNumber: 'T353DKA',
    });

    expect(tiramisClient.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: TiramisRequestType.MOTOR_VERIFICATION,
        forceResubmit: true,
        returnExisting: false,
      }),
      user,
    );
    expect(tiramisStatusSync.syncOne).not.toHaveBeenCalled();
  });

  it('keeps an active pending motor lookup idempotent', async () => {
    const tiramisClient = {
      findLatestSubmissionForSameBusiness: jest.fn().mockResolvedValue({
        id: 'tracking-1',
        status: TiramisSubmissionStatus.PENDING,
        tiramisRequestId: 'request-1',
        submittedAt: new Date(),
      }),
      submit: jest.fn().mockResolvedValue({
        success: true,
        tracking: { status: TiramisSubmissionStatus.PENDING },
      }),
    };
    const service = new VerificationsService(
      tiramisClient as any,
      { syncOne: jest.fn() } as any,
    );

    await service.verifyMotor(user, {
      motorCategory: 1,
      motorRegistrationNumber: 'T353DKA',
    });

    expect(tiramisClient.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: TiramisRequestType.MOTOR_VERIFICATION,
        forceResubmit: false,
        returnExisting: true,
      }),
      user,
    );
  });
});
