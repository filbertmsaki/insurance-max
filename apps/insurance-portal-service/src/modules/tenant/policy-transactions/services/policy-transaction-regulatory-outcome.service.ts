import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisNotificationEventDto } from '../../tiramis-integration/dto/tiramis-notification-event.dto';
import { PortalTiraSubmission } from '../../tiramis-integration/entities/portal-tira-submission.entity';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { PolicyTransactionQuotationFactoryService } from './policy-transaction-quotation-factory.service';
import { PolicyTransactionType } from '@insurance-max/contracts';

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

      await this.ensureRelatedQuotation(manager, transaction, {
        endorsement,
        cancellation,
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
  ) {
    const existing = await manager.getRepository(Quotation).findOne({
      where: {
        company_id: transaction.company_id,
        source_policy_transaction_id: transaction.id,
      },
      select: { id: true },
    });

    if (existing) {
      return;
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
      return;
    }

    try {
      await this.quotationFactory.createTransactionDraft(
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
