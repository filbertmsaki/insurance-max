import { Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';

import {
  TIRAMIS_ATTEMPT_STATUS,
  TIRAMIS_SUBMISSION_EVENT_TYPE,
  TIRAMIS_TRANSACTION_STATUS,
} from '../constants/tiramis-submission.constants';
import { TiramisSubmissionAttemptRepository } from '../repositories/tiramis-submission-attempt.repository';
import { TiramisSubmissionEventRepository } from '../repositories/tiramis-submission-event.repository';
import { TiramisTransactionRepository } from '../repositories/tiramis-transaction.repository';
import { TiramisRequestIdService } from './tiramis-request-id.service';

@Injectable()
export class TiramisResubmissionService {
  constructor(
    private readonly requestIdService: TiramisRequestIdService,
    private readonly transactionRepository: TiramisTransactionRepository,
    private readonly attemptRepository: TiramisSubmissionAttemptRepository,
    private readonly eventRepository: TiramisSubmissionEventRepository,
  ) {}

  async prepareResubmission(params: {
    transactionId: string;
    rootElement: string;
    reason: string;
    requestIdPrefix?: string;
  }) {
    const transaction = await this.transactionRepository.findById(
      params.transactionId,
    );

    if (!transaction) {
      throw new NotFoundException('TIRAMIS transaction not found');
    }

    const latestAttempt =
      await this.attemptRepository.findLatestByTransactionId(transaction.id);

    const newRequestId = await this.requestIdService.generate(
      params.requestIdPrefix || 'AIC',
    );

    const attemptNo = latestAttempt ? latestAttempt.attemptNo + 1 : 1;

    if (latestAttempt) {
      latestAttempt.status = TIRAMIS_ATTEMPT_STATUS.SUPERSEDED;
      await this.attemptRepository.save(latestAttempt);
    }

    const newAttempt = this.attemptRepository.create({
      transactionId: transaction.id,
      attemptNo,
      requestId: newRequestId,
      previousRequestId: latestAttempt?.requestId || null,
      rootElement: params.rootElement,
      resubmissionReason: params.reason,
      status: TIRAMIS_ATTEMPT_STATUS.PENDING,
    });

    const savedAttempt = await this.attemptRepository.save(newAttempt);

    transaction.currentRequestId = newRequestId;
    transaction.originalRequestId =
      transaction.originalRequestId || latestAttempt?.requestId || newRequestId;
    transaction.totalAttempts = attemptNo;
    transaction.status = TIRAMIS_TRANSACTION_STATUS.PROCESSING;
    transaction.lastAttemptAt = new Date();
    transaction.lastError = null;

    await this.transactionRepository.save(transaction);

    const event = this.eventRepository.create({
      transactionId: transaction.id,
      attemptId: savedAttempt.id,
      requestId: newRequestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.RESUBMITTED,
      statusDesc: params.reason,
    });

    await this.eventRepository.save(event);

    return savedAttempt;
  }
}
