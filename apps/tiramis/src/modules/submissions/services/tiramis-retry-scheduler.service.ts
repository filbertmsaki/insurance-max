import { environment } from '@insurance-max/shared-config';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisPortalNotificationService } from '../../portal-notifications/services/tiramis-portal-notification.service';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import {
  TIRAMIS_ATTEMPT_STATUS,
  TIRAMIS_SUBMISSION_EVENT_TYPE,
  TIRAMIS_TRANSACTION_STATUS,
} from '../constants/tiramis-submission.constants';
import { TiramisSubmissionAttemptRepository } from '../repositories/tiramis-submission-attempt.repository';
import { TiramisSubmissionEventRepository } from '../repositories/tiramis-submission-event.repository';
import { TiramisTransactionRepository } from '../repositories/tiramis-transaction.repository';

@Injectable()
export class TiramisRetrySchedulerService {
  private readonly logger = new Logger(TiramisRetrySchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly attemptRepository: TiramisSubmissionAttemptRepository,
    private readonly eventRepository: TiramisSubmissionEventRepository,
    private readonly transactionRepository: TiramisTransactionRepository,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly httpClient: TiramisHttpClientService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly portalNotificationService: TiramisPortalNotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run() {
    if (environment.TIRAMIS_RETRY_ENABLED === 'false') {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.retryFailedDeliveries();
      await this.detectMissingFinalCallbacks();
    } catch (error: any) {
      this.logger.error(
        `TIRAMIS retry scheduler failed: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async retryFailedDeliveries() {
    const limit = Number(environment.TIRAMIS_RETRY_BATCH_SIZE || 20);

    const attempts = await this.attemptRepository.findRetryableDueAttempts({
      now: new Date(),
      limit,
    });

    for (const attempt of attempts) {
      await this.retrySingleAttempt(attempt);
    }
  }

  private async retrySingleAttempt(attempt: any) {
    const transaction = await this.transactionRepository.findById(
      attempt.transactionId,
    );

    if (!transaction) {
      this.logger.warn(
        `Cannot retry attempt ${attempt.id}: transaction not found`,
      );
      return;
    }

    if (!attempt.requestXml) {
      await this.markRetryExhausted({
        attempt,
        transaction,
        errorMessage: 'Cannot retry attempt because request XML is missing',
      });
      return;
    }

    if ((attempt.retryCount || 0) >= (attempt.maxRetries || 5)) {
      await this.markRetryExhausted({
        attempt,
        transaction,
        errorMessage: 'Maximum retry attempts reached',
      });
      return;
    }

    const configuration =
      await this.tiramisConfigService.getRuntimeConfigurationById(
        transaction.clientConfigurationId,
      );

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration,
        serviceType: transaction.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        configuration,
      );

    attempt.retryCount = Number(attempt.retryCount || 0) + 1;
    attempt.lastRetryAt = new Date();
    attempt.status = TIRAMIS_ATTEMPT_STATUS.SENT;

    await this.attemptRepository.save(attempt);

    await this.recordEvent({
      transactionId: transaction.id,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.REQUEST_RETRY_SENT,
      statusDesc: `Retry ${attempt.retryCount}/${attempt.maxRetries}`,
    });

    try {
      const response = await this.httpClient.postXml({
        url: endpoint,
        headers,
        xml: attempt.requestXml,
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        await this.rescheduleRetry({
          attempt,
          transaction,
          errorMessage: `TIRAMIS HTTP retry error: ${response.statusCode}`,
          rawPayload: response.rawXml,
        });

        return;
      }

      const acknowledgement = this.xmlParser.extractAcknowledgement(
        response.rawXml,
      );

      if (!acknowledgement.ok) {
        await this.rescheduleRetry({
          attempt,
          transaction,
          errorMessage:
            acknowledgement.error ||
            'Unable to parse TIRAMIS acknowledgement during retry',
          rawPayload: response.rawXml,
        });

        return;
      }

      const isSuccess = await this.tiramisConfigService.isSuccessResponse(
        acknowledgement.statusCode!,
      );

      attempt.acknowledgementId = acknowledgement.acknowledgementId || null;
      attempt.acknowledgementStatusCode = acknowledgement.statusCode || null;
      attempt.acknowledgementStatusDesc = acknowledgement.statusDesc || null;
      attempt.acknowledgementXml = response.rawXml;
      attempt.ackReceivedAt = new Date();
      attempt.isRetryable = 0;
      attempt.nextRetryAt = null;

      if (isSuccess) {
        attempt.status = TIRAMIS_ATTEMPT_STATUS.ACK_SUCCESS;

        const callbackTimeoutMinutes = Number(
          environment.TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES || 30,
        );

        attempt.finalCallbackDeadlineAt = new Date(
          Date.now() + callbackTimeoutMinutes * 60 * 1000,
        );

        transaction.status = TIRAMIS_TRANSACTION_STATUS.PROCESSING;
        transaction.lastError = null;
      } else {
        attempt.status = TIRAMIS_ATTEMPT_STATUS.ACK_FAILED;
        attempt.finalCallbackDeadlineAt = null;

        transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
        transaction.lastError =
          acknowledgement.statusDesc || 'TIRAMIS acknowledgement failed';
      }

      await this.attemptRepository.save(attempt);
      await this.transactionRepository.save(transaction);

      await this.recordEvent({
        transactionId: transaction.id,
        attemptId: attempt.id,
        requestId: attempt.requestId,
        eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.ACK_RECEIVED,
        statusCode: acknowledgement.statusCode || null,
        statusDesc: acknowledgement.statusDesc || null,
        rawPayload: response.rawXml,
      });
    } catch (error: any) {
      await this.rescheduleRetry({
        attempt,
        transaction,
        errorMessage:
          error?.message || 'Retry failed while sending request to TIRAMIS',
        rawPayload: error?.response?.data || null,
      });
    }
  }

  private async rescheduleRetry(params: {
    attempt: any;
    transaction: any;
    errorMessage: string;
    rawPayload?: string | null;
  }) {
    const { attempt, transaction } = params;

    attempt.status = TIRAMIS_ATTEMPT_STATUS.FAILED;
    attempt.errorMessage = params.errorMessage;

    if (Number(attempt.retryCount || 0) >= Number(attempt.maxRetries || 5)) {
      await this.markRetryExhausted({
        attempt,
        transaction,
        errorMessage: params.errorMessage,
      });

      return;
    }

    attempt.isRetryable = 1;
    attempt.nextRetryAt = this.calculateNextRetryAt(attempt.retryCount || 0);

    transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
    transaction.lastError = params.errorMessage;

    await this.attemptRepository.save(attempt);
    await this.transactionRepository.save(transaction);

    await this.recordEvent({
      transactionId: transaction.id,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.REQUEST_RETRY_SCHEDULED,
      statusDesc: params.errorMessage,
      rawPayload: params.rawPayload || null,
    });
  }

  private async markRetryExhausted(params: {
    attempt: any;
    transaction: any;
    errorMessage: string;
  }) {
    const { attempt, transaction } = params;

    attempt.status = TIRAMIS_ATTEMPT_STATUS.FAILED;
    attempt.isRetryable = 0;
    attempt.nextRetryAt = null;
    attempt.errorMessage = params.errorMessage;

    transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
    transaction.lastError = params.errorMessage;

    await this.attemptRepository.save(attempt);
    await this.transactionRepository.save(transaction);

    await this.recordEvent({
      transactionId: transaction.id,
      attemptId: attempt.id,
      requestId: attempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.REQUEST_RETRY_EXHAUSTED,
      statusDesc: params.errorMessage,
    });

    this.logger.warn(
      `TIRAMIS retry exhausted for requestId ${attempt.requestId}: ${params.errorMessage}`,
    );
  }

  private async detectMissingFinalCallbacks() {
    const limit = Number(environment.TIRAMIS_RETRY_BATCH_SIZE || 20);

    const attempts =
      await this.attemptRepository.findFinalCallbackOverdueAttempts({
        now: new Date(),
        limit,
      });

    for (const attempt of attempts) {
      const transaction = await this.transactionRepository.findById(
        attempt.transactionId,
      );

      if (!transaction) {
        continue;
      }

      attempt.finalCallbackOverdueNotified = 1;
      await this.attemptRepository.save(attempt);

      await this.recordEvent({
        transactionId: transaction.id,
        attemptId: attempt.id,
        requestId: attempt.requestId,
        eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.FINAL_CALLBACK_OVERDUE,
        statusDesc:
          'Final TIRAMIS callback was not received before configured deadline',
      });

      await this.portalNotificationService.publish({
        eventType: 'TIRAMIS_FINAL_CALLBACK_OVERDUE',
        sourceService: 'tiramis-service',
        sourceCompanyId: transaction.sourceCompanyId || null,
        sourceModule: transaction.sourceModule || null,
        sourceRecordId: transaction.sourceRecordId || null,
        businessReference: transaction.businessReference || null,
        tiramisTransactionId: transaction.id,
        requestId: attempt.requestId,
        responseId: null,
        serviceType: transaction.serviceType || null,
        rootElement: attempt.rootElement || null,
        statusCode: attempt.acknowledgementStatusCode || null,
        statusDescription:
          'Final TIRAMIS callback was not received before configured deadline',
        transactionStatus: transaction.status,
        attemptStatus: attempt.status,
        coverNoteReferenceNumber: null,
        policyReferenceNumber: null,
        stickerNumber: null,
        errorMessage:
          'Final TIRAMIS callback was not received before configured deadline',
        occurredAt: new Date().toISOString(),
      });

      this.logger.warn(
        `Final TIRAMIS callback overdue for requestId ${attempt.requestId}`,
      );
    }
  }

  private calculateNextRetryAt(currentRetryCount: number): Date {
    const baseDelaySeconds = Number(
      environment.TIRAMIS_RETRY_BASE_DELAY_SECONDS || 60,
    );

    const maxDelaySeconds = Number(
      environment.TIRAMIS_RETRY_MAX_DELAY_SECONDS || 900,
    );

    const delaySeconds = Math.min(
      baseDelaySeconds * Math.pow(2, currentRetryCount),
      maxDelaySeconds,
    );

    return new Date(Date.now() + delaySeconds * 1000);
  }

  private async recordEvent(params: {
    transactionId: string;
    attemptId: string;
    requestId: string;
    eventType: string;
    statusCode?: string | null;
    statusDesc?: string | null;
    rawPayload?: string | null;
  }) {
    await this.eventRepository.createEvent({
      transactionId: params.transactionId,
      attemptId: params.attemptId,
      requestId: params.requestId,
      eventType: params.eventType,
      statusCode: params.statusCode || null,
      statusDesc: params.statusDesc || null,
      rawPayload: params.rawPayload || null,
    });
  }
}
