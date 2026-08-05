import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { unwrapApiResponse } from '@insurance-max/contracts';
import {
  HTTP_HEADERS,
  RequestContextService,
  ServiceTokenService,
} from '@insurance-max/shared-kernel';

import { SubmitTiramisDto } from '../dto/submit-tiramis.dto';
import { TiramisStatusQueryDto } from '../dto/tiramis-status-query.dto';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import {
  buildDuplicateMessage,
  buildTiramisBusinessFingerprint,
  buildTiramisIdempotencyKey,
} from '../utils/tiramis-idempotency.util';
import { isRetryableError } from '../utils/tiramis-retry.util';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisNotificationService } from './tiramis-notification.service';
import {
  TIRAMIS_MESSAGE_PATTERNS,
  TIRAMIS_SUBMIT_PATTERN_BY_REQUEST_TYPE,
} from '../constants/tiramis-message-patterns.constant';

export const TIRAMIS_CLIENT = 'TIRAMIS_CLIENT';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  private readonly submitPatternMap = TIRAMIS_SUBMIT_PATTERN_BY_REQUEST_TYPE;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
    private readonly serviceTokenService: ServiceTokenService,
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
      sourceUserId:
        dto.sourceUserId || authContext?.userId || authContext?.id || null,
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

    const businessFingerprint = buildTiramisBusinessFingerprint({
      sourceCompanyId: command.sourceCompanyId,
      requestType: dto.requestType,
      sourceModule: command.sourceModule,
      sourceRecordId: command.sourceRecordId,
      businessReference: command.businessReference,
    });

    const idempotencyKey = buildTiramisIdempotencyKey({
      sourceCompanyId: command.sourceCompanyId,
      requestType: dto.requestType,
      sourceModule: command.sourceModule,
      sourceRecordId: command.sourceRecordId,
      businessReference: command.businessReference,
      forceResubmit: !!dto.forceResubmit,
    });

    if (!dto.forceResubmit) {
      const existingDuplicate =
        await this.trackingRepository.findActiveDuplicateCandidate({
          sourceCompanyId: command.sourceCompanyId,
          businessFingerprint,
          idempotencyKey,
          requestType: dto.requestType,
          sourceModule: command.sourceModule,
          sourceRecordId: command.sourceRecordId,
          businessReference: command.businessReference,
        });

      if (existingDuplicate) {
        const reason = buildDuplicateMessage({
          requestType: dto.requestType,
          sourceModule: command.sourceModule,
          sourceRecordId: command.sourceRecordId,
          businessReference: command.businessReference,
          existingTrackingId: existingDuplicate.id,
        });

        await this.auditService.logFromTracking({
          action: TiramisAuditAction.DUPLICATE_PREVENTED,
          tracking: existingDuplicate,
          statusBefore: existingDuplicate.status,
          success: false,
          authContext,
          metadata: {
            reason,
            duplicateOfTrackingId: existingDuplicate.id,
            requestType: dto.requestType,
            sourceModule: command.sourceModule,
            sourceRecordId: command.sourceRecordId,
            businessReference: command.businessReference,
          },
        });

        await this.notificationService.notifyDuplicatePrevented({
          tracking: existingDuplicate,
          existingTracking: existingDuplicate,
          reason,
          metadata: {
            requestType: dto.requestType,
            sourceModule: command.sourceModule,
            sourceRecordId: command.sourceRecordId,
            businessReference: command.businessReference,
          },
        });

        if (dto.returnExisting) {
          return {
            success: true,
            duplicatePrevented: true,
            returnedExisting: true,
            message: reason,
            localTrackingId: existingDuplicate.id,
            localStatus: existingDuplicate.status,
            tracking: existingDuplicate,
            tiramis: existingDuplicate.tiramisResponsePayload || null,
          };
        }

        throw new ConflictException({
          message: reason,
          duplicatePrevented: true,
          existingTrackingId: existingDuplicate.id,
          existingStatus: existingDuplicate.status,
          hint: 'Use returnExisting=true to get the existing tracking record, or forceResubmit=true to submit again.',
        });
      }
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
          businessFingerprint,
          idempotencyKey,
          duplicateOfTrackingId: latestPreviousSubmission?.id || null,
          duplicateCheckedAt: new Date(),
          forceResubmit: !!dto.forceResubmit,
          returnExisting: !!dto.returnExisting,
          resubmissionCount: latestPreviousSubmission
            ? (latestPreviousSubmission.resubmissionCount || 0) + 1
            : 0,
          forceResubmitted: !!dto.forceResubmit,
          requestPayload: dto.payload,
        }),
      );
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();

      if (
        message.includes('uq_tiramis_active_submission_idempotency') ||
        message.includes('uq_tiramis_tracking_active_idempotency_key') ||
        message.includes('uq_tiramis_tracking_active_business_fingerprint')
      ) {
        const existingDuplicate =
          await this.trackingRepository.findActiveDuplicateCandidate({
            sourceCompanyId: command.sourceCompanyId,
            businessFingerprint,
            idempotencyKey,
            requestType: dto.requestType,
            sourceModule: command.sourceModule,
            sourceRecordId: command.sourceRecordId,
            businessReference: command.businessReference,
          });

        const reason = buildDuplicateMessage({
          requestType: dto.requestType,
          sourceModule: command.sourceModule,
          sourceRecordId: command.sourceRecordId,
          businessReference: command.businessReference,
          existingTrackingId: existingDuplicate?.id || null,
        });

        if (existingDuplicate) {
          await this.notificationService.notifyDuplicatePrevented({
            tracking: existingDuplicate,
            existingTracking: existingDuplicate,
            reason,
            metadata: {
              requestType: dto.requestType,
              sourceModule: command.sourceModule,
              sourceRecordId: command.sourceRecordId,
              businessReference: command.businessReference,
              viaConstraintViolation: true,
            },
          });
        }

        if (dto.returnExisting && existingDuplicate) {
          return {
            success: true,
            duplicatePrevented: true,
            returnedExisting: true,
            message: reason,
            localTrackingId: existingDuplicate.id,
            localStatus: existingDuplicate.status,
            tracking: existingDuplicate,
            tiramis: existingDuplicate.tiramisResponsePayload || null,
          };
        }

        throw new ConflictException({
          message: reason,
          duplicatePrevented: true,
          existingTrackingId: existingDuplicate?.id || null,
          existingStatus: existingDuplicate?.status || null,
          hint: 'Use returnExisting=true to get the existing tracking record, or forceResubmit=true to submit again.',
        });
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

      const startedAt = Date.now();

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.CLIENT_REQUEST_SENT,
        tracking,
        statusBefore: tracking.status,
        success: true,
        authContext,
        metadata: {
          pattern,
          command: {
            requestType: command.requestType,
            sourceModule: command.sourceModule,
            sourceRecordId: command.sourceRecordId,
            businessReference: command.businessReference,
          },
        },
      });

      const response = await this.send(pattern, command);

      const updatedTracking =
        await this.trackingRepository.markSubmittedResponse(
          tracking.id,
          response,
        );

      await this.businessRecordSyncService.syncFromTracking(updatedTracking);

      const failedLocally = this.isFailureLocalStatus(updatedTracking?.status);

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.CLIENT_RESPONSE_RECEIVED,
        tracking: updatedTracking,
        statusBefore: tracking.status,
        success: !failedLocally,
        authContext,
        durationMs: Date.now() - startedAt,
        metadata: {
          pattern,
          resolvedStatus: updatedTracking?.status,
          acknowledgementCode: updatedTracking?.acknowledgementStatusCode,
          finalResponseCode: updatedTracking?.finalResponseStatusCode,
        },
        responsePayloadSnapshot: response,
      });

      if (failedLocally) {
        await this.notificationService.notifySubmissionFailed({
          tracking: updatedTracking,
          error: {
            message:
              updatedTracking?.lastErrorMessage || 'TIRAMIS submission failed',
          },
          metadata: {
            requestType: dto.requestType,
            status: updatedTracking?.status,
          },
        });
      }

      await this.auditService.logFromTracking({
        action: failedLocally
          ? TiramisAuditAction.SUBMIT_FAILED
          : TiramisAuditAction.SUBMIT_SUCCESS,
        tracking: updatedTracking,
        statusBefore: TiramisSubmissionStatus.PENDING,
        success: !failedLocally,
        authContext,
        metadata: {
          acknowledgementCode: updatedTracking?.acknowledgementStatusCode,
          finalResponseCode: updatedTracking?.finalResponseStatusCode,
          resolvedStatus: updatedTracking?.status,
        },
      });

      return {
        localTrackingId: tracking.id,
        localStatus: updatedTracking?.status,
        tracking: updatedTracking,
        tiramis: response,
      };
    } catch (error: any) {
      const retryable = isRetryableError(error);
      let failedTracking: any = null;

      if (tracking?.id) {
        if (retryable) {
          failedTracking = await this.trackingRepository.markRetryScheduled(
            tracking.id,
            {
              error,
              maxRetryAttempts: Number(
                this.configService.get('TIRAMIS_RETRY_MAX_ATTEMPTS') || 3,
              ),
            },
          );
        } else {
          failedTracking = await this.trackingRepository.markFailed(
            tracking.id,
            error,
          );
        }
      }

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
          retryable,
        },
      });

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.CLIENT_REQUEST_FAILED,
        tracking: failedTracking || tracking,
        statusBefore: tracking?.status || TiramisSubmissionStatus.PENDING,
        success: false,
        error,
        authContext,
        metadata: {
          retryable,
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

    return this.send(TIRAMIS_MESSAGE_PATTERNS.STATUS, {
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

    return this.send(TIRAMIS_MESSAGE_PATTERNS.TRACE, {
      transactionId: query.transactionId || null,
      requestId: query.requestId || null,
      businessReference: query.businessReference || null,
      includePayload: !!query.includePayload,
    });
  }

  async checkTiramisServiceHealth() {
    return this.send(TIRAMIS_MESSAGE_PATTERNS.HEALTH, {
      sourceService: 'insurance-portal-service',
      checkedAt: new Date().toISOString(),
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

    if (
      !tracking.requestPayload ||
      Object.keys(tracking.requestPayload).length === 0
    ) {
      throw new BadRequestException(
        'Cannot retry TIRAMIS submission because requestPayload is empty',
      );
    }

    const requestType = tracking.requestType;
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
        }),
      sourceRecordId: tracking.sourceRecordId || null,
      policyId: tracking.policyId || null,
      quotationId: tracking.quotationId || null,
      businessReference:
        tracking.businessReference ||
        this.resolveBusinessReference({
          requestType,
          payload: tracking.requestPayload,
        }),
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
    const businessFingerprint = buildTiramisBusinessFingerprint({
      sourceCompanyId: params.sourceCompanyId || null,
      requestType: params.requestType,
      sourceModule: params.sourceModule || null,
      sourceRecordId: params.sourceRecordId || null,
      businessReference: params.businessReference || null,
    });

    const idempotencyKey = buildTiramisIdempotencyKey({
      sourceCompanyId: params.sourceCompanyId || null,
      requestType: params.requestType,
      sourceModule: params.sourceModule || null,
      sourceRecordId: params.sourceRecordId || null,
      businessReference: params.businessReference || null,
    });

    const existing = await this.trackingRepository.findActiveDuplicateCandidate(
      {
        sourceCompanyId: params.sourceCompanyId || null,
        businessFingerprint,
        idempotencyKey,
        requestType: params.requestType,
        sourceModule: params.sourceModule || null,
        sourceRecordId: params.sourceRecordId || null,
        businessReference: params.businessReference || null,
      },
    );

    return {
      duplicateExists: !!existing,
      businessFingerprint,
      idempotencyKey,
      existingTracking: existing || null,
    };
  }

  private async send(pattern: string, payload: Record<string, unknown>) {
    try {
      const route = this.httpRouteForPattern(pattern);

      const isQuery =
        pattern === TIRAMIS_MESSAGE_PATTERNS.HEALTH ||
        pattern === TIRAMIS_MESSAGE_PATTERNS.STATUS ||
        pattern === TIRAMIS_MESSAGE_PATTERNS.TRACE;

      const requestId = this.requestContextService.getRequestId();

      const correlationId =
        this.requestContextService.getCorrelationId() || requestId;

      const sourceService = this.configService.getOrThrow<string>(
        'tiramisClient.sourceService',
      );

      const serviceToken = this.serviceTokenService.issue('tiramis-service', [
        'tiramis:invoke',
      ]);

      const response = await firstValueFrom(
        this.httpService.request({
          method: isQuery ? 'GET' : 'POST',

          url: route.path,

          params: isQuery ? payload : undefined,

          data: isQuery ? undefined : this.httpPayload(pattern, payload),

          validateStatus: () => true,

          headers: {
            Accept: 'application/json',

            Authorization: `Bearer ${serviceToken}`,

            [HTTP_HEADERS.SOURCE_SERVICE]: sourceService,

            ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),

            ...(correlationId
              ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
              : {}),
          },
        }),
      );

      if (response.status < 200 || response.status >= 300) {
        const error = new Error(
          `TIRAMIS HTTP request failed with status ${response.status}`,
        ) as Error & {
          response?: {
            data: unknown;
            status: number;
          };
        };

        error.response = { data: response.data, status: response.status };
        throw error;
      }

      return unwrapApiResponse(response.data);
    } catch (error: unknown) {
      const requestError = error as {
        code?: string;
        name?: string;
        message?: string;
        response?: {
          data?: unknown;
          status?: number;
        };
      };

      if (
        requestError.code === 'ECONNABORTED' ||
        requestError.name === 'TimeoutError'
      ) {
        throw new RequestTimeoutException({
          code: 'TIRAMIS_SERVICE_TIMEOUT',

          message:
            'The TIRAMIS service did not respond within the configured timeout.',
        });
      }

      const response = this.extractTiramisErrorResponse(requestError);
      const validationErrors = this.extractValidationErrors(response);

      const message =
        this.extractTiramisErrorMessage(response) ||
        requestError.message ||
        'Failed to communicate with the TIRAMIS service';

      throw new BadRequestException({
        code: 'TIRAMIS_SERVICE_REQUEST_FAILED',

        message,

        errors: validationErrors.map((validationMessage) => ({
          message: validationMessage,
        })),

        details: response && typeof response === 'object' ? response : null,
      });
    }
  }

  private httpPayload(pattern: string, command: Record<string, any>) {
    const payload = command.payload || command;

    if (pattern === TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_FLEET) {
      return { ...payload, isFleet: true };
    }

    return payload;
  }

  private httpRouteForPattern(pattern: string): { path: string } {
    const routes: Record<string, string> = {
      [TIRAMIS_MESSAGE_PATTERNS.HEALTH]: '/api/health',
      [TIRAMIS_MESSAGE_PATTERNS.STATUS]: '/api/tiramis/submissions/status',
      [TIRAMIS_MESSAGE_PATTERNS.TRACE]: '/api/tiramis/submissions/trace',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NON_MOTOR]:
        '/api/tiramis/non-motor/cover-notes/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR]: '/api/tiramis/motor/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_FLEET]:
        '/api/tiramis/motor/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_REINSURANCE]:
        '/api/tiramis/reinsurance/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_POLICY]: '/api/tiramis/policies/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_NOTIFICATION]:
        '/api/tiramis/claims/notification/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_INTIMATION]:
        '/api/tiramis/claims/intimation/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_ASSESSMENT]:
        '/api/tiramis/claims/assessment/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_DISCHARGE_VOUCHER]:
        '/api/tiramis/claims/discharge-voucher/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_PAYMENT]:
        '/api/tiramis/claims/payment/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_REJECTION]:
        '/api/tiramis/claims/rejection/submit',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COVER_NOTE_VERIFICATION]:
        '/api/tiramis/verifications/cover-note',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_VERIFICATION]:
        '/api/tiramis/verifications/motor',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NIN_VERIFICATION]:
        '/api/tiramis/verifications/nin',
      [TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COMPANY_VERIFICATION]:
        '/api/tiramis/verifications/company',
    };

    const path = routes[pattern];
    if (!path) {
      throw new BadRequestException(
        `Unsupported TIRAMIS HTTP route: ${pattern}`,
      );
    }

    return { path };
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

      case TiramisRequestType.COVER_NOTE_VERIFICATION:
      case TiramisRequestType.MOTOR_VERIFICATION:
      case TiramisRequestType.NIN_VERIFICATION:
      case TiramisRequestType.COMPANY_VERIFICATION:
        return 'verifications';

      default:
        return 'tiramis';
    }
  }

  private resolveBusinessReference(dto: SubmitTiramisDto): string | null {
    const payload = dto.payload || {};

    return (
      payload.coverNoteNumber ||
      payload.coverNoteReferenceNumber ||
      payload.coverNoteReferenceNumbers?.[0] ||
      payload.stickerNumber ||
      payload.fleet?.fleetId ||
      payload.policyNumber ||
      payload.claimNotificationNumber ||
      payload.claimIntimationNumber ||
      payload.claimAssessmentNumber ||
      payload.dischargeVoucherNumber ||
      payload.claimPaymentNumber ||
      payload.claimRejectionNumber ||
      payload.reinsuranceReferenceNumber ||
      payload.nin ||
      payload.NIN ||
      payload.tin ||
      payload.TIN ||
      payload.companyName ||
      payload.registrationNumber ||
      payload.incorporationCertificateNumber ||
      payload.motorRegistrationNumber ||
      payload.motorChassisNumber ||
      payload.chassisNumber ||
      null
    );
  }

  private isFailureLocalStatus(status?: string | null): boolean {
    return [
      TiramisSubmissionStatus.ACK_FAILED,
      TiramisSubmissionStatus.FINAL_FAILED,
      TiramisSubmissionStatus.FAILED,
      TiramisSubmissionStatus.RETRY_EXHAUSTED,
      TiramisSubmissionStatus.CALLBACK_OVERDUE,
    ].includes(status as TiramisSubmissionStatus);
  }

  private extractTiramisErrorResponse(error: unknown): unknown {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const candidate = error as {
      response?: {
        data?: unknown;
      };
      error?: unknown;
      details?: unknown;
    };

    return (
      candidate.response?.data ?? candidate.error ?? candidate.details ?? null
    );
  }

  private extractTiramisErrorMessage(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const record = response as Record<string, unknown>;

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (record.error && typeof record.error === 'object') {
      const error = record.error as Record<string, unknown>;

      if (typeof error.message === 'string') {
        return error.message;
      }
    }

    return null;
  }

  private extractValidationErrors(response: any): string[] {
    const validationErrors =
      response?.validation_errors ||
      response?.errors ||
      response?.details?.validation_errors ||
      response?.details?.errors ||
      response?.error?.validation_errors ||
      response?.error?.errors;

    if (!validationErrors) {
      return [];
    }

    if (Array.isArray(validationErrors)) {
      return validationErrors.map((item) => String(item));
    }

    return [String(validationErrors)];
  }
}
