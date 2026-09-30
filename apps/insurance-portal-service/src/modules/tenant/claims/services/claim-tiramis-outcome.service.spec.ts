import { ClaimRegulatoryOperationType } from '@insurance-max/contracts';

import { TiramisRequestType } from '../../../tiramis/enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../../../tiramis/enums/tiramis-submission-status.enum';
import { ClaimRegulatoryStatus, ClaimStatus } from '../enums/claim.enums';
import { ClaimTiramisOutcomeService } from './claim-tiramis-outcome.service';

function harness(operation: any, claim: any) {
  const claimUpdates: any[] = [];
  const intimationUpdates: any[] = [];
  const builder = (value: any) => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(value),
    getOneOrFail: jest.fn().mockResolvedValue(value),
  });
  const manager = {
    getRepository: jest.fn((entity: any) => {
      switch (entity.name) {
        case 'ClaimRegulatoryOperation':
          return {
            createQueryBuilder: () => builder(operation),
            save: jest.fn(async (v) => v),
          };
        case 'InsuranceClaim':
          return {
            createQueryBuilder: () => builder(claim),
            update: jest.fn(async (_where, values) =>
              claimUpdates.push(values),
            ),
          };
        default:
          return {
            update: jest.fn(async (_where, values) =>
              intimationUpdates.push(values),
            ),
          };
      }
    }),
  };
  const dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) };
  const stateMachine = {
    transitionIfIn: jest.fn(
      async (_m, target, from: ClaimStatus[], to: ClaimStatus) => {
        if (!from.includes(target.status)) return false;
        target.status = to;
        return true;
      },
    ),
    recordEvent: jest.fn(),
  };
  const settlement = { settleIfComplete: jest.fn() };
  const notifications = { create: jest.fn() };
  const service = new ClaimTiramisOutcomeService(
    dataSource as any,
    stateMachine as any,
    settlement as any,
    notifications as any,
  );

  return {
    service,
    stateMachine,
    claimUpdates,
    intimationUpdates,
    settlement,
    notifications,
  };
}

function tracking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tracking-1',
    sourceModule: 'claims',
    sourceRecordId: 'claim-1',
    requestType: TiramisRequestType.CLAIM_NOTIFICATION,
    status: TiramisSubmissionStatus.FINAL_SUCCESS,
    finalResponseId: 'RES-1',
    finalResponseStatusCode: 'TIRA001',
    finalResponseStatusDesc: 'Successful',
    finalResponsePayload: {
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      claimReferenceNumber: 'TIRA-CLM-900',
    },
    ...overrides,
  } as any;
}

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    claim_id: 'claim-1',
    operation_type: ClaimRegulatoryOperationType.NOTIFICATION,
    source_record_id: 'claim-1',
    source_record_number: 'CLN-2026-00001',
    status: ClaimRegulatoryStatus.ACKNOWLEDGED,
    tiramis_tracking_id: null,
    final_response_code: null,
    ...overrides,
  } as any;
}

