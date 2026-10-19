import { HttpService } from '@nestjs/axios';
import { environment } from '@insurance-max/shared-config';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import {
  TiramisIntegrationCommand,
  TiramisIntegrationSchemaVersion,
  TiramisIntegrationStatus,
  unwrapApiResponse,
  type ServiceFinanceContext,
  type ServiceInsuredDataContext,
  type ServicePricingContext,
  type ServiceProductContext,
  type ServiceQuotationGateContext,
  type TiramisSubmissionAcceptance,
  type TiramisSubmissionContext,
  type TiramisSubmissionEnvelope,
} from '@insurance-max/contracts';
import {
  HTTP_HEADERS,
  RequestContextService,
} from '@insurance-max/shared-kernel';
import type { AuthenticatedUser } from '@insurance-max/portal-shared';

import { TiramisServiceScopes } from '../constants/tiramis-service-scopes.constant';
import { OrganizationContextService } from '../../shared/organization/organization-context.service';
import { TiramisPlatformAccessService } from '../../shared/organization/tiramis-platform-access.service';

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
import { resolveTiramisPortalWebhookUrl } from '../utils/tiramis-portal-webhook-url.util';
import {
  mapLegacyRequestTypeToCanonical,
  mapLegacyStatusToCanonical,
} from '../utils/tiramis-canonical-mapping.util';
import { TiramisAuditService } from './tiramis-audit.service';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisEnvelopeService } from './tiramis-envelope.service';
import { TiramisServiceApiKeyVaultService } from './tiramis-service-api-key-vault.service';
import { TiramisNotificationService } from './tiramis-notification.service';
import { TiramisCompanyConfigurationEntity } from '../entities/tiramis-company-configuration.entity';
import {
  TIRAMIS_MESSAGE_PATTERNS,
  TIRAMIS_SUBMIT_PATTERN_BY_REQUEST_TYPE,
} from '../constants/tiramis-message-patterns.constant';

/** Per-company secrets stored in TIRAMIS (the TIRA system secrets live in its env). */
export type TiramisSecretName = 'portalWebhookApiKey';

export type TiramisSecretStatus =
  | 'MISSING'
  | 'PLAINTEXT'
  | 'OK'
  | 'PREVIOUS_KEY'
  | 'UNREADABLE';

export interface TiramisSecretHealth {
  configurationId: string;
  environment: string;
  healthy: boolean;
  secrets: Array<{
    name: TiramisSecretName;
    label: string;
    status: TiramisSecretStatus;
  }>;
  /** Platform-wide TIRA secrets, configured in TIRAMIS's environment. */
  systemSecrets?: Array<{
    name: string;
    label: string;
    source: string;
    status: 'OK' | 'MISSING';
  }>;
}

export const TIRAMIS_CLIENT = 'TIRAMIS_CLIENT';
export const TIRAMIS_BUSINESS_RECORD_SYNC_SERVICE =
  'TIRAMIS_BUSINESS_RECORD_SYNC_SERVICE';

@Injectable()
export class TiramisClientService {
  private readonly logger = new Logger(TiramisClientService.name);

