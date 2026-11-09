import { DataSource } from 'typeorm';
import { Quotation } from '../entities/quotation.entity';
import { QuotationStatusHistory } from '../entities/quotation-status-history.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { QuotationStatus } from '../enums/quotation-status.enum';
import { TiraStatus } from '../enums/tira-status.enum';
import { QuotationLifecycleService } from './quotation-lifecycle.service';

/** D3/D3a: a premium change sends approval and payment back to the start. */
describe('QuotationLifecycleService.resetAfterPremiumChange', () => {
  function createFixture(overrides: Partial<Quotation>) {
    const quotation = {
      id: 'quotation-1',
      company_id: 'company-1',
      status: QuotationStatus.READY_FOR_SUBMISSION,
      requires_approval: true,
      requires_payment: true,
      approval_status: ApprovalStatus.APPROVED,
      approval_submitted_by: 'maker',
      approval_submitted_at: new Date(),
      approval_decided_by: 'checker',
      approval_decided_at: new Date(),
      approval_comments: 'ok',
      approval_reason: null,
      payment_status: PaymentStatus.REQUESTED,
      payment_request_reference: 'INV-1',
      payment_requested_at: new Date(),
      payment_failure_reason: null,
      tira_status: TiraStatus.NOT_SUBMITTED,
      updated_by: null,
      ...overrides,
    } as unknown as Quotation;

    const historyRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === QuotationStatusHistory
          ? historyRepository
          : {
              createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(quotation),
              })),
              save: jest.fn().mockImplementation(async (value) => value),
            },
      ),
    };
    const dataSource = {
      transaction: jest.fn(async (handler: any) => handler(manager)),
    } as unknown as DataSource;

    return {
      quotation,
      historyRepository,
      service: new QuotationLifecycleService(dataSource, {} as any, {} as any),
    };
  }

  it('returns an approved, payment-requested quotation to resubmission', async () => {
    const fixture = createFixture({});

    await fixture.service.resetAfterPremiumChange('company-1', 'quotation-1', {
      changedBy: 'user-1',
      reason: 'Premium changed from 100.00 to 120.00',
    });

    expect(fixture.quotation.approval_status).toBe(
      ApprovalStatus.NOT_SUBMITTED,
    );
    expect(fixture.quotation.approval_decided_by).toBeNull();
    expect(fixture.quotation.payment_status).toBe(PaymentStatus.NOT_INITIATED);
    expect(fixture.quotation.payment_request_reference).toBeNull();
    expect(fixture.quotation.status).toBe(QuotationStatus.PENDING_REQUIREMENTS);
    expect(fixture.historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transition_type: 'PREMIUM_CHANGED_RESET',
        previous_approval_status: ApprovalStatus.APPROVED,
        new_approval_status: ApprovalStatus.NOT_SUBMITTED,
        previous_payment_status: PaymentStatus.REQUESTED,
        new_payment_status: PaymentStatus.NOT_INITIATED,
      }),
    );
  });

  it('resets a pending approval', async () => {
    const fixture = createFixture({
      approval_status: ApprovalStatus.PENDING,
      payment_status: PaymentStatus.NOT_INITIATED,
      status: QuotationStatus.PENDING_REQUIREMENTS,
    });

    await fixture.service.resetAfterPremiumChange('company-1', 'quotation-1');

    expect(fixture.quotation.approval_status).toBe(
      ApprovalStatus.NOT_SUBMITTED,
    );
  });

  it('leaves rejected approvals and paid payments alone', async () => {
    const fixture = createFixture({
      approval_status: ApprovalStatus.REJECTED,
      payment_status: PaymentStatus.PAID,
      status: QuotationStatus.REJECTED,
    });

    await fixture.service.resetAfterPremiumChange('company-1', 'quotation-1');

    expect(fixture.quotation.approval_status).toBe(ApprovalStatus.REJECTED);
    expect(fixture.quotation.payment_status).toBe(PaymentStatus.PAID);
  });

  it('records nothing when there is nothing to reset', async () => {
    const fixture = createFixture({
      requires_approval: false,
      approval_status: ApprovalStatus.NOT_REQUIRED,
      requires_payment: false,
      payment_status: PaymentStatus.NOT_REQUIRED,
    });

    await fixture.service.resetAfterPremiumChange('company-1', 'quotation-1');

    expect(fixture.historyRepository.save).not.toHaveBeenCalled();
  });
});
