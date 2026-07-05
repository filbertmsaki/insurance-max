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
    sourceService?: string | null;
    sourceCompanyId?: string | null;
    sourceUserId?: string | null;
    sourceModule?: string;
    sourceRecordId?: string;
    businessReference: string;
    originalRequestId?: string | null;
  }) {
    const transaction = this.transactionRepository.create({
      clientConfigurationId: params.clientConfigurationId,
      serviceType: params.serviceType,
      sourceService: params.sourceService || null,
      sourceCompanyId: params.sourceCompanyId || null,
      sourceUserId: params.sourceUserId || null,
      sourceModule: params.sourceModule || null,
      sourceRecordId: params.sourceRecordId || null,
      businessReference: params.businessReference,
      status: TIRAMIS_TRANSACTION_STATUS.PENDING,
      originalRequestId: params.originalRequestId || null,
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
    attempt.isRetryable = 0;
    attempt.nextRetryAt = null;

    if (params.isSuccess) {
      attempt.status = TIRAMIS_ATTEMPT_STATUS.ACK_SUCCESS;

      const callbackTimeoutMinutes = Number(
        process.env.TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES || 30,
      );

      attempt.finalCallbackDeadlineAt = new Date(
        Date.now() + callbackTimeoutMinutes * 60 * 1000,
      );
    } else {
      attempt.status = TIRAMIS_ATTEMPT_STATUS.ACK_FAILED;
      attempt.finalCallbackDeadlineAt = null;
    }

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
    rawPayload?: string | null;
    isRetryable?: boolean;
    nextRetryAt?: Date | null;
  }) {
    const attempt = await this.getAttemptOrFail(params.requestId);

    attempt.status = TIRAMIS_ATTEMPT_STATUS.FAILED;
    attempt.errorMessage = params.errorMessage;
    attempt.isRetryable = params.isRetryable ? 1 : 0;
    attempt.lastRetryAt = attempt.lastRetryAt || null;

    if (params.isRetryable) {
      attempt.maxRetries = Number(
        process.env.TIRAMIS_RETRY_MAX_ATTEMPTS || attempt.maxRetries || 5,
      );

      attempt.nextRetryAt =
        params.nextRetryAt || this.calculateNextRetryAt(attempt.retryCount || 0);
    } else {
      attempt.nextRetryAt = null;
    }

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

  async getSubmissionStatus(params: {
    transactionId?: string;
    requestId?: string;
    businessReference?: string;
    includePayload?: boolean;
  }) {
    const transaction = await this.resolveTransaction(params);

    const attempts = await this.attemptRepository.findAllByTransactionId(
      transaction.id,
    );

    const latestAttempt =
      attempts.length > 0 ? attempts[attempts.length - 1] : null;

    const events = await this.eventRepository.findByTransactionId(
      transaction.id,
    );

    return {
      transaction: this.mapTransaction(transaction),
      currentAttempt: latestAttempt
        ? this.mapAttempt(latestAttempt, params.includePayload || false)
        : null,
      attempts: attempts.map((attempt) =>
        this.mapAttempt(attempt, params.includePayload || false),
      ),
      latestEvent:
        events.length > 0
          ? this.mapEvent(events[events.length - 1], false)
          : null,
      summary: this.buildSubmissionSummary({
        transaction,
        latestAttempt,
      }),
    };
  }

  async getSubmissionTrace(params: {
    transactionId?: string;
    requestId?: string;
    businessReference?: string;
    includePayload?: boolean;
  }) {
    const transaction = await this.resolveTransaction(params);

    const attempts = await this.attemptRepository.findAllByTransactionId(
      transaction.id,
    );

    const events = await this.eventRepository.findByTransactionId(
      transaction.id,
    );

    const latestAttempt =
      attempts.length > 0 ? attempts[attempts.length - 1] : null;

    return {
      transaction: this.mapTransaction(transaction),
      currentAttempt: latestAttempt
        ? this.mapAttempt(latestAttempt, params.includePayload || false)
        : null,
      attempts: attempts.map((attempt) =>
        this.mapAttempt(attempt, params.includePayload || false),
      ),
      events: events.map((event) =>
        this.mapEvent(event, params.includePayload || false),
      ),
      summary: this.buildSubmissionSummary({
        transaction,
        latestAttempt,
      }),
    };
  }

  async getStatus(params: {
    transactionId?: string | null;
    requestId?: string | null;
    businessReference?: string | null;
    includePayload?: boolean;
  }) {
    const transaction = await this.resolveTransactionForQuery(params);

    if (!transaction) {
      return {
        found: false,
        message: 'TIRAMIS transaction not found',
        query: params,
      };
    }

    const attempts =
      await this.attemptRepository.findAllByTransactionId(transaction.id);

    const currentAttempt =
      attempts.find((attempt) => attempt.requestId === transaction.currentRequestId) ||
      attempts[attempts.length - 1] ||
      null;

    return {
      found: true,
      transaction,
      currentAttempt: this.sanitizeAttempt(currentAttempt, !!params.includePayload),
      attempts: attempts.map((attempt) =>
        this.sanitizeAttempt(attempt, !!params.includePayload),
      ),
    };
  }

  async getTrace(params: {
    transactionId?: string | null;
    requestId?: string | null;
    businessReference?: string | null;
    includePayload?: boolean;
  }) {
    const status = await this.getStatus(params);

    if (!status.found || !status.transaction) {
      return status;
    }

    const events = await this.eventRepository.findByTransactionId(
      status.transaction.id,
    );

    return {
      ...status,
      events: events.map((event) => {
        if (params.includePayload) {
          return event;
        }

        return {
          ...event,
          rawPayload: event.rawPayload ? '[hidden]' : null,
        };
      }),
    };
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

  async getTransactionForNotification(params: { requestId: string }) {
    const attempt = await this.attemptRepository.findByRequestId(
      params.requestId,
    );

    if (attempt) {
      return this.transactionRepository.findById(attempt.transactionId);
    }

    return this.transactionRepository.findByAnyRequestId(params.requestId);
  }

  private async resolveTransaction(params: {
    transactionId?: string;
    requestId?: string;
    businessReference?: string;
  }) {
    if (params.transactionId) {
      const transaction = await this.transactionRepository.findById(
        params.transactionId,
      );

      if (!transaction) {
        throw new NotFoundException(
          `TIRAMIS transaction not found for transactionId: ${params.transactionId}`,
        );
      }

      return transaction;
    }

    if (params.requestId) {
      const attempt = await this.attemptRepository.findByRequestId(
        params.requestId,
      );

      if (attempt) {
        const transaction = await this.transactionRepository.findById(
          attempt.transactionId,
        );

        if (transaction) {
          return transaction;
        }
      }

      const transaction = await this.transactionRepository.findByAnyRequestId(
        params.requestId,
      );

      if (!transaction) {
        throw new NotFoundException(
          `TIRAMIS transaction not found for requestId: ${params.requestId}`,
        );
      }

      return transaction;
    }

    if (params.businessReference) {
      const transaction = await this.transactionRepository.findByBusinessReference(
        params.businessReference,
      );

      if (!transaction) {
        throw new NotFoundException(
          `TIRAMIS transaction not found for businessReference: ${params.businessReference}`,
        );
      }

      return transaction;
    }

    throw new NotFoundException(
      'Provide one of transactionId, requestId, or businessReference',
    );
  }

  private mapTransaction(transaction: any) {
    return {
      id: transaction.id,
      clientConfigurationId: transaction.clientConfigurationId,
      serviceType: transaction.serviceType,
      sourceService: transaction.sourceService,
      sourceCompanyId: transaction.sourceCompanyId,
      sourceUserId: transaction.sourceUserId,
      sourceModule: transaction.sourceModule,
      sourceRecordId: transaction.sourceRecordId,
      businessReference: transaction.businessReference,
      status: transaction.status,
      originalRequestId: transaction.originalRequestId,
      currentRequestId: transaction.currentRequestId,
      successfulRequestId: transaction.successfulRequestId,
      totalAttempts: transaction.totalAttempts,
      lastAttemptAt: transaction.lastAttemptAt,
      successfulAt: transaction.successfulAt,
      lastError: transaction.lastError,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private mapAttempt(attempt: any, includePayload: boolean) {
    return {
      id: attempt.id,
      transactionId: attempt.transactionId,
      attemptNo: attempt.attemptNo,
      requestId: attempt.requestId,
      previousRequestId: attempt.previousRequestId,
      rootElement: attempt.rootElement,
      status: attempt.status,
      resubmissionReason: attempt.resubmissionReason,
      sentAt: attempt.sentAt,
      acknowledgement: {
        acknowledgementId: attempt.acknowledgementId,
        statusCode: attempt.acknowledgementStatusCode,
        statusDesc: attempt.acknowledgementStatusDesc,
        receivedAt: attempt.ackReceivedAt,
      },
      finalResponse: {
        responseId: attempt.responseId,
        statusCode: attempt.responseStatusCode,
        statusDesc: attempt.responseStatusDesc,
        receivedAt: attempt.finalResponseReceivedAt,
      },
      finalResponseAcknowledgement: {
        acknowledgementId: attempt.responseAcknowledgementId,
        statusCode: attempt.responseAckStatusCode,
        statusDesc: attempt.responseAckStatusDesc,
        sentAt: attempt.responseAckSentAt,
      },
      errorMessage: attempt.errorMessage,
      payloads: includePayload
        ? {
            requestXml: attempt.requestXml,
            requestSignature: attempt.requestSignature,
            acknowledgementXml: attempt.acknowledgementXml,
            responseXml: attempt.responseXml,
            responseSignature: attempt.responseSignature,
            responseAckXml: attempt.responseAckXml,
          }
        : undefined,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  private mapEvent(event: any, includePayload: boolean) {
    return {
      id: event.id,
      transactionId: event.transactionId,
      attemptId: event.attemptId,
      requestId: event.requestId,
      eventType: event.eventType,
      statusCode: event.statusCode,
      statusDesc: event.statusDesc,
      errorMessage: event.errorMessage,
      rawPayload: includePayload ? event.rawPayload : undefined,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private buildSubmissionSummary(params: {
    transaction: any;
    latestAttempt: any | null;
  }) {
    const { transaction, latestAttempt } = params;

    return {
      transactionStatus: transaction.status,
      attemptStatus: latestAttempt?.status || null,
      requestId: latestAttempt?.requestId || transaction.currentRequestId || null,
      acknowledgementReceived: !!latestAttempt?.ackReceivedAt,
      acknowledgementStatusCode:
        latestAttempt?.acknowledgementStatusCode || null,
      acknowledgementStatusDesc:
        latestAttempt?.acknowledgementStatusDesc || null,
      finalResponseReceived: !!latestAttempt?.finalResponseReceivedAt,
      finalResponseStatusCode: latestAttempt?.responseStatusCode || null,
      finalResponseStatusDesc: latestAttempt?.responseStatusDesc || null,
      responseAcknowledgementSent: !!latestAttempt?.responseAckSentAt,
      successfulRequestId: transaction.successfulRequestId || null,
      isCompleted: transaction.status === TIRAMIS_TRANSACTION_STATUS.SUCCESS,
      isFailed: transaction.status === TIRAMIS_TRANSACTION_STATUS.FAILED,
      lastError: transaction.lastError || latestAttempt?.errorMessage || null,
    };
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

  private async resolveTransactionForQuery(params: {
    transactionId?: string | null;
    requestId?: string | null;
    businessReference?: string | null;
  }) {
    if (params.transactionId) {
      return this.transactionRepository.findById(params.transactionId);
    }

    if (params.requestId) {
      const attempt = await this.attemptRepository.findByRequestId(
        params.requestId,
      );

      if (attempt) {
        return this.transactionRepository.findById(attempt.transactionId);
      }

      return this.transactionRepository.findByAnyRequestId(params.requestId);
    }

    if (params.businessReference) {
      return this.transactionRepository.findByBusinessReference(
        params.businessReference,
      );
    }

    return null;
  }

  private sanitizeAttempt(attempt: any, includePayload: boolean) {
    if (!attempt) {
      return null;
    }

    if (includePayload) {
      return attempt;
    }

    return {
      ...attempt,
      requestXml: attempt.requestXml ? '[hidden]' : null,
      acknowledgementXml: attempt.acknowledgementXml ? '[hidden]' : null,
      responseXml: attempt.responseXml ? '[hidden]' : null,
      responseAckXml: attempt.responseAckXml ? '[hidden]' : null,
      requestSignature: attempt.requestSignature ? '[hidden]' : null,
      responseSignature: attempt.responseSignature ? '[hidden]' : null,
    };
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
    } as DeepPartial<any>);

    return this.eventRepository.save(event);
  }

  private calculateNextRetryAt(currentRetryCount: number): Date {
    const baseDelaySeconds = Number(
      process.env.TIRAMIS_RETRY_BASE_DELAY_SECONDS || 60,
    );

    const maxDelaySeconds = Number(
      process.env.TIRAMIS_RETRY_MAX_DELAY_SECONDS || 900,
    );

    const delaySeconds = Math.min(
      baseDelaySeconds * Math.pow(2, currentRetryCount),
      maxDelaySeconds,
    );

    return new Date(Date.now() + delaySeconds * 1000);
  }
}