describe('ClaimTiramisOutcomeService', () => {
  it('stores the TIRA claim reference and accepts the notification', async () => {
    const claim = {
      id: 'claim-1',
      claim_reference_number: null,
      status: ClaimStatus.NOTIFICATION_SUBMITTED,
    } as any;
    const { service, claimUpdates } = harness(operation(), claim);

    const result = await service.applyFromTracking(tracking());

    expect(result.applied).toBe(true);
    expect(claimUpdates).toContainEqual({
      claim_reference_number: 'TIRA-CLM-900',
      tiramis_reference_locked: true,
    });
    expect(claim.status).toBe(ClaimStatus.NOTIFICATION_ACCEPTED);
  });

  it('ignores a duplicate callback once the operation is accepted', async () => {
    const claim = {
      id: 'claim-1',
      status: ClaimStatus.NOTIFICATION_ACCEPTED,
    } as any;
    const { service, stateMachine, claimUpdates } = harness(
      operation({ status: ClaimRegulatoryStatus.ACCEPTED }),
      claim,
    );

    const result = await service.applyFromTracking(tracking());

    expect(result).toEqual({ applied: false, reason: 'already_applied' });
    expect(claimUpdates).toHaveLength(0);
    expect(stateMachine.transitionIfIn).not.toHaveBeenCalled();
  });

  it('never overwrites an existing different claim reference', async () => {
    const claim = {
      id: 'claim-1',
      claim_reference_number: 'TIRA-CLM-OLD',
      status: ClaimStatus.NOTIFICATION_SUBMITTED,
    } as any;
    const op = operation();
    const { service, claimUpdates } = harness(op, claim);

    await service.applyFromTracking(tracking());

    expect(claimUpdates).toHaveLength(0);
    expect(op.status).toBe(ClaimRegulatoryStatus.RECONCILIATION_REQUIRED);
    expect(claim.status).toBe(ClaimStatus.NOTIFICATION_SUBMITTED);
  });

  it('moves a rejected notification to NOTIFICATION_FAILED', async () => {
    const claim = {
      id: 'claim-1',
      status: ClaimStatus.NOTIFICATION_SUBMITTED,
      assigned_user_id: 'u1',
    } as any;
    const { service, notifications } = harness(operation(), claim);

    await service.applyFromTracking(
      tracking({
        status: TiramisSubmissionStatus.FINAL_FAILED,
        finalResponseStatusCode: 'TIRA036',
        finalResponseStatusDesc: 'Invalid covernote reference number',
      }),
    );

    expect(claim.status).toBe(ClaimStatus.NOTIFICATION_FAILED);
    expect(notifications.create).toHaveBeenCalled();
  });

  it('marks an accepted intimation and moves the claim to INTIMATED', async () => {
    const claim = {
      id: 'claim-1',
      status: ClaimStatus.INTIMATION_SUBMITTED,
    } as any;
    const { service, intimationUpdates } = harness(
      operation({
        operation_type: ClaimRegulatoryOperationType.INTIMATION,
        source_record_id: 'int-1',
      }),
      claim,
    );

    await service.applyFromTracking(
      tracking({
        requestType: TiramisRequestType.CLAIM_INTIMATION,
        sourceRecordId: 'int-1',
      }),
    );

    expect(intimationUpdates).toContainEqual({ status: 'ACCEPTED' });
    expect(claim.status).toBe(ClaimStatus.INTIMATED);
  });

  it('tries to settle after TIRA accepts a payment', async () => {
    const claim = { id: 'claim-1', status: ClaimStatus.PAID } as any;
    const { service, settlement } = harness(
      operation({
        operation_type: ClaimRegulatoryOperationType.PAYMENT,
        source_record_id: 'pay-1',
      }),
      claim,
    );

    await service.applyFromTracking(
      tracking({
        requestType: TiramisRequestType.CLAIM_PAYMENT,
        sourceRecordId: 'pay-1',
      }),
    );

    expect(settlement.settleIfComplete).toHaveBeenCalledWith('claim-1');
  });

  it('finds the claim reference inside raw TIRA XML (status polling path)', () => {
    const { service } = harness(operation(), {});

    expect(
      service.extractClaimReference({
        finalResponsePayload: {
          responseXml:
            '<TiraMsg><ClaimNotificationRefRes><ClaimReferenceNumber>10020-25400-07720</ClaimReferenceNumber></ClaimNotificationRefRes></TiraMsg>',
        },
        tiramisResponsePayload: null,
      } as any),
    ).toBe('10020-25400-07720');
  });

  it('ignores non-claim trackings', async () => {
    const { service } = harness(operation(), {});

    expect(
      service.isClaimTracking({
        sourceModule: 'quotations',
        requestType: TiramisRequestType.MOTOR,
      } as any),
    ).toBe(false);
  });
});
