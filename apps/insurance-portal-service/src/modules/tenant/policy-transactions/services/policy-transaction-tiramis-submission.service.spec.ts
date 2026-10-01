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
    source_policy_version_no: 1,
    effective_date: '2026-09-28',
    source_policy_snapshot_hash: 'source-hash',
    proposed_policy_snapshot_hash: 'proposed-hash',
    pricing_snapshot_hash: 'pricing-hash',
    premium_effect: 'NONE',
    additional_premium: '0.0000',
    return_premium: '0.0000',
    approval_status: 'APPROVED',
    payment_status: 'NOT_REQUIRED',
    submission_status: 'READY',
  };
  const cancellation = {
    policy_transaction_id: 'txn-1',
    previous_cover_note_reference: '11026-27176-67612',
    tira_endorsement_type: 4,
  };
  const policy = {
    id: 'policy-1',
    policy_no: 'POL-1',
    quotation_id: 'quotation-1',
    branch_id: 'branch-1',
  };
  const quotation = { id: 'quotation-1', company_id: 'company-1' };
  const sourceVersion = {
    id: 'version-1',
    company_id: 'company-1',
  };

  function makeService(submitAnyBusinessRecord: jest.Mock) {
    const transactionQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(transaction),
    };
    const transactionRepository = {
      findOne: jest.fn().mockResolvedValue(transaction),
      save: jest.fn().mockResolvedValue(transaction),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(transactionQueryBuilder),
    };
    const endorsementRepository = { findOne: jest.fn() };
    const cancellationRepository = {
      findOne: jest.fn().mockResolvedValue(cancellation),
    };
    const policyRepository = { findOne: jest.fn().mockResolvedValue(policy) };
    const policyVersionRepository = {
      findOne: jest.fn().mockResolvedValue(sourceVersion),
    };
    const transactionManager = {};
    const quotationRepository = {
      manager: {
        transaction: jest.fn((work: (manager: unknown) => unknown) =>
          work(transactionManager),
        ),
      },
      findOne: jest.fn().mockResolvedValue(quotation),
    };
    const payloadService = {
      buildCancellationPayload: jest.fn().mockResolvedValue({}),
    };
    const quotationFactory = {
      createTransactionDraft: jest.fn(),
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
    const dataAccessScopeService = {
      resolve: jest.fn().mockReturnValue({ companyId: 'company-1' }),
      applyPolicyReadScope: jest.fn(),
    };
    const tiramisBusinessSubmitService = { submitAnyBusinessRecord };

    const service = new PolicyTransactionTiramisSubmissionService(
      transactionRepository as any,
      endorsementRepository as any,
      cancellationRepository as any,
      policyRepository as any,
      policyVersionRepository as any,
      quotationRepository as any,
      payloadService as any,
      quotationFactory as any,
      serviceContextService as any,
      lifecycleService as any,
      dataAccessScopeService as any,
      tiramisBusinessSubmitService as any,
    );

    return {
      service,
      lifecycleService,
      transactionRepository,
      serviceContextService,
      quotationFactory,
      quotationRepository,
      transactionManager,
      tiramisBusinessSubmitService,
    };
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

  it('persists the TIRAMIS tracking transaction/request ids on success', async () => {
    const result = {
      localTrackingId: 'tracking-1',
      tracking: {
        tiramisTransactionId: 'tt-1',
        tiramisRequestId: 'tr-1',
      },
    };
    const { service, lifecycleService, transactionRepository } = makeService(
      jest.fn().mockResolvedValue(result),
    );

    const actual = await service.submitCancellation(user, 'txn-1');

    expect(actual).toBe(result);
    expect(lifecycleService.markSubmissionFailed).not.toHaveBeenCalled();
    expect(transactionRepository.update).toHaveBeenCalledWith(
      { id: 'txn-1', company_id: 'company-1' },
      {
        tiramis_tracking_id: 'tracking-1',
        tiramis_transaction_id: 'tt-1',
        tiramis_request_id: 'tr-1',
      },
    );
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('builds signed service contexts from the originating quotation and submits via the business Tiramis path', async () => {
    const submitAnyBusinessRecord = jest.fn().mockResolvedValue({
      localTrackingId: 'tracking-1',
      tracking: {
        id: 'tracking-1',
        tiramisTransactionId: 'tt-1',
        tiramisRequestId: 'tr-1',
      },
      tiramis: {
        tiramis_transaction_id: 'tt-1',
        tiramis_request_id: 'tr-1',
      },
    });
    const { service, serviceContextService } = makeService(
      submitAnyBusinessRecord,
    );

    await service.submitCancellation(user, 'txn-1');

    expect(serviceContextService.build).toHaveBeenCalledWith(
      'company-1',
      quotation,
      {},
    );
    expect(submitAnyBusinessRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModule: 'policy-transactions',
        sourceRecordId: 'txn-1',
        policyId: 'policy-1',
        productContext: undefined,
        pricingContext: undefined,
        insuredDataContext: {},
        quotationGateContext: {},
        policyTransactionContext: expect.objectContaining({
          transactionId: 'txn-1',
          transactionNumber: 'AICL-CXL-1',
          sourcePolicyId: 'policy-1',
          sourcePolicyNumber: 'POL-1',
        }),
      }),
    );
  });

  it('creates the related policy-transaction quotation before manual cancellation submit when missing', async () => {
    const submitAnyBusinessRecord = jest.fn().mockResolvedValue({
      localTrackingId: 'tracking-1',
      tracking: {
        id: 'tracking-1',
        tiramisTransactionId: 'tt-1',
        tiramisRequestId: 'tr-1',
      },
    });
    const {
      service,
      quotationFactory,
      quotationRepository,
      transactionManager,
    } = makeService(submitAnyBusinessRecord);
    quotationRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(quotation);

    await service.submitCancellation(user, 'txn-1');

    expect(quotationRepository.manager.transaction).toHaveBeenCalled();
    expect(quotationFactory.createTransactionDraft).toHaveBeenCalledWith(
      transactionManager,
      user,
      expect.objectContaining({
        policy,
        transaction,
        previousCoverNoteReference: '11026-27176-67612',
        recordOnly: true,
      }),
    );
  });

  it('refuses to submit when the source policy has no originating quotation', async () => {
    const { service, lifecycleService } = makeService(jest.fn());
    const policyRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'policy-1', quotation_id: null }),
    };
    (service as any).policyRepository = policyRepository;

    await expect(service.submitCancellation(user, 'txn-1')).rejects.toThrow(
      'The source policy has no originating quotation on record',
    );
    expect(lifecycleService.startSubmission).not.toHaveBeenCalled();
  });
});
