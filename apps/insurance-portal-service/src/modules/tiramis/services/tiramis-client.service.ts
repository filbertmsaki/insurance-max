import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { createHash } from 'crypto';
import { catchError, firstValueFrom, timeout } from 'rxjs';

import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisStatusQueryDto } from '../dto/tiramis-status-query.dto';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisNotificationService } from './tiramis-notification.service';

export const TIRAMIS_CLIENT = 'TIRAMIS_CLIENT';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  private readonly submitPatternMap: Record<TiramisRequestType, string> = {
    [TiramisRequestType.NON_MOTOR]: 'tiramis.non_motor.submit',
    [TiramisRequestType.MOTOR]: 'tiramis.motor.submit',
    [TiramisRequestType.MOTOR_FLEET]: 'tiramis.motor.submit',
    [TiramisRequestType.REINSURANCE]: 'tiramis.reinsurance.submit',
    [TiramisRequestType.POLICY]: 'tiramis.policy.submit',
    [TiramisRequestType.CLAIM_NOTIFICATION]:
      'tiramis.claim.notification.submit',
    [TiramisRequestType.CLAIM_INTIMATION]: 'tiramis.claim.intimation.submit',
    [TiramisRequestType.CLAIM_ASSESSMENT]: 'tiramis.claim.assessment.submit',
    [TiramisRequestType.DISCHARGE_VOUCHER]:
      'tiramis.claim.discharge_voucher.submit',
    [TiramisRequestType.CLAIM_PAYMENT]: 'tiramis.claim.payment.submit',
    [TiramisRequestType.CLAIM_REJECTION]: 'tiramis.claim.rejection.submit',
  };

  constructor(
    @Inject(TIRAMIS_CLIENT)
    private readonly tiramisClient: ClientProxy,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
  ) {}

  async submit(dto: SubmitTiramisDto, authContext?: any) {
    const pattern = this.submitPatternMap[dto.requestType];

    if (!pattern) {
      throw new BadRequestException(
        `Unsupported TIRAMIS request type: ${dto.requestType}`,
      );
    }

    const command = {
      sourceService: dto.sourceService || 'insurance-portal-service',
      sourceCompanyId:
        dto.sourceCompanyId ||
        authContext?.companyId ||
        authContext?.activeCompanyId ||
        authContext?.active_company_id ||
        null,
      sourceUserId: dto.sourceUserId || authContext?.userId || authContext?.id || null,
      sourceModule: dto.sourceModule || this.resolveSourceModule(dto),
      sourceRecordId: dto.sourceRecordId || null,
      policyId: dto.policyId || null,
      quotationId: dto.quotationId || null,
      businessReference:
        dto.businessReference || this.resolveBusinessReference(dto),
      requestType: dto.requestType,
      payload: dto.payload,
    };

    await this.auditService.log({
      action: TiramisAuditAction.SUBMIT_REQUESTED,
      requestType: dto.requestType,
      sourceService: command.sourceService,
      sourceCompanyId: command.sourceCompanyId,
      sourceUserId: command.sourceUserId,
      sourceModule: command.sourceModule,
      sourceRecordId: command.sourceRecordId,
      businessReference: command.businessReference,
      authContext,
      metadata: {
        forceResubmit: dto.forceResubmit,
        returnExisting: dto.returnExisting,
      },
    });

    const idempotencyKey = this.buildIdempotencyKey({
      sourceCompanyId: command.sourceCompanyId,
      requestType: dto.requestType,
      sourceModule: command.sourceModule,
      sourceRecordId: command.sourceRecordId,
      businessReference: command.businessReference,
    });

    const existingSubmission =
      await this.trackingRepository.findExistingActiveSubmission({
        sourceCompanyId: command.sourceCompanyId,
        requestType: dto.requestType,
        sourceModule: command.sourceModule,
        sourceRecordId: command.sourceRecordId,
        businessReference: command.businessReference,
        idempotencyKey,
      });

    if (existingSubmission) {
      await this.auditService.logFromTracking({
        action: TiramisAuditAction.DUPLICATE_PREVENTED,
        tracking: existingSubmission,
        success: true,
        authContext,
        metadata: {
          attemptedRequestType: dto.requestType,
          attemptedSourceModule: command.sourceModule,
          attemptedSourceRecordId: command.sourceRecordId,
          attemptedBusinessReference: command.businessReference,
        },
      });

      if (dto.returnExisting !== false) {
        return {
          duplicatePrevented: true,
          message:
            'This business record already has an active or successful TIRAMIS submission.',
          localTrackingId: existingSubmission.id,
          localStatus: existingSubmission.status,
          existingTracking: existingSubmission,
        };
      }

      throw new BadRequestException({
        message:
          'Duplicate TIRAMIS submission prevented. This business record already has an active or successful submission.',
        existingTrackingId: existingSubmission.id,
        existingStatus: existingSubmission.status,
      });
    }

    const latestPreviousSubmission =
      await this.trackingRepository.findLatestSubmissionForSameBusiness({
        sourceCompanyId: command.sourceCompanyId,
        requestType: dto.requestType,
        sourceModule: command.sourceModule,
        sourceRecordId: command.sourceRecordId,
        businessReference: command.businessReference,
      });

    let tracking: any;
    try {
      tracking = await this.trackingRepository.save(
        this.trackingRepository.create({
          requestType: dto.requestType,
          status: TiramisSubmissionStatus.PENDING,
          sourceService: command.sourceService,
          sourceCompanyId: command.sourceCompanyId,
          sourceUserId: command.sourceUserId,
          sourceModule: command.sourceModule,
          sourceRecordId: command.sourceRecordId,
          policyId: command.policyId,
          quotationId: command.quotationId,
          businessReference: command.businessReference,
          idempotencyKey,
          duplicateOfTrackingId: latestPreviousSubmission?.id || null,
          resubmissionCount: latestPreviousSubmission
            ? (latestPreviousSubmission.resubmissionCount || 0) + 1
            : 0,
          forceResubmitted: !!dto.forceResubmit,
          requestPayload: dto.payload,
        }),
      );
    } catch (error: any) {
      if (
        String(error?.message || '').includes(
          'uq_tiramis_active_submission_idempotency',
        )
      ) {
        throw new BadRequestException(
          'Duplicate TIRAMIS submission prevented by database idempotency rule.',
        );
      }

      throw error;
    }

    await this.businessRecordSyncService.syncFromTracking(tracking);

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.SUBMIT_REQUESTED,
      tracking,
      success: true,
      authContext,
      metadata: {
        idempotencyKey,
        payloadStored: !!dto.payload,
      },
    });

    try {
      this.logger.log(
        `Submitting ${dto.requestType} to tiramis-service using pattern ${pattern}`,
      );

      const response = await this.send(pattern, command);

      const sentTracking = await this.trackingRepository.markSent(
        tracking.id,
        response,
      );
      await this.businessRecordSyncService.syncFromTracking(sentTracking);

      const acknowledgementCode =
        response?.acknowledgement?.statusCode ||
        response?.tiraResponse?.acknowledgementStatusCode ||
        response?.tiraResponse?.AcknowledgementStatusCode ||
        null;

      let acknowledgedTracking: any = null;
      if (acknowledgementCode) {
        acknowledgedTracking = await this.trackingRepository.markAcknowledged(
          tracking.id,
          response,
        );
        await this.businessRecordSyncService.syncFromTracking(acknowledgedTracking);
      }

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.SUBMIT_SUCCESS,
        tracking: acknowledgedTracking || sentTracking,
        statusBefore: TiramisSubmissionStatus.PENDING,
        success: true,
        authContext,
        metadata: {
          acknowledgementCode,
        },
      });

      return {
        localTrackingId: tracking.id,
        localStatus: acknowledgementCode
          ? TiramisSubmissionStatus.ACKNOWLEDGED
          : TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
        tiramis: response,
      };
    } catch (error) {
      const failedTracking = await this.trackingRepository.markFailed(
        tracking.id,
        error,
        {
          retryable: this.isRetryableError(error),
          maxRetryAttempts: Number(process.env.TIRAMIS_RETRY_MAX_ATTEMPTS || 5),
        },
      );
      await this.businessRecordSyncService.syncFromTracking(failedTracking);

      await this.notificationService.notifySubmissionFailed({
        tracking: failedTracking,
        error,
        metadata: {
          retryable: failedTracking?.isRetryable,
          requestType: dto.requestType,
        },
      });

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.SUBMIT_FAILED,
        tracking: failedTracking,
        statusBefore: TiramisSubmissionStatus.PENDING,
        success: false,
        error,
        authContext,
        metadata: {
          retryable: failedTracking?.isRetryable,
        },
      });

      throw error;
    }
  }

  async getStatus(query: TiramisStatusQueryDto, authContext?: any) {
    this.assertStatusQuery(query);

    await this.auditService.log({
      action: TiramisAuditAction.MANUAL_STATUS_CHECK,
      businessReference: query.businessReference || null,
      authContext,
      metadata: {
        query,
      },
    });

    return this.send('tiramis.submission.status', {
      transactionId: query.transactionId || null,
      requestId: query.requestId || null,
      businessReference: query.businessReference || null,
      includePayload: !!query.includePayload,
    });
  }

  async getTrace(query: TiramisStatusQueryDto, authContext?: any) {
    this.assertStatusQuery(query);

    await this.auditService.log({
      action: TiramisAuditAction.MANUAL_TRACE_CHECK,
      businessReference: query.businessReference || null,
      authContext,
      metadata: {
        query,
      },
    });

    return this.send('tiramis.submission.trace', {
      transactionId: query.transactionId || null,
      requestId: query.requestId || null,
      businessReference: query.businessReference || null,
      includePayload: !!query.includePayload,
    });
  }

  async getLocalTrackingById(id: string) {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS local tracking record not found');
    }

    return tracking;
  }

  async getLocalTrackingByBusinessReference(businessReference: string) {
    return this.trackingRepository.findByBusinessReference(businessReference);
  }

  async getRecentLocalTracking(limit = 50) {
    return this.trackingRepository.findRecent(limit);
  }

  async resendTrackingRecord(localTrackingId: string) {
    const tracking = await this.trackingRepository.findById(localTrackingId);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS local tracking record not found');
    }

    if (!tracking.requestPayload || Object.keys(tracking.requestPayload).length === 0) {
      throw new BadRequestException(
        'Cannot retry TIRAMIS submission because requestPayload is empty',
      );
    }

    const requestType = tracking.requestType as TiramisRequestType;
    const pattern = this.submitPatternMap[requestType];

    if (!pattern) {
      throw new BadRequestException(
        `Unsupported TIRAMIS request type for retry: ${tracking.requestType}`,
      );
    }

    const command = {
      sourceService: tracking.sourceService || 'insurance-portal-service',
      sourceCompanyId: tracking.sourceCompanyId || null,
      sourceUserId: tracking.sourceUserId || null,
      sourceModule:
        tracking.sourceModule ||
        this.resolveSourceModule({
          requestType,
          payload: tracking.requestPayload,
        } as any),
      sourceRecordId: tracking.sourceRecordId || null,
      policyId: tracking.policyId || null,
      quotationId: tracking.quotationId || null,
      businessReference:
        tracking.businessReference ||
        this.resolveBusinessReference({
          requestType,
          payload: tracking.requestPayload,
        } as any),
      requestType,
      payload: tracking.requestPayload,
    };

    this.logger.log(
      `Retrying ${tracking.requestType} to tiramis-service using pattern ${pattern}`,
    );

    return this.send(pattern, command);
  }

  async checkDuplicate(params: {
    requestType: TiramisRequestType;
    sourceCompanyId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    const idempotencyKey = this.buildIdempotencyKey({
      sourceCompanyId: params.sourceCompanyId || null,
      requestType: params.requestType,
      sourceModule: params.sourceModule || null,
      sourceRecordId: params.sourceRecordId || null,
      businessReference: params.businessReference || null,
    });

    const existing =
      await this.trackingRepository.findExistingActiveSubmission({
        sourceCompanyId: params.sourceCompanyId || null,
        requestType: params.requestType,
        sourceModule: params.sourceModule || null,
        sourceRecordId: params.sourceRecordId || null,
        businessReference: params.businessReference || null,
        idempotencyKey,
      });

    return {
      duplicateExists: !!existing,
      idempotencyKey,
      existingTracking: existing || null,
    };
  }

  private async send(pattern: string, payload: Record<string, any>) {
    try {
      return await firstValueFrom(
        this.tiramisClient.send(pattern, payload).pipe(
          timeout(Number(process.env.TIRAMIS_TCP_TIMEOUT_MS || 60000)),
          catchError((error) => {
            throw error;
          }),
        ),
      );
    } catch (error: any) {
      if (error?.name === 'TimeoutError') {
        throw new RequestTimeoutException(
          'TIRAMIS service request timeout. Please check tiramis-service connection.',
        );
      }

      const message =
        error?.message ||
        error?.response?.message ||
        error?.error?.message ||
        'Failed to communicate with tiramis-service';

      throw new BadRequestException({
        message,
        details: error?.response || error?.error || null,
      });
    }
  }

  private assertStatusQuery(query: TiramisStatusQueryDto) {
    if (!query.transactionId && !query.requestId && !query.businessReference) {
      throw new BadRequestException(
        'Provide transactionId, requestId, or businessReference',
      );
    }
  }

  private resolveSourceModule(dto: SubmitTiramisDto): string {
    switch (dto.requestType) {
      case TiramisRequestType.NON_MOTOR:
      case TiramisRequestType.MOTOR:
      case TiramisRequestType.MOTOR_FLEET:
        return 'cover-notes';

      case TiramisRequestType.REINSURANCE:
        return 'reinsurance';

      case TiramisRequestType.POLICY:
        return 'policies';

      case TiramisRequestType.CLAIM_NOTIFICATION:
      case TiramisRequestType.CLAIM_INTIMATION:
      case TiramisRequestType.CLAIM_ASSESSMENT:
      case TiramisRequestType.DISCHARGE_VOUCHER:
      case TiramisRequestType.CLAIM_PAYMENT:
      case TiramisRequestType.CLAIM_REJECTION:
        return 'claims';

      default:
        return 'tiramis';
    }
  }

  private resolveBusinessReference(dto: SubmitTiramisDto): string | null {
    const payload = dto.payload || {};

    return (
      payload.coverNoteNumber ||
      payload.fleet?.fleetId ||
      payload.coverNoteReferenceNumber ||
      payload.policyNumber ||
      payload.claimNotificationNumber ||
      payload.claimIntimationNumber ||
      payload.claimAssessmentNumber ||
      payload.dischargeVoucherNumber ||
      payload.claimPaymentNumber ||
      payload.claimRejectionNumber ||
      null
    );
  }

  private isRetryableError(error: any) {
    const message = String(
      error?.message || error?.response?.message || error?.error?.message || '',
    ).toLowerCase();

    const statusCode =
      error?.status || error?.response?.statusCode || error?.response?.status || null;

    if (statusCode && [408, 429, 500, 502, 503, 504].includes(Number(statusCode))) {
      return true;
    }

    return [
      'timeout',
      'timed out',
      'econnrefused',
      'econnreset',
      'etimedout',
      'socket hang up',
      'no response',
      'connection refused',
      'failed to communicate with tiramis-service',
      'tiramis service request timeout',
    ].some((keyword) => message.includes(keyword));
  }

  private buildIdempotencyKey(params: {
    sourceCompanyId?: string | null;
    requestType: string;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    const raw = [
      params.sourceCompanyId || 'no-company',
      params.requestType,
      params.sourceModule || 'no-module',
      params.sourceRecordId || 'no-record',
      params.businessReference || 'no-business-reference',
    ]
      .map((value) => String(value).trim().toLowerCase())
      .join('|');

    return createHash('sha256').update(raw).digest('hex');
  }
}
