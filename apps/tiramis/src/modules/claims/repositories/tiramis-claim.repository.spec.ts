import { TiramisClaimRepository } from './tiramis-claim.repository';

describe('TiramisClaimRepository.markFinalResponseByRequestId', () => {
  function build(affectedByRequestId: number) {
    const repository = {
      update: jest
        .fn()
        .mockResolvedValueOnce({ affected: affectedByRequestId })
        .mockResolvedValueOnce({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 'claim-row' }),
    };

    return { repository, service: new TiramisClaimRepository(repository as any) };
  }

  const params = {
    requestId: 'AIC-RETRY',
    responseId: 'RES-1',
    statusCode: 'TIRA001',
    statusDesc: 'Successful',
    payload: {},
    claimReferenceNumber: 'CLM-REF-1',
    transactionId: 'txn-1',
  };

  it('updates by request id when it matches', async () => {
    const { repository, service } = build(1);

    await service.markFinalResponseByRequestId(params);

    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('falls back to the transaction and relinks the row after a retry', async () => {
    const { repository, service } = build(0);

    await service.markFinalResponseByRequestId(params);

    expect(repository.update).toHaveBeenLastCalledWith(
      { transactionId: 'txn-1' },
      expect.objectContaining({
        requestId: 'AIC-RETRY',
        claimReferenceNumber: 'CLM-REF-1',
      }),
    );
  });
});
