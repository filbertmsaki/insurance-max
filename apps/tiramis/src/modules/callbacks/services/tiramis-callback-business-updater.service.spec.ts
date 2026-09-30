import { TiramisCallbackBusinessUpdaterService } from './tiramis-callback-business-updater.service';

describe('TiramisCallbackBusinessUpdaterService', () => {
  const claimRepository = { markFinalResponseByRequestId: jest.fn() };
  const dischargeVoucherRepository = {
    markFinalResponseByRequestId: jest.fn(),
  };
  const service = new TiramisCallbackBusinessUpdaterService(
    {} as any,
    {} as any,
    claimRepository as any,
    dischargeVoucherRepository as any,
  );

  const response = (rootElement: string) =>
    ({
      rootElement,
      requestId: 'AIC-2',
      responseId: 'RES-1',
      responseStatusCode: 'TIRA001',
      responseStatusDesc: 'Successful',
      claimReferenceNumber: 'CLM-REF-9',
      payload: {},
    }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('routes DischargeVoucherRes to the voucher table, not tiramis_claims', async () => {
    await service.updateBusinessRecord(response('DischargeVoucherRes'), {
      transactionId: 'txn-1',
    });

    expect(
      dischargeVoucherRepository.markFinalResponseByRequestId,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'AIC-2', transactionId: 'txn-1' }),
    );
    expect(claimRepository.markFinalResponseByRequestId).not.toHaveBeenCalled();
  });

  it('passes the claim reference and transaction for notification responses', async () => {
    await service.updateBusinessRecord(response('ClaimNotificationRefRes'), {
      transactionId: 'txn-1',
    });

    expect(claimRepository.markFinalResponseByRequestId).toHaveBeenCalledWith(
      expect.objectContaining({
        claimReferenceNumber: 'CLM-REF-9',
        transactionId: 'txn-1',
      }),
    );
  });
});
