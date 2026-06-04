import { Injectable, NotFoundException } from '@nestjs/common';

import {
  TIRAMIS_ATTEMPT_STATUS,
  TIRAMIS_SUBMISSION_EVENT_TYPE,
  TIRAMIS_TRANSACTION_STATUS,
} from '../constants/tiramis-submission.constants';
import { TiramisSubmissionAttemptRepository } from '../repositories/tiramis-submission-attempt.repository';
import { TiramisSubmissionEventRepository } from '../repositories/tiramis-submission-event.repository';
import { TiramisTransactionRepository } from '../repositories/tiramis-transaction.repository';

@Injectable()
export class TiramisSubmissionService {
  constructor(
    private readonly transactionRepository: TiramisTransactionRepository,
    private readonly attemptRepository: TiramisSubmissionAttemptRepository,
    private readonly eventRepository: TiramisSubmissionEventRepository,
  ) {}

  async createTransaction(params: {
    clientConfigurationId: string;
    serviceType: string;
    sourceModule?: string;
    sourceRecordId?: string;
    businessReference: string;
  }) {
    const transaction = this.transactionRepository.create({
      clientConfigurationId: params.clientConfigurationId,
      serviceType: params.serviceType,
      sourceModule: params.sourceModule || null,
      sourceRecordId: params.sourceRecordId || null,
      businessReference: params.businessReference,
      status: TIRAMIS_TRANSACTION_STATUS.PENDING,
      totalAttempts: 0,
    });

    return this.transactionRepository.save(transaction);
  }

  async createAttempt(params: {
    transactionId: string;
    requestId: string;
    rootElement: string;
    requestXml?: string;
    requestSignature?: string;
    previousRequestId?: string | null;
    resubmissionReason?: string | null;
  }) {
    const transaction = await this.transactionRepository.findById(
      params.transactionId,
    );

    if (!transaction) {
      throw new NotFoundException('TIRAMIS transaction not found');
    }

    const latestAttempt =
      await this.attemptRepository.findLatestByTransactionId(transaction.id);

    const attemptNo = latestAttempt ? latestAttempt.attemptNo + 1 : 1;

    const attempt = this.attemptRepository.create({
      transactionId: transaction.id,
      attemptNo,
      requestId: params.requestId,
      previousRequestId: params.previousRequestId || null,
      rootElement: params.rootElement,
      resubmissionReason: params.resubmissionReason || null,
      requestXml: params.requestXml || null,
      requestSignature: params.requestSignature || null,
      status: params.requestXml
        ? TIRAMIS_ATTEMPT_STATUS.XML_GENERATED
        : TIRAMIS_ATTEMPT_STATUS.PENDING,
    });

    const savedAttempt = await this.attemptRepository.save(attempt);

    transaction.currentRequestId = params.requestId;
    transaction.originalRequestId =
      transaction.originalRequestId || params.requestId;
    transaction.totalAttempts = attemptNo;
    transaction.status = TIRAMIS_TRANSACTION_STATUS.PROCESSING;
    transaction.lastAttemptAt = new Date();

    await this.transactionRepository.save(transaction);

    await this.createEvent({
      transactionId: transaction.id,
      attemptId: savedAttempt.id,
      requestId: savedAttempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.REQUEST_CREATED,
      rawPayload: params.requestXml || null,
    });

    return savedAttempt;
  }

  async markXmlGenerated(params: {
    requestId: string;
    requestXml: string;
    requestSignature?: string;
  }) {
    const attempt = await this.getAttemptOrFail(params.requestId);

    attempt.requestXml = params.requestXml;
    attempt.requestSignature = params.requestSignature || null;
    attempt.status = params.requestSignature
      ? TIRAMIS_ATTEMPT_STATUS.SIGNED
      : TIRAMIS_ATTEMPT_STATUS.XML_GENERATED;

    const savedAttempt = await this.attemptRepository.save(attempt);

    await this.createEvent({
      transactionId: attempt.transactionId,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: params.requestSignature
        ? TIRAMIS_SUBMISSION_EVENT_TYPE.SIGNED
        : TIRAMIS_SUBMISSION_EVENT_TYPE.XML_GENERATED,
      rawPayload: params.requestXml,
    });

    return savedAttempt;
  }

  async markSent(requestId: string) {
    const attempt = await this.getAttemptOrFail(requestId);

    attempt.status = TIRAMIS_ATTEMPT_STATUS.SENT;
    attempt.sentAt = new Date();

    const savedAttempt = await this.attemptRepository.save(attempt);

    await this.createEvent({
      transactionId: attempt.transactionId,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.REQUEST_SENT,
    });

    return savedAttempt;
  }

  async markAcknowledgementReceived(params: {
    requestId: string;
    acknowledgementId?: string;
    statusCode: string;
    statusDesc?: string;
    rawXml?: string;
    isSuccess: boolean;
  }) {
    const attempt = await this.getAttemptOrFail(params.requestId);

    attempt.acknowledgementId = params.acknowledgementId || null;
    attempt.acknowledgementStatusCode = params.statusCode;
    attempt.acknowledgementStatusDesc = params.statusDesc || null;
    attempt.acknowledgementXml = params.rawXml || null;
    attempt.ackReceivedAt = new Date();
    attempt.status = params.isSuccess
      ? TIRAMIS_ATTEMPT_STATUS.ACK_SUCCESS
      : TIRAMIS_ATTEMPT_STATUS.ACK_FAILED;

    const savedAttempt = await this.attemptRepository.save(attempt);

    await this.createEvent({
      transactionId: attempt.transactionId,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.ACK_RECEIVED,
      statusCode: params.statusCode,
      statusDesc: params.statusDesc || null,
      rawPayload: params.rawXml || null,
    });

    return savedAttempt;
  }

