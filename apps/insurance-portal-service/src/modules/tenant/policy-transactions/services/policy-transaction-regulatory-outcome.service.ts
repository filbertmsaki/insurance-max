import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TiramisSubmissionTrackingEntity } from '../../../tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisNotificationEventDto } from '../../tiramis-integration/dto/tiramis-notification-event.dto';
import { PortalTiraSubmission } from '../../tiramis-integration/entities/portal-tira-submission.entity';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionType } from '@insurance-max/contracts';

@Injectable()
export class PolicyTransactionRegulatoryOutcomeService {
  constructor(private readonly dataSource: DataSource) {}

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

      return {
        transaction,
        endorsement,
        cancellation,
        regulatoryResponse: response,
      };
    });
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
