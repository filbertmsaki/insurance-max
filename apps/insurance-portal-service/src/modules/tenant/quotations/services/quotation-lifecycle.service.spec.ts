import { DataSource } from 'typeorm';

import { Quotation } from '../entities/quotation.entity';
import { QuotationStatusHistory } from '../entities/quotation-status-history.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { QuotationLifecycleService } from './quotation-lifecycle.service';

describe('QuotationLifecycleService cancellation callbacks', () => {
  function createFixture(overrides?: Partial<Quotation>) {
    const quotation: Quotation = {
      id: 'quotation-1',
      company_id: 'company-1',
      status: QuotationStatus.TIRA_PROCESSING,
      approval_status: ApprovalStatus.NOT_REQUIRED,
      payment_status: PaymentStatus.NOT_REQUIRED,
      tira_status: TiraStatus.PROCESSING,
      updated_by: null,
      tira_request_id: null,
      tira_response_id: null,
      tira_response_code: null,
      tira_response_description: null,
      tira_error_details: null,
      ...overrides,
    } as Quotation;

    const quotationRepository = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(quotation),
      })),
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const historyRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Quotation) {
          return quotationRepository;
        }

        if (entity === QuotationStatusHistory) {
          return historyRepository;
        }

        throw new Error(`Unexpected repository request: ${String(entity)}`);
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (handler: any) => handler(manager)),
    } as unknown as DataSource;

    const service = new QuotationLifecycleService(
      dataSource,
      {} as any,
      {} as any,
    );

    return {
      quotation,
      quotationRepository,
      historyRepository,
      service,
    };
  }

  it('marks a successful cancellation callback as CANCELLED and stores callback audit metadata', async () => {
    const fixture = createFixture();

    await fixture.service.markTiraCancelled('company-1', 'quotation-1', {
      changedByType: 'SYSTEM',
      source: 'TIRAMIS',
      reason: 'Transaction successfully cancelled',
      requestId: 'REQ-1',
      tiraRequestId: 'REQ-1',
      tiraResponseId: 'RES-1',
      metadata: {
        statusCode: 'TIRA001',
        statusDescription: 'Transaction successfully cancelled',
        callbackTimestamp: '2026-07-24T10:00:00.000Z',
        callbackPayload: {
          requestId: 'REQ-1',
          responseId: 'RES-1',
        },
      },
    });

    expect(fixture.quotation.status).toBe(QuotationStatus.CANCELLED);
    expect(fixture.quotation.tira_status).toBe(TiraStatus.SUCCESS);
    expect(fixture.quotation.tira_response_code).toBe('TIRA001');
    expect(fixture.quotation.tira_response_description).toBe(
      'Transaction successfully cancelled',
    );
    expect(fixture.quotationRepository.save).toHaveBeenCalledTimes(1);
    expect(fixture.historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_quotation_status: QuotationStatus.TIRA_PROCESSING,
        new_quotation_status: QuotationStatus.CANCELLED,
        transition_type: 'MARK_TIRA_CANCELLED',
        request_id: 'REQ-1',
        tira_request_id: 'REQ-1',
        tira_response_id: 'RES-1',
        reason: 'Transaction successfully cancelled',
        metadata: expect.objectContaining({
          statusCode: 'TIRA001',
          statusDescription: 'Transaction successfully cancelled',
          callbackTimestamp: '2026-07-24T10:00:00.000Z',
        }),
      }),
    );
  });

  it('keeps a TIRA001 acknowledged quotation completed while awaiting callback', async () => {
    const fixture = createFixture();

    await fixture.service.markTiraAcknowledged('company-1', 'quotation-1', {
      changedByType: 'SYSTEM',
      source: 'TIRAMIS',
      reason: 'Final callback is overdue after 10 minutes',
      requestId: 'REQ-1',
      tiraRequestId: 'REQ-1',
      metadata: {
        statusCode: 'TIRA001',
        callbackStatus: 'OVERDUE',
      },
    });

    expect(fixture.quotation.status).toBe(QuotationStatus.COMPLETED);
    expect(fixture.quotation.tira_status).toBe(TiraStatus.SUBMITTED);
    expect(fixture.quotation.tira_request_id).toBe('REQ-1');
    expect(fixture.historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transition_type: 'MARK_TIRA_ACKNOWLEDGED',
        new_quotation_status: QuotationStatus.COMPLETED,
        new_tira_status: TiraStatus.SUBMITTED,
      }),
    );
  });

  it('ignores duplicate cancellation callbacks without creating another history row', async () => {
    const fixture = createFixture({
      status: QuotationStatus.CANCELLED,
      tira_status: TiraStatus.SUCCESS,
    });

    await fixture.service.markTiraCancelled('company-1', 'quotation-1', {
      reason: 'Transaction successfully cancelled',
      requestId: 'REQ-1',
      metadata: {
        statusCode: 'TIRA001',
        statusDescription: 'Transaction successfully cancelled',
      },
    });

    expect(fixture.quotationRepository.save).not.toHaveBeenCalled();
    expect(fixture.historyRepository.save).not.toHaveBeenCalled();
  });

  it('does not let a later generic success callback change a cancelled quotation back to COMPLETED', async () => {
    const fixture = createFixture({
      status: QuotationStatus.CANCELLED,
      tira_status: TiraStatus.SUCCESS,
    });

    await fixture.service.markTiraSuccessful('company-1', 'quotation-1', {
      reason: 'Successful',
      requestId: 'REQ-1',
      metadata: {
        statusCode: 'TIRA001',
        statusDescription: 'Successful',
      },
    });

    expect(fixture.quotation.status).toBe(QuotationStatus.CANCELLED);
    expect(fixture.quotationRepository.save).not.toHaveBeenCalled();
    expect(fixture.historyRepository.save).not.toHaveBeenCalled();
  });
});
