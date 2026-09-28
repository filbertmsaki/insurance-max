import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { PolicyTransactionApplyService } from '../../tenant/policy-transactions/services/policy-transaction-apply.service';
import { PolicyTransactionLifecycleService } from '../../tenant/policy-transactions/services/policy-transaction-lifecycle.service';
import { PolicyTransactionRegulatoryOutcomeService } from '../../tenant/policy-transactions/services/policy-transaction-regulatory-outcome.service';

describe('TiramisBusinessRecordSyncService', () => {
  it('extracts motor callback references from a completed attempt response XML', () => {
    const service = new TiramisBusinessRecordSyncService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = (service as any).extractRegulatoryResponse({
      tiramisResponsePayload: {
        attempts: [
          {
            payloads: {
              responseXml: `
                <TiraMsg>
                  <MotorCoverNoteRefRes>
                    <CoverNoteReferenceNumber>11026-19427-56213</CoverNoteReferenceNumber>
                    <StickerNumber>26001-19481-73513</StickerNumber>
                  </MotorCoverNoteRefRes>
                </TiraMsg>
              `,
            },
          },
        ],
      },
    });

    expect(result).toEqual({
      coverNotes: [
        {
          coverNoteReferenceNumber: '11026-19427-56213',
          stickerNumber: '26001-19481-73513',
        },
      ],
      policy: null,
    });
  });

  it('applies a successful cancellation when status sync sees final success', async () => {
    const transaction = {
      id: 'txn-1',
      company_id: 'company-1',
      transaction_type: 'CANCELLATION',
    };
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue(transaction),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    };
    const trackingRepository = {
      markBusinessRecordSynced: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = {
      logFromTracking: jest.fn().mockResolvedValue(undefined),
    };
    const notificationService = {
      notifyBusinessRecordSyncSuccess: jest.fn().mockResolvedValue(undefined),
    };
    const portalSubmissionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => ({ id: 'submission-1', ...input })),
      save: jest.fn(async (input) => input),
    };
    const lifecycleService = {
      markSubmissionAccepted: jest.fn().mockResolvedValue(undefined),
    };
    const applyService = {
      applyCancellation: jest.fn().mockResolvedValue(undefined),
      applyEndorsement: jest.fn().mockResolvedValue(undefined),
    };
    const regulatoryOutcomeService = {
      captureFinalSuccess: jest.fn().mockResolvedValue({ transaction }),
    };
    const moduleRef = {
      get: jest.fn((token) => {
        if (token === PolicyTransactionLifecycleService) {
          return lifecycleService;
        }
        if (token === PolicyTransactionApplyService) {
          return applyService;
        }
        if (token === PolicyTransactionRegulatoryOutcomeService) {
          return regulatoryOutcomeService;
        }
        throw new Error('Unexpected provider');
      }),
    };

    const service = new TiramisBusinessRecordSyncService(
      dataSource as any,
      trackingRepository as any,
      auditService as any,
      notificationService as any,
      {} as any,
      portalSubmissionRepository as any,
      moduleRef as any,
    );

    const result = await service.syncFromTracking({
      id: 'tracking-1',
      sourceCompanyId: 'company-1',
      sourceModule: 'policy-transactions',
      sourceRecordId: 'txn-1',
      businessReference: 'AICL-CXL-260928-00001',
      requestType: TiramisRequestType.MOTOR,
      status: TiramisSubmissionStatus.FINAL_SUCCESS,
      tiramisTransactionId: '00000000-0000-4000-8000-000000000001',
      tiramisRequestId: 'REQ-1',
      finalResponseId: 'RESP-1',
      finalResponseStatusCode: 'TIRA001',
      finalResponseStatusDesc: 'Transaction successfully cancelled',
      finalResponseReceivedAt: new Date('2026-09-28T12:00:00.000Z'),
      finalResponsePayload: {
        coverNotes: [
          {
            coverNoteReferenceNumber: '11026-27176-67612',
          },
        ],
      },
    } as any);

    expect(result).toMatchObject({
      synced: true,
      tableName: 'policy_transactions',
      sourceRecordId: 'txn-1',
      outcome: 'SUCCESS',
    });
    expect(regulatoryOutcomeService.captureFinalSuccess).toHaveBeenCalled();
    expect(lifecycleService.markSubmissionAccepted).toHaveBeenCalledWith(
      'company-1',
      'txn-1',
      expect.objectContaining({
        reason: 'Transaction successfully cancelled',
      }),
    );
    expect(applyService.applyCancellation).toHaveBeenCalledWith(
      'company-1',
      'txn-1',
    );
    expect(applyService.applyEndorsement).not.toHaveBeenCalled();
    expect(trackingRepository.markBusinessRecordSynced).toHaveBeenCalledWith(
      'tracking-1',
    );
  });
});
