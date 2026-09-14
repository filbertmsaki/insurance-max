import { PolicyTransactionType } from '@insurance-max/contracts';
import { PolicyTransactionTiramisSubmissionService } from './policy-transaction-tiramis-submission.service';

describe('PolicyTransactionTiramisSubmissionService', () => {
  const user = { id: 'user-1', companyId: 'company-1' } as any;
  const transaction = {
    id: 'txn-1',
    company_id: 'company-1',
    transaction_type: PolicyTransactionType.CANCELLATION,
    transaction_no: 'AICL-CXL-1',
    source_policy_id: 'policy-1',
  };
  const cancellation = { policy_transaction_id: 'txn-1' };
  const policy = { id: 'policy-1', quotation_id: 'quotation-1' };
  const quotation = { id: 'quotation-1', company_id: 'company-1' };

  function makeService(submitToTiramis: jest.Mock) {
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue(transaction),
      save: jest.fn().mockResolvedValue(transaction),
    };
    const endorsementRepository = { findOne: jest.fn() };
    const cancellationRepository = {
      findOne: jest.fn().mockResolvedValue(cancellation),
    };
    const policyRepository = { findOne: jest.fn().mockResolvedValue(policy) };
    const quotationRepository = {
      findOne: jest.fn().mockResolvedValue(quotation),
    };
    const payloadService = {
      buildCancellationPayload: jest.fn().mockResolvedValue({}),
    };
    const serviceContextService = {
      build: jest.fn().mockResolvedValue({
        insuredData: {},
        quotationGate: {},
      }),
    };
    const lifecycleService = {
      canSubmit: jest.fn().mockReturnValue(true),
      startSubmission: jest.fn().mockResolvedValue(undefined),
      markSubmissionFailed: jest.fn().mockResolvedValue(undefined),
    };
    const tiramisIntegrationService = { submitToTiramis };

    const service = new PolicyTransactionTiramisSubmissionService(
      transactionRepository as any,
      endorsementRepository as any,
      cancellationRepository as any,
      policyRepository as any,
      quotationRepository as any,
      payloadService as any,
      serviceContextService as any,
      lifecycleService as any,
      tiramisIntegrationService as any,
    );

    return { service, lifecycleService, transactionRepository, serviceContextService };
  }

  it('marks the transaction submission-failed and rethrows when TIRAMIS rejects the request', async () => {
    const error = new Error('TIRAMIS HTTP request failed with status 403');
    const { service, lifecycleService, transactionRepository } = makeService(
      jest.fn().mockRejectedValue(error),
    );

    await expect(service.submitCancellation(user, 'txn-1')).rejects.toThrow(
      error,
    );

    expect(lifecycleService.markSubmissionFailed).toHaveBeenCalledWith(
      'company-1',
      'txn-1',
      expect.objectContaining({
        changedBy: 'user-1',
        reason: 'TIRAMIS HTTP request failed with status 403',
      }),
    );
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('persists the TIRAMIS transaction/request ids on success', async () => {
    const submission = {
      tiramis_transaction_id: 'tt-1',
      tiramis_request_id: 'tr-1',
    };
    const { service, lifecycleService, transactionRepository } = makeService(
      jest.fn().mockResolvedValue({ submission }),
    );

    const result = await service.submitCancellation(user, 'txn-1');

    expect(result).toBe(submission);
    expect(lifecycleService.markSubmissionFailed).not.toHaveBeenCalled();
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tiramis_transaction_id: 'tt-1',
        tiramis_request_id: 'tr-1',
      }),
    );
  });

  it('builds a signed service context from the originating quotation and threads it into the TIRAMIS submission', async () => {
    const submitToTiramis = jest
      .fn()
      .mockResolvedValue({ submission: { tiramis_transaction_id: 'tt-1', tiramis_request_id: 'tr-1' } });
    const { service, serviceContextService } = makeService(submitToTiramis);

    await service.submitCancellation(user, 'txn-1');

    expect(serviceContextService.build).toHaveBeenCalledWith(
      'company-1',
      quotation,
      {},
    );
    expect(submitToTiramis).toHaveBeenCalledWith(
      expect.objectContaining({
        dto: expect.objectContaining({
          serviceContext: { insuredData: {}, quotationGate: {} },
        }),
      }),
    );
  });

  it('refuses to submit when the source policy has no originating quotation', async () => {
    const { service, lifecycleService } = makeService(jest.fn());
    const policyRepository = { findOne: jest.fn().mockResolvedValue({ id: 'policy-1', quotation_id: null }) };
    (service as any).policyRepository = policyRepository;

    await expect(service.submitCancellation(user, 'txn-1')).rejects.toThrow(
      'The source policy has no originating quotation on record',
    );
    expect(lifecycleService.startSubmission).not.toHaveBeenCalled();
  });
});
