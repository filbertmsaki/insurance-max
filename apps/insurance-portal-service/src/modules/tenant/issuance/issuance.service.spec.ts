import { IssuanceService } from './issuance.service';

describe('IssuanceService - final TIRAMIS success gate', () => {
  function createService() {
    return new IssuanceService(
      {
        transaction: jest.fn(),
      } as any,
      {
        hashDefinition: jest.fn(() => 'hash'),
      } as any,
      {
        generateForPolicy: jest.fn(),
      } as any,
    );
  }

  const regulatoryResponse = {
    success: true,
    requestType: 'MOTOR',
    requestId: 'REQ-1',
    responseId: 'RESP-1',
    transactionId: 'TX-1',
    statusCode: '0',
    statusDescription: 'Success',
    responseRoot: 'MotorCoverNoteResponse',
    coverNotes: [],
  } as any;

  it('does not create policy from intermediate successful response', async () => {
    const service = createService();

    const issueSpy = jest
      .spyOn(service as any, 'applyCoverNoteIssuance')
      .mockResolvedValue({
        policy: null,
      });

    const result = await service.applyNotification(
      {
        status: 'WAITING_FINAL_RESPONSE',
        request_type: 'MOTOR',
      } as any,
      {
        eventType: 'TIRAMIS_FINAL_RESPONSE_RECEIVED',
        regulatoryResponse,
      } as any,
    );

    expect(result).toBeNull();
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('creates policy only after final successful TIRAMIS event', async () => {
    const service = createService();

    const expected = {
      policy: {
        id: 'policy-1',
      },
    };

    const issueSpy = jest
      .spyOn(service as any, 'applyCoverNoteIssuance')
      .mockResolvedValue(expected);

    const result = await service.applyNotification(
      {
        status: 'COMPLETED',
        request_type: 'MOTOR',
      } as any,
      {
        eventType: 'TIRAMIS_FINAL_SUCCESS',
        regulatoryResponse,
      } as any,
    );

    expect(result).toBe(expected);
    expect(issueSpy).toHaveBeenCalledTimes(1);
  });
});
