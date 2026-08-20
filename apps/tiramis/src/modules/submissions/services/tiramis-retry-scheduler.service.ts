import { environment } from '@insurance-max/shared-config';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisPortalNotificationService } from '../../portal-notifications/services/tiramis-portal-notification.service';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisCoverPeriodService } from '../../shared/services/tiramis-cover-period.service';
import {
  TIRAMIS_ATTEMPT_STATUS,
  TIRAMIS_SUBMISSION_EVENT_TYPE,
  TIRAMIS_TRANSACTION_STATUS,
} from '../constants/tiramis-submission.constants';
import { TiramisSubmissionAttemptRepository } from '../repositories/tiramis-submission-attempt.repository';
import { TiramisSubmissionEventRepository } from '../repositories/tiramis-submission-event.repository';
import { TiramisTransactionRepository } from '../repositories/tiramis-transaction.repository';
import { TiramisResubmissionService } from './tiramis-resubmission.service';

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
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly signatureService: TiramisSignatureService,
    private readonly coverPeriodService: TiramisCoverPeriodService,
    private readonly portalNotificationService: TiramisPortalNotificationService,
    private readonly resubmissionService: TiramisResubmissionService,
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

  /**
   * Manually retries a single submission attempt regardless of the
   * TIRAMIS_RETRY_ENABLED flag, schedule, or retry-exhaustion state.
   * Used by the admin-triggered retry endpoint now that automatic
   * retrying is disabled.
   */
  async retryAttemptManually(attemptId: string) {
    const attempt = await this.attemptRepository.findById(attemptId);

    if (!attempt) {
      throw new NotFoundException(
        `TIRAMIS submission attempt not found for id: ${attemptId}`,
      );
    }

    const transaction = await this.transactionRepository.findById(
      attempt.transactionId,
    );

    if (!transaction) {
      throw new NotFoundException(
        `TIRAMIS transaction not found for attempt: ${attemptId}`,
      );
    }

    if (!attempt.requestXml) {
      throw new BadRequestException(
        'Cannot retry attempt because request XML is missing',
      );
    }

    const retryAttempt = await this.sendRetryAttempt(attempt, transaction);

    return {
      attemptId: retryAttempt.id,
      transactionId: transaction.id,
      requestId: retryAttempt.requestId,
      previousRequestId: retryAttempt.previousRequestId,
      status: retryAttempt.status,
      retryCount: retryAttempt.retryCount,
    };
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

    await this.sendRetryAttempt(attempt, transaction);
  }

  private async sendRetryAttempt(attempt: any, transaction: any) {
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

    const retryAttempt = await this.resubmissionService.prepareResubmission({
      transactionId: transaction.id,
      rootElement: attempt.rootElement,
      reason: `Retry after request ${attempt.requestId}`,
      requestIdPrefix: 'AIC',
    });

    if (!retryAttempt) {
      throw new BadRequestException('Unable to create a new retry attempt');
    }

    let requestXml = this.replaceXmlElement(
      attempt.requestXml,
      'RequestId',
      retryAttempt.requestId,
    );

    if (this.isCoverNoteService(transaction.serviceType)) {
      const normalizedRequest =
        this.coverPeriodService.normalizeRequestXml(requestXml);
      const callbackUrl =
        this.tiramisConfigService.getTiraCallbackUrlForConfiguration(
          configuration,
        );
      const requestWithCallback = this.replaceXmlElement(
        normalizedRequest.xml,
        'CallBackUrl',
        callbackUrl,
      );
      requestXml = requestWithCallback;
    }

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        configuration,
      );
    const parsedRequest = this.xmlParser.parseTiraMessage(requestXml);

    if (!parsedRequest.contentXml) {
      throw new BadRequestException(
        'Cannot retry attempt because signed request content is missing',
      );
    }

    const requestSignature = this.signatureService.signXmlContent({
      contentXml: parsedRequest.contentXml,
      privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
      privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
    });
    requestXml = this.xmlBuilder.buildSignedTiraMessageFromContent({
      contentXml: parsedRequest.contentXml,
      signature: requestSignature,
    });

    retryAttempt.retryCount = Number(attempt.retryCount || 0) + 1;
    retryAttempt.maxRetries = Number(attempt.maxRetries || 5);
    retryAttempt.lastRetryAt = new Date();
    retryAttempt.status = TIRAMIS_ATTEMPT_STATUS.SENT;
    retryAttempt.requestXml = requestXml;
    retryAttempt.requestSignature = requestSignature;

    await this.attemptRepository.save(retryAttempt);

    await this.recordEvent({
      transactionId: transaction.id,
      attemptId: retryAttempt.id,
      requestId: retryAttempt.requestId,
      eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.REQUEST_RETRY_SENT,
      statusDesc: `Retry ${retryAttempt.retryCount}/${retryAttempt.maxRetries}`,
    });

    try {
      const response = await this.httpClient.postXml({
        url: endpoint,
        headers,
        xml: requestXml,
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        await this.rescheduleRetry({
          attempt: retryAttempt,
          transaction,
          errorMessage: `TIRAMIS HTTP retry error: ${response.statusCode}`,
          rawPayload: response.rawXml,
        });

        return retryAttempt;
      }

      const acknowledgement = this.xmlParser.extractAcknowledgement(
        response.rawXml,
      );

      if (!acknowledgement.ok) {
        await this.rescheduleRetry({
          attempt: retryAttempt,
          transaction,
          errorMessage:
            acknowledgement.error ||
            'Unable to parse TIRAMIS acknowledgement during retry',
          rawPayload: response.rawXml,
        });

        return retryAttempt;
      }

      const isSuccess = await this.tiramisConfigService.isSuccessResponse(
        acknowledgement.statusCode!,
      );

      retryAttempt.acknowledgementId =
        acknowledgement.acknowledgementId || null;
      retryAttempt.acknowledgementStatusCode =
        acknowledgement.statusCode || null;
      retryAttempt.acknowledgementStatusDesc =
        acknowledgement.statusDesc || null;
      retryAttempt.acknowledgementXml = response.rawXml;
      retryAttempt.ackReceivedAt = new Date();
      retryAttempt.isRetryable = 0;
      retryAttempt.nextRetryAt = null;

      if (isSuccess) {
        retryAttempt.status = TIRAMIS_ATTEMPT_STATUS.ACK_SUCCESS;

        const callbackTimeoutMinutes = Number(
          environment.TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES || 30,
        );

        retryAttempt.finalCallbackDeadlineAt = new Date(
          Date.now() + callbackTimeoutMinutes * 60 * 1000,
        );

        transaction.status = TIRAMIS_TRANSACTION_STATUS.PROCESSING;
        transaction.lastError = null;
      } else {
        retryAttempt.status = TIRAMIS_ATTEMPT_STATUS.ACK_FAILED;
        retryAttempt.finalCallbackDeadlineAt = null;

        transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
        transaction.lastError =
          acknowledgement.statusDesc || 'TIRAMIS acknowledgement failed';
      }

      await this.attemptRepository.save(retryAttempt);
      await this.transactionRepository.save(transaction);

      await this.recordEvent({
        transactionId: transaction.id,
        attemptId: retryAttempt.id,
        requestId: retryAttempt.requestId,
        eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.ACK_RECEIVED,
        statusCode: acknowledgement.statusCode || null,
        statusDesc: acknowledgement.statusDesc || null,
        rawPayload: response.rawXml,
      });
    } catch (error: any) {
      await this.rescheduleRetry({
        attempt: retryAttempt,
        transaction,
        errorMessage:
          error?.message || 'Retry failed while sending request to TIRAMIS',
        rawPayload: error?.response?.data || null,
      });
    }

    return retryAttempt;
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
      errorMessage: params.errorMessage,
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
      errorMessage: params.errorMessage,
    });

    await this.publishFailureNotification({
      eventType: 'TIRAMIS_SUBMISSION_FAILED',
      transaction,
      attempt,
      statusDescription: params.errorMessage,
      errorMessage: params.errorMessage,
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

      const errorMessage =
        'Final TIRAMIS callback was not received before configured deadline';

      attempt.status = TIRAMIS_ATTEMPT_STATUS.FINAL_CALLBACK_OVERDUE;
      attempt.finalCallbackOverdueNotified = 1;
      attempt.errorMessage = errorMessage;
      transaction.status = TIRAMIS_TRANSACTION_STATUS.FAILED;
      transaction.lastError = errorMessage;

      await this.attemptRepository.save(attempt);
      await this.transactionRepository.save(transaction);

      await this.recordEvent({
        transactionId: transaction.id,
        attemptId: attempt.id,
        requestId: attempt.requestId,
        eventType: TIRAMIS_SUBMISSION_EVENT_TYPE.FINAL_CALLBACK_OVERDUE,
        statusDesc: errorMessage,
        errorMessage,
      });

      await this.publishFailureNotification({
        eventType: 'TIRAMIS_FINAL_CALLBACK_OVERDUE',
        transaction,
        attempt,
        statusCode: attempt.acknowledgementStatusCode || null,
        statusDescription: errorMessage,
        errorMessage,
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

  private replaceXmlElement(
    xml: string,
    elementName: string,
    value: string,
  ): string {
    return xml.replace(
      new RegExp(`(<${elementName}[^>]*>)[^<]*(</${elementName}>)`, 'gi'),
      `$1${value}$2`,
    );
  }

  private isCoverNoteService(serviceType: string): boolean {
    return [
      'COVER_NOTE_NON_MOTOR',
      'MOTOR_COVER_NOTE_NON_FLEET',
      'MOTOR_COVER_NOTE_FLEET',
    ].includes(serviceType);
  }

  private async recordEvent(params: {
    transactionId: string;
    attemptId: string;
    requestId: string;
    eventType: string;
    statusCode?: string | null;
    statusDesc?: string | null;
    errorMessage?: string | null;
    rawPayload?: string | null;
  }) {
    await this.eventRepository.createEvent({
      transactionId: params.transactionId,
      attemptId: params.attemptId,
      requestId: params.requestId,
      eventType: params.eventType,
      statusCode: params.statusCode || null,
      statusDesc: params.statusDesc || null,
      errorMessage: params.errorMessage || null,
      rawPayload: params.rawPayload || null,
    });
  }

  private async publishFailureNotification(params: {
    eventType: 'TIRAMIS_SUBMISSION_FAILED' | 'TIRAMIS_FINAL_CALLBACK_OVERDUE';
    transaction: any;
    attempt: any;
    statusCode?: string | null;
    statusDescription?: string | null;
    errorMessage?: string | null;
  }) {
    await this.portalNotificationService.publish({
      eventType: params.eventType,
      sourceService: 'tiramis-service',
      sourceCompanyId: params.transaction.sourceCompanyId || null,
      sourceModule: params.transaction.sourceModule || null,
      sourceRecordId: params.transaction.sourceRecordId || null,
      businessReference: params.transaction.businessReference || null,
      tiramisTransactionId: params.transaction.id,
      requestId: params.attempt.requestId,
      responseId: null,
      serviceType: params.transaction.serviceType || null,
      rootElement: params.attempt.rootElement || null,
      statusCode: params.statusCode || null,
      statusDescription: params.statusDescription || null,
      transactionStatus: params.transaction.status,
      attemptStatus: params.attempt.status,
      coverNoteReferenceNumber: null,
      policyReferenceNumber: null,
      stickerNumber: null,
      errorMessage: params.errorMessage || null,
      occurredAt: new Date().toISOString(),
    });
  }
}
