import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

@Injectable()
export class TiramisSubmissionTrackingRepository {
  constructor(
    @InjectRepository(TiramisSubmissionTrackingEntity)
    private readonly repository: Repository<TiramisSubmissionTrackingEntity>,
  ) {}

  create(data: Partial<TiramisSubmissionTrackingEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisSubmissionTrackingEntity) {
    return this.repository.save(entity);
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByBusinessReference(businessReference: string) {
    return this.repository.find({
      where: { businessReference },
      order: { createdAt: 'DESC' },
    });
  }

  findBySourceRecordId(sourceRecordId: string) {
    return this.repository.find({
      where: { sourceRecordId },
      order: { createdAt: 'DESC' },
    });
  }

  findRecent(limit = 50) {
    return this.repository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  findPendingFinalSync(limit = 50) {
    return this.repository.find({
      where: [
        {
          status: In([
            TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
            TiramisSubmissionStatus.ACKNOWLEDGED,
            TiramisSubmissionStatus.UNKNOWN,
          ]),
          finalResponseId: IsNull(),
        },
      ],
      order: {
        updatedAt: 'ASC',
      },
      take: limit,
    });
  }

  async markSent(id: string, response: any) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
        submittedAt: new Date(),
        tiramisTransactionId:
          response?.transaction?.id ||
          response?.transactionId ||
          response?.tiramisTransactionId ||
          null,
        tiramisRequestId:
          response?.requestId ||
          response?.reinsurance?.requestId ||
          response?.policy?.requestId ||
          response?.record?.requestId ||
          response?.coverNote?.requestId ||
          null,
        tiramisServiceType:
          response?.serviceType ||
          response?.transaction?.serviceType ||
          null,
        tiramisRootElement:
          response?.rootElement ||
          response?.tiraResponse?.rootElement ||
          null,
        tiramisResponsePayload: response || null,
      },
    );

    return this.findById(id);
  }

  async markAcknowledged(id: string, response: any) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgementStatusCode:
          response?.acknowledgement?.statusCode ||
          response?.tiraResponse?.acknowledgementStatusCode ||
          response?.tiraResponse?.AcknowledgementStatusCode ||
          null,
        acknowledgementStatusDesc:
          response?.acknowledgement?.statusDesc ||
          response?.tiraResponse?.acknowledgementStatusDesc ||
          response?.tiraResponse?.AcknowledgementStatusDesc ||
          null,
        tiramisResponsePayload: response || null,
      },
    );

    return this.findById(id);
  }

  async markFailed(id: string, error: any) {
    await this.repository.update(
      { id },
      {
        status: TiramisSubmissionStatus.FAILED,
        failedAt: new Date(),
        lastErrorMessage:
          error?.message ||
          error?.response?.message ||
          error?.error?.message ||
          'TIRAMIS submission failed',
        tiramisResponsePayload: {
          error: error?.response || error?.error || error?.message || error,
        },
      },
    );

    return this.findById(id);
  }

  async markSyncChecked(id: string, response: any) {
    const tracking = await this.findById(id);

    await this.repository.update(
      { id },
      {
        lastSyncedAt: new Date(),
        syncAttempts: (tracking?.syncAttempts || 0) + 1,
        tiramisResponsePayload: response || tracking?.tiramisResponsePayload || null,
      },
    );

    return this.findById(id);
  }

  async markFinalFromTiramisStatus(id: string, response: any) {
    const finalStatus = this.extractFinalStatus(response);

    if (!finalStatus?.responseId) {
      return this.markSyncChecked(id, response);
    }

    const isSuccess =
      finalStatus.statusCode === 'TIRA001' ||
      String(finalStatus.statusDesc || '').toLowerCase() === 'successful';

    await this.repository.update(
      { id },
      {
        status: isSuccess
          ? TiramisSubmissionStatus.FINAL_SUCCESS
          : TiramisSubmissionStatus.FINAL_FAILED,
        finalResponseId: finalStatus.responseId,
        finalResponseStatusCode: finalStatus.statusCode,
        finalResponseStatusDesc: finalStatus.statusDesc,
        finalResponseReceivedAt: finalStatus.receivedAt
          ? new Date(finalStatus.receivedAt)
          : new Date(),
        finalResponsePayload: finalStatus.payload || response || null,
        tiramisResponsePayload: response || null,
        lastSyncedAt: new Date(),
        lastErrorMessage: isSuccess
          ? null
          : finalStatus.statusDesc || 'TIRAMIS final response failed',
      },
    );

    return this.findById(id);
  }

  private extractFinalStatus(response: any): {
    responseId?: string | null;
    statusCode?: string | null;
    statusDesc?: string | null;
    receivedAt?: string | Date | null;
    payload?: Record<string, any> | null;
  } | null {
    const transaction =
      response?.transaction ||
      response?.data?.transaction ||
      response?.tiramis?.transaction ||
      null;

    const finalResponse =
      response?.finalResponse ||
      response?.data?.finalResponse ||
      response?.tiramis?.finalResponse ||
      transaction?.finalResponse ||
      transaction?.latestFinalResponse ||
      null;

    return {
      responseId:
        finalResponse?.responseId ||
        finalResponse?.ResponseId ||
        transaction?.finalResponseId ||
        transaction?.responseId ||
        response?.responseId ||
        null,
      statusCode:
        finalResponse?.responseStatusCode ||
        finalResponse?.ResponseStatusCode ||
        transaction?.finalResponseStatusCode ||
        transaction?.responseStatusCode ||
        response?.responseStatusCode ||
        null,
      statusDesc:
        finalResponse?.responseStatusDesc ||
        finalResponse?.ResponseStatusDesc ||
        transaction?.finalResponseStatusDesc ||
        transaction?.responseStatusDesc ||
        response?.responseStatusDesc ||
        null,
      receivedAt:
        finalResponse?.receivedAt ||
        transaction?.finalResponseReceivedAt ||
        response?.finalResponseReceivedAt ||
        null,
      payload: finalResponse || response || null,
    };
  }
}
