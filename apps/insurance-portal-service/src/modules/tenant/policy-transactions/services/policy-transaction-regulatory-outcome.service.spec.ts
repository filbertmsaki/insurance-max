import {
  PolicyTransactionType,
  QuotationStage,
} from '@insurance-max/contracts';

import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { PortalTiraSubmission } from '../../tiramis-integration/entities/portal-tira-submission.entity';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { QuotationStatusHistory } from '../../quotations/entities/quotation-status-history.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationStatus } from '../../quotations/enums/quotation-status.enum';
import { TiraStatus } from '../../quotations/enums/tira-status.enum';
import { PolicyTransactionRegulatoryOutcomeService } from './policy-transaction-regulatory-outcome.service';

describe('PolicyTransactionRegulatoryOutcomeService', () => {
  it('syncs a successful cancellation callback onto the related quotation and history', async () => {
    const transaction = {
      id: 'txn-1',
      company_id: 'company-1',
      transaction_type: PolicyTransactionType.CANCELLATION,
      source_policy_id: 'policy-1',
      source_policy_version_id: 'version-1',
      requested_by: 'user-1',
      completed_by: 'user-2',
      tiramis_tracking_id: null,
      tiramis_transaction_id: null,
      tiramis_request_id: null,
      regulatory_response: null,
      regulatory_response_hash: null,
      last_command: null,
    };
    const cancellation = {
      company_id: 'company-1',
      policy_transaction_id: 'txn-1',
      previous_cover_note_reference: 'old-cover-note',
      cancellation_cover_note_reference: null,
    };
    const quotation = {
      id: 'quote-1',
      company_id: 'company-1',
      status: QuotationStatus.SUBMITTED_TO_TIRA,
      quotation_stage: QuotationStage.DRAFT,
      approval_status: null,
      payment_status: null,
      tira_status: TiraStatus.SUBMITTED,
      tira_request_id: null,
      tira_response_id: null,
      tira_response_code: null,
      tira_response_description: null,
      tira_error_details: null,
      submitted_at: null,
      workflow_completed_at: null,
      workflow_revision: 1,
      state_version: 1,
      updated_by: null,
      channel_type: 'AGENT',
    };
    const submission = {
      id: 'submission-1',
      quotation_id: null,
      cover_note_reference_number: null,
      sticker_number: null,
      tiramis_request_id: 'request-portal',
      tiramis_transaction_id: 'transaction-portal',
      tiramis_response_id: null,
      status_code: null,
      status_description: null,
      last_payload: null,
      completed_at: null,
      last_event_at: null,
    };
    const tracking = {
      id: 'tracking-1',
      quotationId: null,
      tiramisResponsePayload: { existing: true },
      finalResponsePayload: { final: true },
    };
    const payload = {
      eventType: 'tiramis.final-response.received',
      tiramisTransactionId: 'tiramis-transaction-1',
      requestId: 'request-1',
      responseId: 'response-1',
      statusCode: 'TIRA214',
      statusDescription: 'Transaction successfully cancelled',
      coverNoteReferenceNumber: '11026-27176-67612',
      stickerNumber: '26001-27194-88212',
      occurredAt: '2026-09-28T13:00:00.000Z',
      regulatoryResponse: {
        transactionId: 'tiramis-transaction-1',
        requestId: 'request-1',
        responseId: 'response-1',
        requestType: 'CoverNoteEndorsement',
        responseRoot: 'MotorCoverNoteRefRes',
        success: true,
        statusCode: 'TIRA214',
        statusDescription: 'Transaction successfully cancelled',
        coverNotes: [
          {
            sourceCoverNoteNumber: 'old-cover-note',
            quotationEntryId: null,
            fleetEntry: null,
            coverNoteReferenceNumber: '11026-27176-67612',
            stickerNumber: '26001-27194-88212',
            registrationNumber: null,
            chassisNumber: null,
          },
        ],
        policy: null,
        signatureVerified: true,
        responsePayloadHash: 'response-hash',
        receivedAt: '2026-09-28T13:00:00.000Z',
      },
    };

    const transactionQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(transaction),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(transactionQueryBuilder),
      save: jest.fn().mockResolvedValue(transaction),
    };
    const endorsementRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const cancellationRepository = {
      findOne: jest.fn().mockResolvedValue(cancellation),
      save: jest.fn().mockResolvedValue(cancellation),
    };
    const quotationRepository = {
      findOne: jest.fn().mockResolvedValue(quotation),
      save: jest.fn().mockResolvedValue(quotation),
    };
    const submissionRepository = {
      save: jest.fn().mockResolvedValue(submission),
    };
    const trackingRepository = {
      save: jest.fn().mockResolvedValue(tracking),
    };
    const historyRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const repositories = new Map<unknown, unknown>([
      [PolicyTransaction, transactionRepository],
      [PolicyEndorsement, endorsementRepository],
      [PolicyCancellation, cancellationRepository],
      [Quotation, quotationRepository],
      [PortalTiraSubmission, submissionRepository],
      [TiramisSubmissionTrackingEntity, trackingRepository],
      [QuotationStatusHistory, historyRepository],
    ]);
    const manager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const quotationFactory = {
      createTransactionDraft: jest.fn(),
    };
    const service = new PolicyTransactionRegulatoryOutcomeService(
      dataSource as any,
      quotationFactory as any,
    );

    await service.captureFinalSuccess(
      'company-1',
      'txn-1',
      submission as any,
      payload,
      tracking as any,
    );

    expect(quotationFactory.createTransactionDraft).not.toHaveBeenCalled();
    expect(cancellationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellation_cover_note_reference: '11026-27176-67612',
      }),
    );
    expect(submissionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation_id: 'quote-1',
        cover_note_reference_number: '11026-27176-67612',
        sticker_number: '26001-27194-88212',
        tiramis_response_id: 'response-1',
        status_code: 'TIRA214',
        status_description: 'Transaction successfully cancelled',
      }),
    );
    expect(trackingRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quotationId: 'quote-1',
        tiramisResponsePayload: expect.objectContaining({
          existing: true,
          coverNoteReferenceNumber: '11026-27176-67612',
          stickerNumber: '26001-27194-88212',
        }),
      }),
    );
    expect(quotationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: QuotationStatus.COMPLETED,
        quotation_stage: QuotationStage.COMPLETED,
        tira_status: TiraStatus.CANCELLED,
        tira_request_id: 'request-1',
        tira_response_id: 'response-1',
        tira_response_code: 'TIRA214',
        tira_response_description: 'Transaction successfully cancelled',
      }),
    );
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        quotation_id: 'quote-1',
        previous_quotation_status: QuotationStatus.SUBMITTED_TO_TIRA,
        new_quotation_status: QuotationStatus.COMPLETED,
        previous_tira_status: TiraStatus.SUBMITTED,
        new_tira_status: TiraStatus.CANCELLED,
        transition_type: 'TIRAMIS_FINAL_SUCCESS',
        source: 'TIRAMIS',
        tira_request_id: 'request-1',
        tira_response_id: 'response-1',
        metadata: expect.objectContaining({
          transactionId: 'txn-1',
          coverNoteReferenceNumber: '11026-27176-67612',
          stickerNumber: '26001-27194-88212',
        }),
      }),
    );
  });

  it('marks a successful endorsement callback quotation as endorsed in TIRAMIS status', async () => {
    const transaction = {
      id: 'txn-endorsement-1',
      company_id: 'company-1',
      transaction_type: PolicyTransactionType.ENDORSEMENT,
      source_policy_id: 'policy-1',
      source_policy_version_id: 'version-1',
      requested_by: 'user-1',
      completed_by: 'user-2',
      tiramis_tracking_id: null,
      tiramis_transaction_id: null,
      tiramis_request_id: null,
      regulatory_response: null,
      regulatory_response_hash: null,
      last_command: null,
    };
    const endorsement = {
      company_id: 'company-1',
      policy_transaction_id: 'txn-endorsement-1',
      requires_new_cover_note: true,
      previous_cover_note_reference: 'old-cover-note',
      replacement_cover_note_reference: null,
      replacement_sticker_number: null,
    };
    const quotation = {
      id: 'quote-endorsement-1',
      company_id: 'company-1',
      status: QuotationStatus.SUBMITTED_TO_TIRA,
      quotation_stage: QuotationStage.DRAFT,
      approval_status: null,
      payment_status: null,
      tira_status: TiraStatus.SUBMITTED,
      tira_request_id: null,
      tira_response_id: null,
      tira_response_code: null,
      tira_response_description: null,
      tira_error_details: null,
      submitted_at: null,
      workflow_completed_at: null,
      workflow_revision: 1,
      state_version: 1,
      updated_by: null,
      channel_type: 'AGENT',
    };
    const submission = {
      id: 'submission-endorsement-1',
      quotation_id: null,
      cover_note_reference_number: null,
      sticker_number: null,
      tiramis_request_id: 'request-portal',
      tiramis_transaction_id: 'transaction-portal',
      tiramis_response_id: null,
      status_code: null,
      status_description: null,
      last_payload: null,
      completed_at: null,
      last_event_at: null,
    };
    const payload = {
      eventType: 'tiramis.final-response.received',
      tiramisTransactionId: 'tiramis-transaction-1',
      requestId: 'request-1',
      responseId: 'response-1',
      statusCode: 'TIRA001',
      statusDescription: 'successful',
      coverNoteReferenceNumber: '11026-27176-67613',
      stickerNumber: '26001-27194-88213',
      occurredAt: '2026-09-28T13:00:00.000Z',
      regulatoryResponse: {
        transactionId: 'tiramis-transaction-1',
        requestId: 'request-1',
        responseId: 'response-1',
        requestType: 'CoverNoteEndorsement',
        responseRoot: 'MotorCoverNoteRefRes',
        success: true,
        statusCode: 'TIRA001',
        statusDescription: 'successful',
        coverNotes: [
          {
            sourceCoverNoteNumber: 'old-cover-note',
            quotationEntryId: null,
            fleetEntry: null,
            coverNoteReferenceNumber: '11026-27176-67613',
            stickerNumber: '26001-27194-88213',
            registrationNumber: null,
            chassisNumber: null,
          },
        ],
        policy: null,
        signatureVerified: true,
        responsePayloadHash: 'response-hash',
        receivedAt: '2026-09-28T13:00:00.000Z',
      },
    };

    const transactionQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(transaction),
    };
    const transactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(transactionQueryBuilder),
      save: jest.fn().mockResolvedValue(transaction),
    };
    const endorsementRepository = {
      findOne: jest.fn().mockResolvedValue(endorsement),
      save: jest.fn().mockResolvedValue(endorsement),
    };
    const cancellationRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const quotationRepository = {
      findOne: jest.fn().mockResolvedValue(quotation),
      save: jest.fn().mockResolvedValue(quotation),
    };
    const repositories = new Map<unknown, unknown>([
      [PolicyTransaction, transactionRepository],
      [PolicyEndorsement, endorsementRepository],
      [PolicyCancellation, cancellationRepository],
      [Quotation, quotationRepository],
      [PortalTiraSubmission, { save: jest.fn() }],
      [TiramisSubmissionTrackingEntity, { save: jest.fn() }],
      [QuotationStatusHistory, { save: jest.fn() }],
    ]);
    const manager = {
      getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new PolicyTransactionRegulatoryOutcomeService(
      dataSource as any,
      { createTransactionDraft: jest.fn() } as any,
    );

    await service.captureFinalSuccess(
      'company-1',
      'txn-endorsement-1',
      submission as any,
      payload,
      null,
    );

    expect(quotationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: QuotationStatus.COMPLETED,
        quotation_stage: QuotationStage.COMPLETED,
        tira_status: TiraStatus.ENDORSED,
      }),
    );
  });
});