  private readonly submitPatternMap = TIRAMIS_SUBMIT_PATTERN_BY_REQUEST_TYPE;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    @Inject(TIRAMIS_BUSINESS_RECORD_SYNC_SERVICE)
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
    private readonly notificationService: TiramisNotificationService,
    private readonly organizationContextService: OrganizationContextService,
    private readonly tiramisEnvelopeService: TiramisEnvelopeService,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly companyConfigurationRepository: Repository<TiramisCompanyConfigurationEntity>,
    private readonly platformAccess: TiramisPlatformAccessService,
  ) {}

  async submit(dto: SubmitTiramisDto, authContext?: any) {
    const pattern = this.submitPatternMap[dto.requestType];

    if (!pattern) {
      throw new BadRequestException(
        `Unsupported TIRAMIS request type: ${dto.requestType}`,
      );
    }
    await this.assertConfiguredIntegrationPermission(
      authContext?.companyId ?? authContext?.activeCompanyId,
      pattern,
    );

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

    const latestPreviousSubmission =
      await this.trackingRepository.findLatestSubmissionForSameBusiness({
        sourceCompanyId: command.sourceCompanyId,
        requestType: dto.requestType,
        sourceModule: command.sourceModule,
        sourceRecordId: command.sourceRecordId,
        businessReference: command.businessReference,
      });

    const isMotorVerificationResubmission =
      dto.requestType === TiramisRequestType.MOTOR_VERIFICATION &&
      dto.forceResubmit === true;

    if (
      latestPreviousSubmission?.status ===
        TiramisSubmissionStatus.FINAL_SUCCESS &&
      !isMotorVerificationResubmission
    ) {
      throw new ConflictException(
        'TIRAMIS has already completed this submission successfully. Sync its status and data instead of resubmitting to TIRA.',
      );
    }

    const idempotencyKey = buildTiramisIdempotencyKey({
      sourceCompanyId: command.sourceCompanyId,
      requestType: dto.requestType,
      sourceModule: command.sourceModule,
      sourceRecordId: command.sourceRecordId,
      businessReference: command.businessReference,
      forceResubmit: !!dto.forceResubmit,
      // A user-triggered resubmission is a new TIRAMIS submission attempt,
      // not an idempotent replay of an earlier force-resubmit request.
      resubmissionId: dto.forceResubmit ? randomUUID() : null,
    });

    if (
      dto.forceResubmit &&
      latestPreviousSubmission &&
      !isMotorVerificationResubmission
    ) {
      const reconciliation = await this.reconcileBeforeForceResubmit({
        previous: latestPreviousSubmission,
        payload: dto.payload,
        authContext,
      });

      if (reconciliation.returnExisting) {
        return reconciliation.returnExisting;
      }
    }

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

    const canonicalRequestType = mapLegacyRequestTypeToCanonical(
      dto.requestType,
    );

    const canonicalIngressEnabled =
      this.configService.get<string>('TIRAMIS_CANONICAL_INGRESS_ENABLED') ===
      'true';

    const canonicalEnvelope =
      canonicalIngressEnabled &&
      canonicalRequestType &&
      authContext?.scope === 'company'
        ? await this.buildCanonicalEnvelope({
            dto,
            authContext,
            idempotencyKey,
            sourceService: command.sourceService,
            sourceCompanyId: command.sourceCompanyId,
            sourceUserId: command.sourceUserId,
            sourceModule: command.sourceModule,
            sourceRecordId: command.sourceRecordId,
            businessReference: command.businessReference,
            policyId: command.policyId,
            quotationId: command.quotationId,
          })
        : null;

    // Resolve the environment once: the tracking row records it and every
    // follow-up (status sync, retry) stays on it, even after a switch.
    const submissionEnvironment = await this.resolveSubmissionEnvironment(
      authContext?.companyId ?? null,
    );
    const pinnedAuthContext = authContext
      ? { ...authContext, tiramisEnvironment: submissionEnvironment }
      : authContext;

    let tracking: any;
    try {
      tracking = await this.trackingRepository.save(
        this.trackingRepository.create({
          requestType: dto.requestType,
          tiramisEnvironment: submissionEnvironment,
          status: TiramisSubmissionStatus.PENDING,
          schemaVersion:
            canonicalEnvelope?.schemaVersion ??
            TiramisIntegrationSchemaVersion.V1,
          contractVersion: canonicalEnvelope?.contractVersion ?? '1.0',
          workflowRevision:
            canonicalEnvelope?.source.workflowRevision ??
            dto.quotationGateContext?.workflowRevision ??
            null,
          correlationId: canonicalEnvelope?.correlationId ?? null,
          causationId: canonicalEnvelope?.causationId ?? null,
          canonicalStatus: canonicalEnvelope
            ? TiramisIntegrationStatus.QUEUED
            : mapLegacyStatusToCanonical(TiramisSubmissionStatus.PENDING),
          resourceVersion: 1,
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
          envelope: canonicalEnvelope,
          payloadHash: canonicalEnvelope?.hashes.payloadHash ?? null,
          contextHash: canonicalEnvelope?.hashes.contextHash ?? null,
          envelopeHash: canonicalEnvelope?.hashes.envelopeHash ?? null,
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

      const response = canonicalEnvelope
        ? await this.sendCanonicalEnvelope(
            canonicalEnvelope,
            pinnedAuthContext,
            dto.productContext,
            dto.pricingContext,
            dto.insuredDataContext,
            dto.quotationGateContext,
            dto.financeContext,
          )
        : await this.send(
            pattern,
            command,
            pinnedAuthContext,
            dto.productContext,
            dto.pricingContext,
            dto.insuredDataContext,
            dto.quotationGateContext,
            dto.financeContext,
          );

      const updatedTracking = canonicalEnvelope
        ? await this.markCanonicalSubmissionAccepted(tracking.id, response)
        : await this.trackingRepository.markSubmittedResponse(
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
          pattern: canonicalEnvelope ? 'CANONICAL_INGRESS' : pattern,
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

    return this.send(
      TIRAMIS_MESSAGE_PATTERNS.STATUS,
      {
        transactionId: query.transactionId || null,
        requestId: query.requestId || null,
        businessReference: query.businessReference || null,
        includePayload: !!query.includePayload,
      },
      authContext,
    );
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

    return this.send(
      TIRAMIS_MESSAGE_PATTERNS.TRACE,
      {
        transactionId: query.transactionId || null,
        requestId: query.requestId || null,
        businessReference: query.businessReference || null,
        includePayload: !!query.includePayload,
      },
      authContext,
    );
  }

  async validateOrganizationConfiguration(params: {
    companyId: string;
    environment: 'uat' | 'production';
    companyCode: string;
    insurerCompanyCode?: string | null;
    allowExpiredCertificates?: boolean;
  }): Promise<{
    valid: boolean;
    allowExpiredCertificates?: boolean;
    message?: string;
    configurationId?: string;
    environment?: string;
    companyCode?: string;
    systemCode?: string;
    baseUrl?: string;
    apiKey?: { status?: string; masked?: string | null };
    portalWebhook?: { apiKeyConfigured?: boolean };
    callback?: {
      ok?: boolean;
      configuredUrl?: string;
      expectedPath?: string;
      errors?: string[];
      warnings?: string[];
    };
    endpoints?: unknown;
    certificates?: unknown;
    warnings?: string[];
    errors?: string[];
  }> {
    try {
      const requestId = this.requestContextService.getRequestId();
      const correlationId =
        this.requestContextService.getCorrelationId() || requestId;
      const connection = await this.resolveConnectionConfig(
        params.companyId,
        params.environment,
      );
      const serviceContext = this.encodeServiceContext({
        tenant: {
          companyId: params.companyId,
          environment: params.environment,
        },
      });

      const response = await firstValueFrom(
        this.httpService.request({
          method: 'POST',
          baseURL: connection.baseUrl ?? undefined,
          url: '/api/tiramis/configurations/validate-organization',
          data: {
            environment: params.environment,
            companyCode: params.companyCode,
            insurerCompanyCode: params.insurerCompanyCode ?? null,
            ...(params.allowExpiredCertificates !== undefined
              ? { allowExpiredCertificates: params.allowExpiredCertificates }
              : {}),
          },
          validateStatus: () => true,
          headers: {
            Accept: 'application/json',
            'X-API-Key': connection.apiKey,
            ...this.adminAuthorizationHeader(),
            'X-Service-Context': serviceContext,
            ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),
            ...(correlationId
              ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
              : {}),
          },
        }),
      );

      if (response.status < 200 || response.status >= 300) {
        const message =
          this.extractTiramisErrorMessage(response.data) ||
          `TIRAMIS configuration validation failed with status ${response.status}`;
        return { valid: false, message };
      }

      const result = unwrapApiResponse(response.data) as {
        valid?: boolean;
        allowExpiredCertificates?: boolean;
        message?: string;
        configurationId?: string;
        environment?: string;
        companyCode?: string;
        systemCode?: string;
        baseUrl?: string;
        apiKey?: { status?: string; masked?: string | null };
        portalWebhook?: { apiKeyConfigured?: boolean };
        callback?: {
          ok?: boolean;
          configuredUrl?: string;
          expectedPath?: string;
          errors?: string[];
          warnings?: string[];
        };
        endpoints?: unknown;
        certificates?: unknown;
        warnings?: string[];
        errors?: string[];
      };

      return {
        valid: result?.valid === true,
        allowExpiredCertificates: result?.allowExpiredCertificates,
        message: result?.message,
        configurationId: result?.configurationId,
        environment: result?.environment,
        companyCode: result?.companyCode,
        systemCode: result?.systemCode,
        baseUrl: result?.baseUrl,
        apiKey: result?.apiKey,
        portalWebhook: result?.portalWebhook,
        callback: result?.callback,
        endpoints: result?.endpoints,
        certificates: result?.certificates,
        warnings: result?.warnings,
        errors: result?.errors,
      };
    } catch (error) {
      return {
        valid: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reach the TIRAMIS service for configuration validation.',
      };
    }
  }

  async rotateOrganizationApiKey(params: {
    companyId: string;
    environment: 'uat' | 'production';
    companyCode: string;
    adminAccessToken: string;
    allowedIps: string[];
  }): Promise<string> {
    const requestId = this.requestContextService.getRequestId();
    const correlationId =
      this.requestContextService.getCorrelationId() || requestId;
    const configuration = await this.companyConfigurationRepository.findOne({
      where: {
        companyId: params.companyId,
        environment: params.environment,
        isActive: true,
      },
    });
    if (!configuration)
      throw new ConflictException(
        'Active TIRAMIS configuration was not found.',
      );
    // TIRAMIS keeps one active key per system name and rejects tenant-scoped
    // calls from unbound keys, so each company/environment gets its own key.
    const systemName = `${this.configService.getOrThrow<string>('tiramisClient.sourceService')}-${params.companyCode}-${params.environment}`;
    const baseUrl = await this.platformAccess.getBaseUrl(params.environment);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.adminAccessToken}`,
      ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),
      ...(correlationId
        ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
        : {}),
    };

    const keysResponse = await firstValueFrom(
      this.httpService.request({
        method: 'GET',
        baseURL: baseUrl ?? undefined,
        url: '/api/tiramis/api-keys',
        validateStatus: () => true,
        headers,
      }),
    );

    if (keysResponse.status < 200 || keysResponse.status >= 300) {
      throw new ConflictException(
        this.extractTiramisErrorMessage(keysResponse.data) ||
          'Unable to read TIRAMIS API keys with the current configured key.',
      );
    }

    const keys = unwrapApiResponse(keysResponse.data) as Array<{
      id?: string;
      serviceName?: string;
      revokedAt?: string | null;
      isActive?: boolean;
    }>;
    const existing = keys.find(
      (key) =>
        key.id &&
        key.serviceName === systemName &&
        key.isActive !== false &&
        !key.revokedAt,
    );

    const keyResponse = await firstValueFrom(
      this.httpService.request({
        method: 'POST',
        baseURL: baseUrl ?? undefined,
        url: existing?.id
          ? `/api/tiramis/api-keys/systems/${encodeURIComponent(systemName)}/rotate`
          : '/api/tiramis/api-keys',
        data: existing?.id
          ? {
              scopes: ['tiramis:submit', 'tiramis:read', 'tiramis:verify'],
            }
          : {
              name: systemName,
              serviceName: systemName,
              allowedIps: params.allowedIps,
              tenantCompanyCode: params.companyCode,
              tenantEnvironment: params.environment,
              scopes: ['tiramis:submit', 'tiramis:read', 'tiramis:verify'],
              description: `Portal system key for ${params.environment}.`,
              isActive: true,
            },
        validateStatus: () => true,
        headers,
      }),
    );

    if (keyResponse.status < 200 || keyResponse.status >= 300) {
      throw new ConflictException(
        this.extractTiramisErrorMessage(keyResponse.data) ||
          'Unable to generate a TIRAMIS API key.',
      );
    }

    const result = unwrapApiResponse(keyResponse.data) as { apiKey?: string };

    if (!result?.apiKey) {
      throw new ConflictException(
        'TIRAMIS did not return the generated API key.',
      );
    }

    return result.apiKey;
  }

  /**
   * Creates or updates a company's TIRAMIS configuration: company-specific
   * settings only. The TIRA system identity (client code/key, system code,
   * certificates, base/callback URLs) is platform-wide in TIRAMIS's env.
   * Authorized by the calling platform administrator's token, since this
   * must work before any company-specific key exists.
   */
  async upsertClientConfiguration(params: {
    companyId: string;
    environment: 'uat' | 'production';
    companyCode: string;
    insurerCompanyCode: string;
    salePointCode?: string | null;
    tranCompanyCode?: string | null;
  }): Promise<{ id: string; systemCode: string | null }> {
    const result = await this.configurationAdminRequest<{
      id?: string;
      systemCode?: string;
    }>(params, {
      method: 'PUT',
      url: '/api/tiramis/configurations',
      data: {
        environment: params.environment,
        companyCode: params.companyCode,
        insurerCompanyCode: params.insurerCompanyCode,
        ...(params.salePointCode
          ? { salePointCode: params.salePointCode }
          : {}),
        ...(params.tranCompanyCode
          ? { tranCompanyCode: params.tranCompanyCode }
          : {}),
        isActive: true,
      },
      failureMessage: 'Unable to link this company to TIRAMIS.',
    });

    if (!result?.id) {
      throw new ConflictException(
        'TIRAMIS did not return the company configuration id.',
      );
    }

    return { id: result.id, systemCode: result.systemCode ?? null };
  }

  /** The platform-wide TIRA system identity (no secrets) for an environment. */
  getSystemIdentity(params: {
    companyId: string;
    environment: 'uat' | 'production';
  }) {
    return this.configurationAdminRequest<{
      environment: string;
      clientCode: string;
      systemCode: string;
      systemName: string;
      baseUrl: string;
      callbackBaseUrl: string;
    }>(params, {
      method: 'POST',
      url: '/api/tiramis/configurations/system-identity',
      data: { environment: params.environment },
      failureMessage: 'Unable to read the TIRA system identity.',
    });
  }

  /**
   * Stores the portal API key TIRAMIS sends as X-API-Key when it pushes
   * callback notifications to this portal's webhook. Without it TIRAMIS
   * skips the webhook and the portal only learns about callbacks from the
   * status-sync cron.
   */
  async setPortalWebhookApiKey(params: {
    companyId: string;
    environment: 'uat' | 'production';
    tiramisConfigurationId: string;
    apiKey: string;
  }): Promise<void> {
    const requestId = this.requestContextService.getRequestId();
    const correlationId =
      this.requestContextService.getCorrelationId() || requestId;
    const connection = await this.resolveConnectionConfig(
      params.companyId,
      params.environment,
    );
    const serviceContext = this.encodeServiceContext({
      tenant: {
        companyId: params.companyId,
        environment: params.environment,
      },
    });

    const response = await firstValueFrom(
      this.httpService.request({
        method: 'PUT',
        baseURL: connection.baseUrl ?? undefined,
        url: `/api/tiramis/configurations/${encodeURIComponent(
          params.tiramisConfigurationId,
        )}/portal-webhook-api-key`,
        data: { apiKey: params.apiKey },
        validateStatus: () => true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': connection.apiKey,
          ...this.adminAuthorizationHeader(),
          'X-Service-Context': serviceContext,
          ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),
          ...(correlationId
            ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
            : {}),
        },
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      throw new ConflictException(
        this.extractTiramisErrorMessage(response.data) ||
          'Unable to store the portal webhook API key in TIRAMIS.',
      );
    }
  }

  async setPortalNotificationPolicy(params: {
    companyId: string;
    environment: 'uat' | 'production';
    tiramisConfigurationId: string;
    enabled: boolean;
    eventTypes: string[];
  }) {
    return this.configurationAdminRequest(params, {
      method: 'PUT',
      url: `/api/tiramis/configurations/${encodeURIComponent(params.tiramisConfigurationId)}/portal-notification-policy`,
      data: { enabled: params.enabled, eventTypes: params.eventTypes },
      failureMessage: 'Unable to save TIRAMIS notification policy.',
    });
  }

  /**
   * Resolves the TIRAMIS client configuration id without decrypting any
   * secret, so secret repair still works when validation cannot.
   */
  async resolveOrganizationConfigurationId(params: {
    companyId: string;
    environment: 'uat' | 'production';
    companyCode: string;
  }): Promise<string> {
    const result = await this.configurationAdminRequest<{
      configurationId?: string;
    }>(params, {
      method: 'POST',
      url: '/api/tiramis/configurations/resolve-organization',
      data: {
        environment: params.environment,
        companyCode: params.companyCode,
      },
      failureMessage: 'Unable to resolve the TIRAMIS client configuration.',
    });

    if (!result?.configurationId) {
      throw new ConflictException(
        'TIRAMIS did not return a client configuration id.',
      );
    }

    return result.configurationId;
  }

  getConfigurationSecretHealth(params: {
    companyId: string;
    environment: 'uat' | 'production';
    tiramisConfigurationId: string;
  }) {
    return this.configurationAdminRequest<TiramisSecretHealth>(params, {
      method: 'GET',
      url: `/api/tiramis/configurations/${encodeURIComponent(
        params.tiramisConfigurationId,
      )}/secret-health`,
      failureMessage: 'Unable to read TIRAMIS secret health.',
    });
  }

  repairConfigurationSecrets(params: {
    companyId: string;
    environment: 'uat' | 'production';
    tiramisConfigurationId: string;
    replacements: Partial<Record<TiramisSecretName, string>>;
  }) {
    return this.configurationAdminRequest<TiramisSecretHealth>(params, {
      method: 'POST',
      url: `/api/tiramis/configurations/${encodeURIComponent(
        params.tiramisConfigurationId,
      )}/repair-secrets`,
      data: params.replacements,
      failureMessage: 'Unable to repair TIRAMIS secrets.',
    });
  }

  /**
   * TIRAMIS guards its configuration routes with the portal administrator's
   * access token, so forward the caller's bearer token when one is present.
   */
  private adminAuthorizationHeader(): Record<string, string> {
    const token = this.requestContextService.getBearerToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Platform-level TIRAMIS administration (profiles, platform keys, company
   * provisioning), authorized by the calling platform administrator's token.
   */
  platformAdminRequest<T>(request: {
    method: 'GET' | 'POST' | 'PUT';
    url: string;
    data?: unknown;
    failureMessage: string;
    environment?: 'uat' | 'production';
    baseUrl?: string;
  }): Promise<T> {
    return this.configurationAdminRequest<T>(
      { companyId: null, environment: request.environment ?? 'uat' },
      request,
    );
  }

  /**
   * Issues (or rotates) the platform's TIRAMIS service key for an
   * environment, bound to that environment only so it can serve every linked
   * company, whose identity travels in the authenticated service context.
   */
  async issuePlatformServiceKey(params: {
    environment: 'uat' | 'production';
    allowedIps: string[];
    baseUrl?: string;
  }): Promise<string> {
    const serviceName = `${this.configService.getOrThrow<string>('tiramisClient.sourceService')}-platform-${params.environment}`;
    const keys = await this.platformAdminRequest<
      Array<{
        id?: string;
        serviceName?: string;
        allowedIps?: string[];
        isActive?: boolean;
        revokedAt?: string | null;
      }>
    >({
      method: 'GET',
      url: '/api/tiramis/api-keys',
      failureMessage: 'Unable to read TIRAMIS API keys.',
      environment: params.environment,
      baseUrl: params.baseUrl,
    });
    const existing = keys.find(
      (key) =>
        key.id &&
        key.serviceName === serviceName &&
        key.isActive !== false &&
        !key.revokedAt,
    );
    const scopes = ['tiramis:submit', 'tiramis:read', 'tiramis:verify'];
    const result = await this.platformAdminRequest<{ apiKey?: string }>(
      existing
        ? {
            method: 'POST',
            url: `/api/tiramis/api-keys/systems/${encodeURIComponent(serviceName)}/rotate`,
            data: { scopes, allowedIps: params.allowedIps },
            failureMessage: 'Unable to rotate the platform TIRAMIS key.',
            environment: params.environment,
            baseUrl: params.baseUrl,
          }
        : {
            method: 'POST',
            url: '/api/tiramis/api-keys',
            data: {
              name: serviceName,
              serviceName,
              allowedIps: params.allowedIps,
              tenantEnvironment: params.environment,
              scopes,
              description: `Platform service key for ${params.environment}; serves every linked company.`,
              isActive: true,
            },
            failureMessage: 'Unable to issue the platform TIRAMIS key.',
            environment: params.environment,
            baseUrl: params.baseUrl,
          },
    );
    if (!result?.apiKey) {
      throw new ConflictException('TIRAMIS did not return the generated key.');
    }
    return result.apiKey;
  }

  async getPlatformServiceKeyAllowedIps(params: {
    environment: 'uat' | 'production';
    baseUrl?: string;
  }): Promise<string[] | null> {
    const serviceName = `${this.configService.getOrThrow<string>('tiramisClient.sourceService')}-platform-${params.environment}`;
    const keys = await this.platformAdminRequest<
      Array<{
        serviceName?: string;
        allowedIps?: string[];
        isActive?: boolean;
        revokedAt?: string | null;
      }>
    >({
      method: 'GET',
      url: '/api/tiramis/api-keys',
      failureMessage: 'Unable to read TIRAMIS service key IP restrictions.',
      environment: params.environment,
      baseUrl: params.baseUrl,
    });
    const activeKey = keys.find(
      (key) =>
        key.serviceName === serviceName &&
        key.isActive !== false &&
        !key.revokedAt,
    );
    return activeKey ? (activeKey.allowedIps ?? []) : null;
  }

  private async configurationAdminRequest<T>(
    params: { companyId: string | null; environment: 'uat' | 'production' },
    request: {
      method: 'GET' | 'POST' | 'PUT';
      url: string;
      data?: unknown;
      failureMessage: string;
      baseUrl?: string;
    },
  ): Promise<T> {
    const requestId = this.requestContextService.getRequestId();
    const correlationId =
      this.requestContextService.getCorrelationId() || requestId;
    const serviceContext = this.encodeServiceContext(
      params.companyId
        ? {
            tenant: {
              companyId: params.companyId,
              environment: params.environment,
            },
          }
        : {},
    );

    // TIRAMIS authorizes configuration routes with the platform
    // administrator's token alone, so these calls must not depend on the
    // company already having a TIRAMIS API key: linking a new company starts
    // here, before any key exists.
    const response = await firstValueFrom(
      this.httpService.request({
        method: request.method,
        baseURL:
          request.baseUrl ??
          (await this.platformAccess.getBaseUrl(params.environment)),
        url: request.url,
        data: request.data,
        timeout: 15_000,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...this.adminAuthorizationHeader(),
          'X-Service-Context': serviceContext,
          ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),
          ...(correlationId
            ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
            : {}),
        },
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      throw new ConflictException(
        this.extractTiramisErrorMessage(response.data) ||
          request.failureMessage,
      );
    }

    return unwrapApiResponse(response.data) as T;
  }

  async testPortalWebhook(params: {
    companyId: string;
    environment: 'uat' | 'production';
    tiramisConfigurationId: string;
    webhookUrl: string;
  }) {
    const requestId = `portal-webhook-test-${randomUUID()}`;
    const connection = await this.resolveConnectionConfig(
      params.companyId,
      params.environment,
    );
    const serviceContext = this.encodeServiceContext({
      tenant: {
        companyId: params.companyId,
        environment: params.environment,
      },
    });
    const response = await firstValueFrom(
      this.httpService.request({
        method: 'POST',
        baseURL: connection.baseUrl ?? undefined,
        url: `/api/tiramis/configurations/${encodeURIComponent(
          params.tiramisConfigurationId,
        )}/portal-webhook-test`,
        data: { webhookUrl: params.webhookUrl },
        timeout: 10_000,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': connection.apiKey,
          ...this.adminAuthorizationHeader(),
          'X-Service-Context': serviceContext,
          [HTTP_HEADERS.REQUEST_ID]: requestId,
          [HTTP_HEADERS.CORRELATION_ID]: requestId,
        },
      }),
    );
    const result = unwrapApiResponse(response.data) as Record<string, any>;

    return {
      success:
        response.status >= 200 && response.status < 300 && !!result?.success,
      webhookUrl: params.webhookUrl,
      httpStatus: result?.httpStatus ?? response.status,
      requestId: result?.requestId ?? requestId,
      message:
        result?.message ||
        (response.status >= 200 && response.status < 300
          ? 'TIRAMIS reached the portal webhook successfully.'
          : this.extractTiramisErrorMessage(response.data) ||
            `TIRAMIS webhook test failed with HTTP ${response.status}.`),
    };
  }

  async checkPlatformConnection(
    environment: 'uat' | 'production',
    baseUrl?: string,
  ) {
    const apiKey = await this.platformAccess.getServiceApiKey(environment);
    if (!apiKey)
      throw new ConflictException(
        'Platform service API key is not configured.',
      );
    const response = await firstValueFrom(
      this.httpService.get('/api/tiramis/platform/connection-test', {
        baseURL: baseUrl ?? (await this.platformAccess.getBaseUrl(environment)),
        timeout: 10000,
        validateStatus: () => true,
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      }),
    );
    if (response.status < 200 || response.status >= 300)
      throw new ConflictException(
        this.extractTiramisErrorMessage(response.data) ||
          `TIRAMIS rejected the service key (HTTP ${response.status}).`,
      );
    const result = unwrapApiResponse(response.data) as {
      environment?: string;
      success?: boolean;
    };
    if (result.environment && result.environment !== environment)
      throw new ConflictException(
        `TIRAMIS key is authorized for ${result.environment}, not ${environment}.`,
      );
    return result;
  }

  async testPlatformWebhook(
    environment: 'uat' | 'production',
    webhookUrl: string,
    baseUrl?: string,
  ) {
    return this.platformAdminRequest<Record<string, unknown>>({
      method: 'POST',
      url: `/api/tiramis/platform/profiles/${environment}/portal-webhook-test`,
      data: { webhookUrl },
      environment,
      baseUrl,
      failureMessage: 'TIRAMIS could not send the portal webhook test.',
    });
  }

  detectPortalOutboundIp(environment: 'uat' | 'production', baseUrl?: string) {
    return this.platformAdminRequest<{
      environment: string;
      observedIp: string;
    }>({
      method: 'GET',
      url: `/api/tiramis/platform/profiles/${environment}/connection-source-ip`,
      environment,
      baseUrl,
      failureMessage: 'TIRAMIS could not observe the Portal source IP.',
    });
  }

  detectTiramisOutboundIp(params: {
    environment: 'uat' | 'production';
    webhookUrl: string;
    challengeToken: string;
    baseUrl?: string;
  }) {
    return this.platformAdminRequest<{
      environment: string;
      observedIp: string;
    }>({
      method: 'POST',
      url: `/api/tiramis/platform/profiles/${params.environment}/portal-source-ip-test`,
      data: {
        webhookUrl: params.webhookUrl,
        challengeToken: params.challengeToken,
      },
      environment: params.environment,
      baseUrl: params.baseUrl,
      failureMessage: 'TIRAMIS could not test its outbound source IP.',
    });
  }

  async getTiramisDeliveryDiagnostics(params: {
    companyId: string;
    environment: 'uat' | 'production';
    requestId?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params.requestId) query.set('requestId', params.requestId);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    const result = await this.configurationAdminRequest<any>(params, {
      method: 'GET',
      url: `/api/tiramis/portal-notifications/outbox${suffix}`,
      failureMessage:
        'Unable to load TIRAMIS notification delivery diagnostics.',
    });
    const callbacks = await this.configurationAdminRequest<any>(params, {
      method: 'GET',
      url: `/api/tiramis/portal-notifications/outbox/callbacks${suffix}`,
      failureMessage: 'Unable to load TIRAMIS callback diagnostics.',
    });
    return { outbox: result, callbacks };
  }

  async checkTiramisServiceHealth(authContext?: any) {
    return this.send(
      TIRAMIS_MESSAGE_PATTERNS.HEALTH,
      {
        sourceService: 'insurance-portal-service',
        checkedAt: new Date().toISOString(),
      },
      authContext,
    );
  }

  async getLocalTrackingById(id: string) {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS local tracking record not found');
    }

    return tracking;
  }

  async findLatestSubmissionForSameBusiness(params: {
    sourceCompanyId?: string | null;
    requestType: TiramisRequestType;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    return this.trackingRepository.findLatestSubmissionForSameBusiness(params);
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

    if (tracking.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      throw new ConflictException(
        'TIRAMIS has already completed this submission successfully. Sync its status and data instead of retrying.',
      );
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

    // This is a system-initiated retry (no live HTTP request/user session).
    // Reconstruct minimal company business context from the tracking record
    // so TIRAMIS can resolve the correct company/system configuration.
    const retryAuthContext: AuthenticatedUser | undefined =
      tracking.sourceCompanyId
        ? {
            id: tracking.sourceUserId || 'system',
            email: 'system@internal',
            scope: 'company',
            userType: 'COMPANY_USER',
            sessionId: 'system-retry',
            accessTokenId: 'system-retry',
            authorizationVersion: 0,
            companyId: tracking.sourceCompanyId,
            roles: [],
            permissions: [],
            ...(tracking.tiramisEnvironment
              ? { tiramisEnvironment: tracking.tiramisEnvironment }
              : {}),
          }
        : undefined;

    return this.send(pattern, command, retryAuthContext);
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

  /**
   * Builds the full company business context for a TIRAMIS submission by
   * resolving the caller's authoritative organization context (company TIRA
   * mapping, active branch, active department, default sales point) instead
   * of trusting whatever the caller's stale JWT claims say. This is the
   * multi-company-safe path required by TIRAMIS's per-company/system-code
   * configuration resolution.
   */
  private async buildTiramisReadyTenantContext(authContext: AuthenticatedUser) {
    const organizationContext =
      await this.organizationContextService.requireTiramisReady(
        authContext.id,
        authContext.companyId!,
        authContext.tiramisEnvironment === 'production' ? 'production' : 'uat',
        { followUp: authContext.tiramisFollowUp === true },
      );

    return {
      companyId: organizationContext.company.id,
      companyCode: organizationContext.tiramis.companyCode!,
      insurerCompanyCode: organizationContext.tiramis.insurerCompanyCode!,
      branchId: organizationContext.activeBranch!.id,
      branchCode: organizationContext.activeBranch!.code,
      departmentId: organizationContext.activeDepartment?.id ?? null,
      departmentCode: organizationContext.activeDepartment?.code ?? null,
      salePointId: organizationContext.defaultSalePoint!.id,
      salePointCode: organizationContext.defaultSalePoint!.code,
      environment: organizationContext.tiramis.environment,
    };
  }

  private async buildCanonicalEnvelope(params: {
    dto: SubmitTiramisDto;
    authContext: AuthenticatedUser;
    idempotencyKey: string;
    sourceService: string;
    sourceCompanyId: string | null;
    sourceUserId: string | null;
    sourceModule: string;
    sourceRecordId: string | null;
    businessReference: string | null;
    policyId: string | null;
    quotationId: string | null;
  }): Promise<TiramisSubmissionEnvelope | null> {
    const canonicalRequestType = mapLegacyRequestTypeToCanonical(
      params.dto.requestType,
    );

    if (
      !canonicalRequestType ||
      !params.sourceCompanyId ||
      !params.sourceRecordId ||
      !params.businessReference
    ) {
      return null;
    }

    const tenantContext = await this.buildTiramisReadyTenantContext(
      params.authContext,
    );

    const context: TiramisSubmissionContext = {
      organization: {
        insurerCompanyId: tenantContext.companyId,
        operatingCompanyId: tenantContext.companyId,
        branchId: tenantContext.branchId || 'UNKNOWN',
        branchCode: tenantContext.branchCode || 'UNKNOWN',
        departmentId: tenantContext.departmentId || null,
        salePointId: tenantContext.salePointId || 'UNKNOWN',
        salePointCode: tenantContext.salePointCode || 'UNKNOWN',
        companyMembershipId:
          params.authContext.companyMembershipId || 'UNKNOWN',
      },
      distribution: {
        relationshipId: null,
        distributionChannelId: 'DIRECT',
        channelType: 'DIRECT',
        intermediaryCompanyId: null,
        intermediaryAgentId: null,
        transactionCompanyCode:
          tenantContext.companyCode || tenantContext.companyId,
        commissionRate: params.dto.financeContext?.commissionRate ?? null,
        commissionAmount: params.dto.financeContext?.commissionAmount ?? null,
      },
      product: {
        productId:
          params.dto.productContext?.productId ||
          params.sourceRecordId ||
          params.dto.requestType,
        productVersionId:
          params.dto.productContext?.productVersionId ||
          params.dto.pricingContext?.productVersionId ||
          'UNSPECIFIED',
        productCode:
          params.dto.productContext?.productCode ||
          String(params.dto.payload?.productCode || params.dto.requestType),
        productDefinitionHash:
          params.dto.productContext?.definitionHash ||
          params.dto.pricingContext?.productDefinitionHash ||
          params.dto.pricingContext?.resultHash ||
          params.idempotencyKey,
        insuranceCategoryCode: String(
          params.dto.payload?.insuranceType ||
            params.dto.payload?.insuranceCategoryCode ||
            'GENERAL',
        ),
        insuranceSubClassCode:
          params.dto.payload?.insuranceSubClassCode != null
            ? String(params.dto.payload.insuranceSubClassCode)
            : null,
        riskCodes: params.dto.pricingContext?.riskCode
          ? [params.dto.pricingContext.riskCode]
          : Array.isArray(params.dto.payload?.riskCodes)
            ? params.dto.payload.riskCodes.map((value) => String(value))
            : [],
      },
      pricing: params.dto.pricingContext ?? null,
      insuredData: params.dto.insuredDataContext ?? null,
      quotationGate: params.dto.quotationGateContext ?? null,
      finance: params.dto.financeContext ?? null,
      policyTransaction: params.dto.policyTransactionContext ?? null,
      claim: params.dto.claimContext ?? null,
      reinsurance: params.dto.reinsuranceContext ?? null,
    };

    return this.tiramisEnvelopeService.build({
      environment: tenantContext.environment,
      command: TiramisIntegrationCommand.SUBMIT,
      requestType: canonicalRequestType,
      idempotencyKey: params.idempotencyKey,
      source: {
        service: 'insurance-portal-service',
        companyId: params.sourceCompanyId,
        userId: params.sourceUserId,
        module: params.sourceModule,
        recordId: params.sourceRecordId,
        workflowRevision:
          params.dto.quotationGateContext?.workflowRevision ?? null,
        quotationId: params.quotationId,
        policyId: params.policyId,
        businessReference: params.businessReference,
        portalWebhookUrl: await this.getPortalWebhookUrl(
          tenantContext.environment,
        ),
      },
      context,
      payload: params.dto.payload,
    });
  }

  private async sendCanonicalEnvelope(
    envelope: TiramisSubmissionEnvelope,
    authContext: AuthenticatedUser,
    productContext?: ServiceProductContext,
    pricingContext?: ServicePricingContext,
    insuredDataContext?: ServiceInsuredDataContext,
    quotationGateContext?: ServiceQuotationGateContext,
    financeContext?: ServiceFinanceContext,
  ) {
    const requestId = this.requestContextService.getRequestId();
    const correlationId =
      this.requestContextService.getCorrelationId() ||
      requestId ||
      envelope.correlationId;
    const tenantContext =
      await this.buildTiramisReadyTenantContext(authContext);
    const serviceContext = this.encodeServiceContext({
      tenant: tenantContext,
      actor: {
        userId: authContext.id,
        companyMembershipId: authContext.companyMembershipId,
        sessionId: authContext.sessionId,
        roles: [],
        permissions: [],
      },
      ...(productContext ? { product: productContext } : null),
      ...(pricingContext ? { pricing: pricingContext } : null),
      ...(insuredDataContext ? { insuredData: insuredDataContext } : null),
      ...(quotationGateContext
        ? { quotationGate: quotationGateContext }
        : null),
      ...(financeContext ? { finance: financeContext } : null),
    });
    const connection = await this.resolveConnectionConfig(
      authContext.companyId,
      tenantContext.environment,
    );

    const response = await firstValueFrom(
      this.httpService.request({
        method: 'POST',
        baseURL: connection.baseUrl ?? undefined,
        url: '/api/internal/tiramis/integration/submissions',
        data: envelope,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json',
          'X-API-Key': connection.apiKey,
          'X-Service-Context': serviceContext,
          'X-Actor-User-Id': authContext.id ?? '',
          'X-Actor-Membership-Id': authContext.companyMembershipId ?? '',
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

    return unwrapApiResponse(response.data) as TiramisSubmissionAcceptance;
  }

  private async markCanonicalSubmissionAccepted(
    trackingId: string,
    acceptance: TiramisSubmissionAcceptance,
  ) {
    const tracking = await this.trackingRepository.findById(trackingId);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS local tracking record not found');
    }

    tracking.status = TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE;
    tracking.canonicalStatus = acceptance.status;
    tracking.tiramisTransactionId = acceptance.transactionId;
    tracking.tiramisRequestId = acceptance.requestId;
    tracking.tiramisServiceType = acceptance.serviceType;
    tracking.tiramisRootElement = acceptance.rootElement;
    tracking.tiramisResponsePayload = acceptance;
    tracking.submittedAt = new Date(acceptance.acceptedAt);
    tracking.resourceVersion = acceptance.resourceVersion;
    tracking.correlationId = acceptance.correlationId;

    return this.trackingRepository.save(tracking);
  }

  private resolveServiceScopes(pattern: string): string[] {
    if (pattern.includes('verification')) {
      return [TiramisServiceScopes.VERIFY];
    }

    if (
      pattern.includes('status') ||
      pattern.includes('trace') ||
      pattern.includes('health')
    ) {
      return [TiramisServiceScopes.READ];
    }

    if (pattern.includes('retry')) {
      return [TiramisServiceScopes.RETRY];
    }

    return [TiramisServiceScopes.SUBMIT];
  }

  private async assertConfiguredIntegrationPermission(
    companyId: string | null | undefined,
    pattern: string,
  ) {
    if (!companyId) return;
    // Integration capabilities are platform-level, the same for every company.
    const permissions = await this.platformAccess.getIntegrationPermissions();
    const required = this.resolveServiceScopes(pattern);
    const capability = required.includes(TiramisServiceScopes.READ)
      ? 'read_status'
      : 'submit';
    if (!permissions.includes(capability)) {
      throw new BadRequestException({
        code: 'TIRAMIS_INTEGRATION_PERMISSION_DISABLED',
        message: `This TIRAMIS integration does not have the ${capability} permission enabled.`,
        details: { capability, requiredScopes: required },
      });
    }
  }

  private encodeServiceContext(context: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(context), 'utf8').toString('base64url');
  }

  private async resolveConnectionConfig(
    companyId?: string | null,
    environment?: string | null,
  ): Promise<{
    apiKey: string;
    baseUrl: string | null;
    sourceService: string;
  }> {
    if (!companyId) {
      throw new ConflictException(
        'A company context is required to resolve the TIRAMIS API key.',
      );
    }

    const targetEnvironment =
      environment === 'uat' || environment === 'production'
        ? environment
        : await this.platformAccess.getActiveEnvironment();

    // The platform's service key for the environment. A company's legacy
    // per-company key is used only until the platform key is generated.
    let apiKey = await this.platformAccess.getServiceApiKey(targetEnvironment);
    if (!apiKey) {
      const legacy = await this.companyConfigurationRepository
        .createQueryBuilder('configuration')
        .addSelect('configuration.serviceApiKeyEncrypted')
        .where('configuration.companyId = :companyId', { companyId })
        .andWhere('configuration.environment = :environment', {
          environment: targetEnvironment,
        })
        .getOne();
      apiKey = this.apiKeyVault.decrypt(legacy?.serviceApiKeyEncrypted);
    }

    if (!apiKey) {
      throw new ConflictException(
        `The platform TIRAMIS service key for the ${targetEnvironment} environment is not configured (Platform → TIRAMIS Integration).`,
      );
    }

    return {
      apiKey,
      baseUrl: await this.platformAccess.getBaseUrl(targetEnvironment),
      sourceService: this.configService.getOrThrow<string>(
        'tiramisClient.sourceService',
      ),
    };
  }

  /** The environment a new submission is sent to (one source of truth). */
  private async resolveSubmissionEnvironment(
    companyId: string | null,
  ): Promise<'uat' | 'production'> {
    if (companyId) {
      return this.organizationContextService.resolveCompanyTiramisEnvironment(
        companyId,
      );
    }
    const configured = this.configService.get<string>('tiramisClient.tiraEnv');
    return configured === 'uat' || configured === 'production'
      ? configured
      : 'uat';
  }

  private async send(
    pattern: string,
    payload: Record<string, unknown>,
    authContext?: AuthenticatedUser,
    productContext?: ServiceProductContext,
    pricingContext?: ServicePricingContext,
    insuredDataContext?: ServiceInsuredDataContext,
    quotationGateContext?: ServiceQuotationGateContext,
    financeContext?: ServiceFinanceContext,
  ) {
    try {
      await this.assertConfiguredIntegrationPermission(
        authContext?.companyId,
        pattern,
      );
      const route = this.httpRouteForPattern(pattern);

      const isQuery =
        pattern === TIRAMIS_MESSAGE_PATTERNS.HEALTH ||
        pattern === TIRAMIS_MESSAGE_PATTERNS.STATUS ||
        pattern === TIRAMIS_MESSAGE_PATTERNS.TRACE;

      const requestId = this.requestContextService.getRequestId();

      const correlationId =
        this.requestContextService.getCorrelationId() || requestId;

      const requiredScopes = this.resolveServiceScopes(pattern);
      const tenantContext =
        authContext?.scope === 'company' && authContext.companyId
          ? pattern === TIRAMIS_MESSAGE_PATTERNS.HEALTH
            ? {
                companyId: authContext.companyId,
                branchId: authContext.activeBranchId,
                branchCode: authContext.activeBranchCode,
                salePointId: authContext.defaultSalePointId,
                salePointCode: authContext.defaultSalePointCode,
                // Check the environment the company activated, as submissions
                // do, rather than the service-wide default.
                environment:
                  authContext.tiramisEnvironment ??
                  (await this.organizationContextService.resolveCompanyTiramisEnvironment(
                    authContext.companyId,
                  )),
              }
            : await this.buildTiramisReadyTenantContext(authContext)
          : undefined;
      const connectionEnvironment =
        (tenantContext as { environment?: 'uat' | 'production' } | undefined)
          ?.environment ?? (await this.platformAccess.getActiveEnvironment());

      const serviceContext = this.encodeServiceContext(
        tenantContext
          ? {
              tenant: tenantContext,
              actor: {
                userId: authContext!.id,
                companyMembershipId: authContext!.companyMembershipId,
                sessionId: authContext!.sessionId,
                roles: [],
                permissions: [],
              },
              ...(productContext ? { product: productContext } : null),
              ...(pricingContext ? { pricing: pricingContext } : null),
              ...(insuredDataContext
                ? { insuredData: insuredDataContext }
                : null),
              ...(quotationGateContext
                ? { quotationGate: quotationGateContext }
                : null),
              ...(financeContext ? { finance: financeContext } : null),
            }
          : {},
      );
      const connection = await this.resolveConnectionConfig(
        authContext?.companyId ?? null,
        connectionEnvironment,
      );

      const response = await firstValueFrom(
        this.httpService.request({
          method: isQuery ? 'GET' : 'POST',
          baseURL: connection.baseUrl ?? undefined,

          url: route.path,

          params: isQuery ? payload : undefined,

          data: isQuery
            ? undefined
            : await this.httpPayload(pattern, payload, connectionEnvironment),

          validateStatus: () => true,

          headers: {
            Accept: 'application/json',

            'X-API-Key': connection.apiKey,
            'X-Service-Context': serviceContext,

            'X-Actor-User-Id': authContext?.id ?? '',

            'X-Actor-Membership-Id': authContext?.companyMembershipId ?? '',

            ...(this.isSubmissionPattern(pattern)
              ? {
                  'X-Tiramis-Source-Metadata': await this.encodeSourceMetadata(
                    payload,
                    connectionEnvironment,
                  ),
                }
              : {}),

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
      if (error instanceof HttpException) {
        // Raised locally (e.g. org-readiness checks, missing API key) before
        // any request reached TIRAMIS - rethrow as-is instead of relabeling
        // it as a downstream TIRAMIS_SERVICE_REQUEST_FAILED.
        throw error;
      }

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

  private static readonly SUBMISSION_PATTERNS = new Set<string>([
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NON_MOTOR,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_FLEET,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_REINSURANCE,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_POLICY,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_NOTIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_INTIMATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_ASSESSMENT,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_DISCHARGE_VOUCHER,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_PAYMENT,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_CLAIM_REJECTION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COVER_NOTE_VERIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_VERIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NIN_VERIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COMPANY_VERIFICATION,
  ]);

  private static readonly VERIFICATION_PATTERNS = new Set<string>([
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COVER_NOTE_VERIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_VERIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_NIN_VERIFICATION,
    TIRAMIS_MESSAGE_PATTERNS.SUBMIT_COMPANY_VERIFICATION,
  ]);

  private isSubmissionPattern(pattern: string): boolean {
    return TiramisClientService.SUBMISSION_PATTERNS.has(pattern);
  }

  /**
   * Source metadata travels as a header so TIRAMIS can attribute the
   * transaction and, critically, knows where to push the final TIRA outcome.
   * portalWebhookUrl is mandatory; TIRAMIS rejects submissions without it.
   */
  private async encodeSourceMetadata(
    command: Record<string, any>,
    environment: 'uat' | 'production',
  ): Promise<string> {
    return Buffer.from(
      JSON.stringify({
        sourceService: command.sourceService ?? null,
        sourceCompanyId: command.sourceCompanyId ?? null,
        sourceUserId: command.sourceUserId ?? null,
        sourceModule: command.sourceModule ?? null,
        sourceRecordId: command.sourceRecordId ?? null,
        policyId: command.policyId ?? null,
        quotationId: command.quotationId ?? null,
        businessReference: command.businessReference ?? null,
        requestType: command.requestType ?? null,
        requestId: command.requestId ?? null,
        portalWebhookUrl: await this.getPortalWebhookUrl(environment),
      }),
      'utf8',
    ).toString('base64url');
  }

  private async httpPayload(
    pattern: string,
    command: Record<string, any>,
    environment: 'uat' | 'production',
  ) {
    const payload = command.payload || command;
    const resolvedPayload = this.isSubmissionPattern(pattern)
      ? this.stripSignedTenantBodyFields(payload)
      : payload;

    if (TiramisClientService.VERIFICATION_PATTERNS.has(pattern)) {
      return {
        ...resolvedPayload,
        portalWebhookUrl: await this.getPortalWebhookUrl(environment),
      };
    }

    if (pattern === TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_FLEET) {
      return { ...resolvedPayload, isFleet: true };
    }

    // Claim messages have no sale point (TIRAMIS v1.3 §9–14) and the gateway
    // rejects unknown DTO properties.
    if (pattern.startsWith('tiramis.claim.')) {
      const { salePointCode, ...claimPayload } = resolvedPayload;
      void salePointCode;

      return claimPayload;
    }

    return resolvedPayload;
  }

  getPortalWebhookUrl(environment: 'uat' | 'production') {
    // The callback belongs to this Portal instance. Do not allow a stored
    // per-environment or per-company URL to override its fixed route.
    void environment;
    return resolveTiramisPortalWebhookUrl(this.configService);
  }

  private stripSignedTenantBodyFields(payload: Record<string, any>) {
    // callbackUrl is a request-level TIRA callback override. Keep it so
    // motor/non-motor/fleet submissions can choose a public callback route.
    const {
      companyCode,
      systemCode,
      systemName,
      clientCode,
      branchCode,
      insurerCompanyCode,
      tranCompanyCode,
      callback_url,
      ...body
    } = payload;

    void companyCode;
    void systemCode;
    void systemName;
    void clientCode;
    void branchCode;
    void insurerCompanyCode;
    void tranCompanyCode;
    void callback_url;

    return body;
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
    ].includes(status as TiramisSubmissionStatus);
  }

  private async reconcileBeforeForceResubmit(params: {
    previous: any;
    payload: any;
    authContext?: any;
  }): Promise<{ returnExisting?: any }> {
    const previous = params.previous;

    if (previous.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      return this.returnExistingDuplicateAfterReconcile({
        tracking: previous,
        statusBefore: previous.status,
        authContext: params.authContext,
      });
    }

    if (this.canCreateNewRequestAfterPreviousStatus(previous.status)) {
      return {};
    }

    if (!previous.tiramisTransactionId && !previous.tiramisRequestId) {
      return {};
    }

    let updated = previous;

    try {
      await this.auditService.logFromTracking({
        action: TiramisAuditAction.STATUS_SYNC_REQUESTED,
        tracking: previous,
        statusBefore: previous.status,
        success: true,
        authContext: params.authContext,
        metadata: {
          reason: 'force_resubmit_reconciliation',
        },
      });

      const response = await this.getStatus(
        {
          transactionId: previous.tiramisTransactionId || undefined,
          requestId: previous.tiramisRequestId || undefined,
          businessReference: previous.businessReference || undefined,
          includePayload:
            environment.TIRAMIS_STATUS_SYNC_INCLUDE_PAYLOAD !== 'false',
        },
        this.resolveTrackingFollowUpAuthContext(previous, params.authContext),
      );

      updated =
        (await this.trackingRepository.markFinalFromTiramisStatus(
          previous.id,
          response,
        )) || previous;

      await this.businessRecordSyncService.syncFromTracking(updated);

      await this.auditService.logFromTracking({
        action: TiramisAuditAction.STATUS_SYNC_SUCCESS,
        tracking: updated,
        statusBefore: previous.status,
        success: true,
        authContext: params.authContext,
        metadata: {
          reason: 'force_resubmit_reconciliation',
          resolvedStatus: updated.status,
        },
      });
    } catch (error: any) {
      await this.auditService.logFromTracking({
        action: TiramisAuditAction.STATUS_SYNC_FAILED,
        tracking: previous,
        statusBefore: previous.status,
        success: false,
        authContext: params.authContext,
        error,
        metadata: {
          reason: 'force_resubmit_reconciliation',
        },
      });

      throw new ConflictException({
        message:
          'TIRAMIS status could not be confirmed for the previous request. Retry is blocked to prevent a duplicate submission.',
        duplicatePrevented: true,
        existingTrackingId: previous.id,
        existingStatus: previous.status,
        tiramisRequestId: previous.tiramisRequestId,
        tiramisTransactionId: previous.tiramisTransactionId,
        hint: 'Run TIRAMIS status sync or reconcile the previous request before resubmitting.',
      });
    }

    if (updated.status === TiramisSubmissionStatus.FINAL_SUCCESS) {
      return this.returnExistingDuplicateAfterReconcile({
        tracking: updated,
        statusBefore: previous.status,
        authContext: params.authContext,
      });
    }

    if (this.canCreateNewRequestAfterPreviousStatus(updated.status)) {
      return {};
    }

    throw new ConflictException({
      message:
        'TIRAMIS is still processing the previous request. Retry is blocked to prevent a duplicate submission.',
      duplicatePrevented: true,
      existingTrackingId: updated.id,
      existingStatus: updated.status,
      tiramisRequestId: updated.tiramisRequestId,
      tiramisTransactionId: updated.tiramisTransactionId,
      hint: 'Wait for the callback or run status sync again before resubmitting.',
    });
  }

  private canCreateNewRequestAfterPreviousStatus(
    status?: string | null,
  ): boolean {
    return [
      TiramisSubmissionStatus.FINAL_FAILED,
      TiramisSubmissionStatus.ACK_FAILED,
      TiramisSubmissionStatus.FAILED,
      TiramisSubmissionStatus.RETRY_EXHAUSTED,
      TiramisSubmissionStatus.DUPLICATE_PREVENTED,
    ].includes(status as TiramisSubmissionStatus);
  }

  private resolveTrackingFollowUpAuthContext(
    tracking: any,
    authContext?: any,
  ): any {
    if (!tracking.sourceCompanyId) {
      return authContext;
    }

    return {
      ...(authContext || {}),
      id: tracking.sourceUserId || authContext?.id || 'system',
      userId: tracking.sourceUserId || authContext?.userId || authContext?.id,
      email: authContext?.email || 'system@internal',
      scope: 'company',
      userType: authContext?.userType || 'COMPANY_USER',
      sessionId: authContext?.sessionId || 'system-force-resubmit-sync',
      accessTokenId: authContext?.accessTokenId || 'system-force-resubmit-sync',
      authorizationVersion: authContext?.authorizationVersion || 0,
      companyId: tracking.sourceCompanyId,
      activeCompanyId: tracking.sourceCompanyId,
      roles: authContext?.roles || [],
      permissions: authContext?.permissions || [],
      ...(tracking.tiramisEnvironment
        ? { tiramisEnvironment: tracking.tiramisEnvironment }
        : {}),
      tiramisFollowUp: true,
    };
  }

  private async returnExistingDuplicateAfterReconcile(params: {
    tracking: any;
    statusBefore?: string | null;
    authContext?: any;
  }) {
    const message =
      'TIRAMIS already accepted the previous request. A duplicate resubmission was prevented.';

    await this.auditService.logFromTracking({
      action: TiramisAuditAction.DUPLICATE_PREVENTED,
      tracking: params.tracking,
      statusBefore: params.statusBefore || params.tracking.status,
      success: false,
      authContext: params.authContext,
      metadata: {
        reason: message,
        duplicateOfTrackingId: params.tracking.id,
        tiramisRequestId: params.tracking.tiramisRequestId,
        tiramisTransactionId: params.tracking.tiramisTransactionId,
      },
    });

    await this.notificationService.notifyDuplicatePrevented({
      tracking: params.tracking,
      existingTracking: params.tracking,
      reason: message,
      metadata: {
        source: 'force_resubmit_reconciliation',
      },
    });

    return {
      returnExisting: {
        success: true,
        duplicatePrevented: true,
        returnedExisting: true,
        message,
        localTrackingId: params.tracking.id,
        localStatus: params.tracking.status,
        tracking: params.tracking,
        tiramis: params.tracking.tiramisResponsePayload || null,
      },
    };
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
      return validationErrors.map((item) =>
        this.stringifyValidationError(item),
      );
    }

    return [this.stringifyValidationError(validationErrors)];
  }

  private stringifyValidationError(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;

      if (typeof record.message === 'string') {
        return record.message;
      }

      if (typeof record.error === 'string') {
        return record.error;
      }
    }

    return String(value);
  }
}
