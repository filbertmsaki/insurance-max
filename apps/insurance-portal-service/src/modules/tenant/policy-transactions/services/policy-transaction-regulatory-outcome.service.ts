import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PolicyTransactionType,
  QuotationStage,
} from '@insurance-max/contracts';

import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisNotificationEventDto } from '../../tiramis-integration/dto/tiramis-notification-event.dto';
import { PortalTiraSubmission } from '../../tiramis-integration/entities/portal-tira-submission.entity';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { QuotationStatusHistory } from '../../quotations/entities/quotation-status-history.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationStatus } from '../../quotations/enums/quotation-status.enum';
import { TiraStatus } from '../../quotations/enums/tira-status.enum';
import { PolicyTransactionQuotationFactoryService } from './policy-transaction-quotation-factory.service';

@Injectable()
export class PolicyTransactionRegulatoryOutcomeService {
  private readonly logger = new Logger(
    PolicyTransactionRegulatoryOutcomeService.name,
  );

  constructor(
    private readonly dataSource: DataSource,
    private readonly quotationFactory: PolicyTransactionQuotationFactoryService,
  ) {}

  async captureFinalSuccess(
    companyId: string,
    transactionId: string,
    submission: PortalTiraSubmission,
    payload: TiramisNotificationEventDto,
    tracking: TiramisSubmissionTrackingEntity | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager
        .getRepository(PolicyTransaction)
        .createQueryBuilder('transaction')
        .setLock('pessimistic_write')
        .where('transaction.id = :transactionId', { transactionId })
        .andWhere('transaction.company_id = :companyId', { companyId })
        .getOne();

      if (!transaction) {
        throw new ConflictException(
          'Policy transaction could not be resolved.',
        );
      }

      const response = payload.regulatoryResponse;

      if (!response || response.success !== true) {
        throw new ConflictException(
          'A successful regulatory response is required before applying the policy transaction.',
        );
      }

      const replacement =
        payload.coverNoteReferenceNumber ??
        response.coverNotes?.[0]?.coverNoteReferenceNumber ??
        null;

      // Per the TIRAMIS spec, only normal endorsements return a new
      // StickerNumber (MotorCoverNoteRefRes) — cancellations do not, and
      // this is intentionally left null for those rather than treated as
      // a missing/invalid response.
      const replacementSticker =
        payload.stickerNumber ??
        response.coverNotes?.[0]?.stickerNumber ??
        null;

      const endorsement =
        transaction.transaction_type === PolicyTransactionType.ENDORSEMENT
          ? await manager.getRepository(PolicyEndorsement).findOne({
              where: {
                company_id: companyId,
                policy_transaction_id: transaction.id,
              },
            })
          : null;
      const cancellation =
        transaction.transaction_type === PolicyTransactionType.CANCELLATION
          ? await manager.getRepository(PolicyCancellation).findOne({
              where: {
                company_id: companyId,
                policy_transaction_id: transaction.id,
              },
            })
          : null;

      if (transaction.transaction_type === PolicyTransactionType.ENDORSEMENT) {
        if (!endorsement) {
          throw new ConflictException(
            'Endorsement record could not be resolved.',
          );
        }

        if (endorsement.requires_new_cover_note && !replacement) {
          throw new ConflictException(
            'TIRAMIS reported final success but did not return the required replacement cover-note reference.',
          );
        }
      }

      if (transaction.transaction_type === PolicyTransactionType.CANCELLATION) {
        if (!cancellation) {
          throw new ConflictException(
            'Cancellation record could not be resolved.',
          );
        }

        if (!replacement) {
          throw new ConflictException(
            'TIRAMIS reported final success but did not return the cancellation cover-note reference.',
          );
        }
      }

      transaction.tiramis_tracking_id =
        tracking?.id ?? transaction.tiramis_tracking_id;
      transaction.tiramis_transaction_id =
        payload.tiramisTransactionId ??
        submission.tiramis_transaction_id ??
        transaction.tiramis_transaction_id;
      transaction.tiramis_request_id =
        payload.requestId ??
        submission.tiramis_request_id ??
        transaction.tiramis_request_id;
      transaction.regulatory_response = response as unknown as Record<
        string,
        unknown
      >;
      transaction.regulatory_response_hash = response.responsePayloadHash;
      transaction.last_command = 'TIRAMIS_FINAL_SUCCESS';

      await manager.getRepository(PolicyTransaction).save(transaction);

      if (endorsement && replacement) {
        endorsement.replacement_cover_note_reference = replacement;
        if (replacementSticker) {
          endorsement.replacement_sticker_number = replacementSticker;
        }
        await manager.getRepository(PolicyEndorsement).save(endorsement);
      }

      if (cancellation && replacement) {
        cancellation.cancellation_cover_note_reference = replacement;
        await manager.getRepository(PolicyCancellation).save(cancellation);
      }

      const quotation = await this.ensureRelatedQuotation(
        manager,
        transaction,
        {
          endorsement,
          cancellation,
        },
      );
      await this.syncRelatedQuotationCallback(manager, {
        transaction,
        submission,
        payload,
        tracking,
        quotation,
        coverNoteReferenceNumber: replacement,
        stickerNumber: replacementSticker,
      });

      return {
        transaction,
        endorsement,
        cancellation,
        regulatoryResponse: response,
      };
    });
  }

  private async ensureRelatedQuotation(
    manager: import('typeorm').EntityManager,
    transaction: PolicyTransaction,
    params: {
      endorsement: PolicyEndorsement | null;
      cancellation: PolicyCancellation | null;
    },
  ): Promise<Quotation | null> {
    const existing = await manager.getRepository(Quotation).findOne({
      where: {
        company_id: transaction.company_id,
        source_policy_transaction_id: transaction.id,
      },
    });

    if (existing) {
      return existing;
    }

    const policy = await manager.getRepository(Policy).findOne({
      where: {
        id: transaction.source_policy_id,
        company_id: transaction.company_id,
      },
    });
    const version = await manager.getRepository(PolicyVersion).findOne({
      where: {
        id: transaction.source_policy_version_id,
        company_id: transaction.company_id,
      },
    });
    const previousCoverNoteReference =
      params.endorsement?.previous_cover_note_reference ??
      params.cancellation?.previous_cover_note_reference ??
      null;
    const endorsementType =
      params.endorsement?.tira_endorsement_type ??
      params.cancellation?.tira_endorsement_type ??
      null;

    if (
      !policy ||
      !version ||
      !previousCoverNoteReference ||
      !endorsementType
    ) {
      this.logger.warn(
        `Skipping related quotation backfill for policy transaction ${transaction.id}: missing policy/version/previous reference/type`,
      );
      return null;
    }

    try {
      return await this.quotationFactory.createTransactionDraft(
        manager,
        {
          id: transaction.completed_by ?? transaction.requested_by,
          companyId: transaction.company_id,
        } as any,
        {
          policy,
          version,
          transaction,
          previousCoverNoteReference,
          endorsementType: Number(endorsementType),
          endorsementReason: transaction.reason ?? '',
          recordOnly:
            transaction.transaction_type === PolicyTransactionType.CANCELLATION,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to backfill related quotation for policy transaction ${transaction.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async syncRelatedQuotationCallback(
    manager: import('typeorm').EntityManager,
    params: {
      transaction: PolicyTransaction;
      submission: PortalTiraSubmission;
      payload: TiramisNotificationEventDto;
      tracking: TiramisSubmissionTrackingEntity | null;
      quotation: Quotation | null;
      coverNoteReferenceNumber: string | null;
      stickerNumber: string | null;
    },
  ) {
    const quotation = params.quotation;

    if (!quotation) {
      return;
    }

    const statusCode =
      params.payload.statusCode ??
      params.payload.regulatoryResponse?.statusCode ??
      null;
    const statusDescription =
      params.payload.statusDescription ??
      params.payload.regulatoryResponse?.statusDescription ??
      null;
    const responseId =
      params.payload.responseId ??
      params.payload.regulatoryResponse?.responseId ??
      null;
    const requestId =
      params.payload.requestId ??
      params.payload.regulatoryResponse?.requestId ??
      params.transaction.tiramis_request_id ??
      null;
    const completedAt = params.payload.occurredAt
      ? new Date(params.payload.occurredAt)
      : new Date();
    const metadata = {
      source: 'POLICY_TRANSACTION_TIRAMIS_CALLBACK',
      transactionId: params.transaction.id,
      transactionType: params.transaction.transaction_type,
      trackingId: params.tracking?.id ?? params.transaction.tiramis_tracking_id,
      portalSubmissionId: params.submission.id,
      tiramisTransactionId:
        params.payload.tiramisTransactionId ??
        params.transaction.tiramis_transaction_id,
      coverNoteReferenceNumber: params.coverNoteReferenceNumber,
      stickerNumber: params.stickerNumber,
      regulatoryResponse: params.payload.regulatoryResponse ?? null,
    };

    params.submission.quotation_id = quotation.id;
    params.submission.cover_note_reference_number =
      params.coverNoteReferenceNumber ??
      params.submission.cover_note_reference_number;
    params.submission.sticker_number =
      params.stickerNumber ?? params.submission.sticker_number;
    params.submission.tiramis_response_id =
      responseId ?? params.submission.tiramis_response_id;
    params.submission.status_code = statusCode ?? params.submission.status_code;
    params.submission.status_description =
      statusDescription ?? params.submission.status_description;
    params.submission.last_payload =
      (params.tracking?.finalResponsePayload as Record<string, unknown>) ??
      (params.payload as unknown as Record<string, unknown>);
    params.submission.completed_at =
      params.submission.completed_at ?? completedAt;
    params.submission.last_event_at = completedAt;
    await manager.getRepository(PortalTiraSubmission).save(params.submission);

    if (params.tracking) {
      params.tracking.quotationId = quotation.id;
      params.tracking.tiramisResponsePayload = {
        ...(params.tracking.tiramisResponsePayload ?? {}),
        coverNoteReferenceNumber: params.coverNoteReferenceNumber,
        stickerNumber: params.stickerNumber,
      };
      await manager
        .getRepository(TiramisSubmissionTrackingEntity)
        .save(params.tracking);
    }

    const previousStatus = quotation.status;
    const previousTiraStatus = quotation.tira_status;

    quotation.status = QuotationStatus.COMPLETED;
    quotation.quotation_stage = QuotationStage.COMPLETED;
    quotation.tira_status = this.resolveTransactionQuotationTiraStatus(
      params.transaction,
    );
    quotation.tira_request_id = requestId ?? quotation.tira_request_id;
    quotation.tira_response_id = responseId ?? quotation.tira_response_id;
    quotation.tira_response_code = statusCode ?? quotation.tira_response_code;
    quotation.tira_response_description =
      statusDescription ?? quotation.tira_response_description;
    quotation.tira_error_details = metadata;
    quotation.submitted_at = quotation.submitted_at ?? completedAt;
    quotation.workflow_completed_at =
      quotation.workflow_completed_at ?? completedAt;
    quotation.workflow_revision = Number(quotation.workflow_revision ?? 0) + 1;
    quotation.state_version = Number(quotation.state_version ?? 0) + 1;
    quotation.updated_by =
      params.transaction.completed_by ??
      params.transaction.requested_by ??
      quotation.updated_by;
    await manager.getRepository(Quotation).save(quotation);

    if (
      previousStatus !== quotation.status ||
      previousTiraStatus !== quotation.tira_status
    ) {
      await manager.getRepository(QuotationStatusHistory).save({
        quotation_id: quotation.id,
        previous_quotation_status: previousStatus,
        new_quotation_status: quotation.status,
        previous_approval_status: quotation.approval_status,
        new_approval_status: quotation.approval_status,
        previous_payment_status: quotation.payment_status,
        new_payment_status: quotation.payment_status,
        previous_tira_status: previousTiraStatus,
        new_tira_status: quotation.tira_status,
        transition_type: 'TIRAMIS_FINAL_SUCCESS',
        reason: statusDescription,
        comments: params.coverNoteReferenceNumber
          ? `Cover note reference ${params.coverNoteReferenceNumber}`
          : null,
        changed_by:
          params.transaction.completed_by ??
          params.transaction.requested_by ??
          null,
        changed_by_type: 'SYSTEM',
        source: 'TIRAMIS',
        channel: quotation.channel_type,
        request_id: requestId,
        tira_request_id: requestId,
        tira_response_id: responseId,
        metadata,
      });
    }
  }

  private resolveTransactionQuotationTiraStatus(
    transaction: PolicyTransaction,
  ): TiraStatus {
    switch (transaction.transaction_type) {
      case PolicyTransactionType.CANCELLATION:
        return TiraStatus.CANCELLED;
      case PolicyTransactionType.ENDORSEMENT:
        return TiraStatus.ENDORSED;
      default:
        return TiraStatus.SUCCESS;
    }
  }

  async captureFinalRejection(
    companyId: string,
    transactionId: string,
    payload: TiramisNotificationEventDto,
  ) {
    const transaction = await this.dataSource
      .getRepository(PolicyTransaction)
      .findOne({
        where: {
          id: transactionId,
          company_id: companyId,
        },
      });

    if (!transaction) {
      return;
    }

    if (payload.regulatoryResponse) {
      transaction.regulatory_response =
        payload.regulatoryResponse as unknown as Record<string, unknown>;
      transaction.regulatory_response_hash =
        payload.regulatoryResponse.responsePayloadHash;
    }

    transaction.last_command = 'TIRAMIS_REJECTED';
    await this.dataSource.getRepository(PolicyTransaction).save(transaction);
  }
}