  async markFinalResponseReceived(params: {
    requestId: string;
    responseId?: string;
    statusCode: string;
    statusDesc?: string;
    rawXml?: string;
    responseSignature?: string;
    isSuccess: boolean;
  }) {
    const attempt = await this.getAttemptOrFail(params.requestId);

    attempt.responseId = params.responseId || null;
    attempt.responseStatusCode = params.statusCode;
    attempt.responseStatusDesc = params.statusDesc || null;
    attempt.responseXml = params.rawXml || null;
    attempt.responseSignature = params.responseSignature || null;
    attempt.finalResponseReceivedAt = new Date();
    attempt.status = params.isSuccess
      ? TIRAMIS_ATTEMPT_STATUS.FINAL_SUCCESS
      : TIRAMIS_ATTEMPT_STATUS.FINAL_FAILED;

    const savedAttempt = await this.attemptRepository.save(attempt);

    const transaction = await this.transactionRepository.findById(
      attempt.transactionId,
    );

    if (transaction) {
      if (params.isSuccess) {
        transaction.status = TIRAMIS_TRANSACTION_STATUS.SUCCESS;
        transaction.successfulRequestId = attempt.requestId;
        transaction.successfulAt = new Date();
      } else {
        transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
        transaction.lastError = params.statusDesc || params.statusCode;
      }

      await this.transactionRepository.save(transaction);
    }

    await this.createEvent({
      transactionId: attempt.transactionId,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.FINAL_RESPONSE_RECEIVED,
      statusCode: params.statusCode,
      statusDesc: params.statusDesc || null,
      rawPayload: params.rawXml || null,
    });

    return savedAttempt;
  }

  async markResponseAcknowledgementSent(params: {
    requestId: string;
    acknowledgementId: string;
    statusCode: string;
    statusDesc?: string | null;
    rawXml?: string | null;
  }) {
    const attempt = await this.getAttemptOrFail(params.requestId);

    attempt.responseAcknowledgementId = params.acknowledgementId;
    attempt.responseAckStatusCode = params.statusCode;
    attempt.responseAckStatusDesc = params.statusDesc || null;
    attempt.responseAckXml = params.rawXml || null;
    attempt.responseAckSentAt = new Date();

    const savedAttempt = await this.attemptRepository.save(attempt);

    await this.createEvent({
      transactionId: attempt.transactionId,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.FINAL_RESPONSE_ACK_SENT,
      statusCode: params.statusCode,
      statusDesc: params.statusDesc || null,
      rawPayload: params.rawXml || null,
    });

    return savedAttempt;
  }

  async markFailed(params: {
    requestId: string;
    errorMessage: string;
    rawPayload?: string;
  }) {
    const attempt = await this.getAttemptOrFail(params.requestId);

    attempt.status = TIRAMIS_ATTEMPT_STATUS.UNKNOWN;
    attempt.errorMessage = params.errorMessage;

    const savedAttempt = await this.attemptRepository.save(attempt);

    const transaction = await this.transactionRepository.findById(
      attempt.transactionId,
    );

    if (transaction) {
      transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
      transaction.lastError = params.errorMessage;

      await this.transactionRepository.save(transaction);
    }

    await this.createEvent({
      transactionId: attempt.transactionId,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.FAILED,
      errorMessage: params.errorMessage,
      rawPayload: params.rawPayload || null,
    });

    return savedAttempt;
  }

  async findAttemptByRequestId(requestId: string) {
    return this.attemptRepository.findByRequestId(requestId);
  }

  async findTransactionById(transactionId: string) {
    return this.transactionRepository.findById(transactionId);
  }

  async findAttemptsByTransactionId(transactionId: string) {
    return this.attemptRepository.findAllByTransactionId(transactionId);
  }

  async findEventsByTransactionId(transactionId: string) {
    return this.eventRepository.findByTransactionId(transactionId);
  }

  private async getAttemptOrFail(requestId: string) {
    const attempt = await this.attemptRepository.findByRequestId(requestId);

    if (!attempt) {
      throw new NotFoundException(
        `TIRAMIS submission attempt not found for requestId: ${requestId}`,
      );
    }

    return attempt;
  }

  private async createEvent(params: {
    transactionId: string;
    attemptId: string;
    requestId: string;
    eventType: string;
    statusCode?: string | null;
    statusDesc?: string | null;
    rawPayload?: string | null;
    errorMessage?: string | null;
  }) {
    const event = this.eventRepository.create({
      transactionId: params.transactionId,
      attemptId: params.attemptId,
      requestId: params.requestId,
      eventType: params.eventType,
      statusCode: params.statusCode || null,
      statusDesc: params.statusDesc || null,
      rawPayload: params.rawPayload || null,
      errorMessage: params.errorMessage || null,
    });

    return this.eventRepository.save(event);
  }
}
