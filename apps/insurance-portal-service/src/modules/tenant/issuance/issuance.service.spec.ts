import { IssuanceService } from './issuance.service';
import * as numbering from '../policies/utils/policy-number';

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

  it.each(['TIRAMIS_FINAL_SUCCESS', 'TIRAMIS_RESPONSE_ACK_SENT'])(
    'routes transaction callbacks away from new issuance: %s',
    async (eventType) => {
      const service = createService();
      const issue = jest.spyOn(service as any, 'applyCoverNoteIssuance');
      expect(
        await service.applyNotification(
          { source_module: 'policy-transactions', status: 'COMPLETED' } as any,
          { eventType, regulatoryResponse } as any,
        ),
      ).toBeNull();
      expect(issue).not.toHaveBeenCalled();
    },
  );

  it.each([null, new Date('2026-10-15Z')])(
    'reuses an existing historical or deleted policy on callbacks without allocating',
    async (deleted_at) => {
      const service = createService();
      const next = jest.spyOn(numbering, 'nextPolicyNo');
      const policy = {
        id: 'policy-1',
        policy_no: 'HISTORICAL-123',
        policy_sequence: null,
        deleted_at,
        active_version_id: 'version-1',
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue(policy),
        save: jest.fn(async (value) => value),
      };
      const manager = { getRepository: () => repository, query: jest.fn() };
      jest
        .spyOn(service as any, 'createPolicyVersion')
        .mockResolvedValue({ id: 'version-1', version_number: 1 });
      jest
        .spyOn(service as any, 'linkPolicyToCoverNotes')
        .mockResolvedValue(undefined);
      try {
        for (let i = 0; i < 2; i += 1) {
          const result = await (service as any).createOrReuseIssuedPolicy(
            manager,
            {},
            { id: 'tracking-1' },
            {
              id: 'quotation-1',
              company_id: 'company-1',
              workflow_revision: 1,
            },
            regulatoryResponse,
            [],
          );
          expect(result.policy_no).toBe('HISTORICAL-123');
        }
        expect(repository.findOne).toHaveBeenCalledWith(
          expect.objectContaining({ withDeleted: true }),
        );
        expect(next).not.toHaveBeenCalled();
        expect(manager.query).not.toHaveBeenCalled();
      } finally {
        next.mockRestore();
      }
    },
  );
});
