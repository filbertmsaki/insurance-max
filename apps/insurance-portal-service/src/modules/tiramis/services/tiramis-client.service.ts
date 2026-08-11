import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

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
    private readonly organizationContextService: OrganizationContextService,
    private readonly tiramisEnvelopeService: TiramisEnvelopeService,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly companyConfigurationRepository: Repository<TiramisCompanyConfigurationEntity>,
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

    let tracking: any;
    try {
      tracking = await this.trackingRepository.save(
        this.trackingRepository.create({
          requestType: dto.requestType,
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
            authContext,
            dto.productContext,
            dto.pricingContext,
            dto.insuredDataContext,
            dto.quotationGateContext,
            dto.financeContext,
          )
        : await this.send(
            pattern,
            command,
            authContext,
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
    environment: 'test' | 'live';
    companyCode: string;
    systemCode: string | null;
    insurerCompanyCode?: string | null;
  }): Promise<{
    valid: boolean;
    message?: string;
    configurationId?: string;
    environment?: string;
    companyCode?: string;
    systemCode?: string;
    baseUrl?: string;
    apiKey?: { status?: string; masked?: string | null };
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
            systemCode: params.systemCode,
            insurerCompanyCode: params.insurerCompanyCode ?? null,
          },
          validateStatus: () => true,
          headers: {
            Accept: 'application/json',
            'X-API-Key': connection.apiKey,
            'X-Service-Context': serviceContext,
            [HTTP_HEADERS.SOURCE_SERVICE]: connection.sourceService,
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
        message?: string;
        configurationId?: string;
        environment?: string;
        companyCode?: string;
        systemCode?: string;
        baseUrl?: string;
        apiKey?: { status?: string; masked?: string | null };
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
        message: result?.message,
        configurationId: result?.configurationId,
        environment: result?.environment,
        companyCode: result?.companyCode,
        systemCode: result?.systemCode,
        baseUrl: result?.baseUrl,
        apiKey: result?.apiKey,
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
    environment: 'test' | 'live';
    companyCode: string;
    systemCode: string | null;
  }): Promise<string> {
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
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': connection.apiKey,
      'X-Service-Context': serviceContext,
      [HTTP_HEADERS.SOURCE_SERVICE]: connection.sourceService,
      ...(requestId ? { [HTTP_HEADERS.REQUEST_ID]: requestId } : {}),
      ...(correlationId
        ? { [HTTP_HEADERS.CORRELATION_ID]: correlationId }
        : {}),
    };

    const keysResponse = await firstValueFrom(
      this.httpService.request({
        method: 'GET',
        baseURL: connection.baseUrl ?? undefined,
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
      tenantCompanyCode?: string | null;
      tenantSystemCode?: string | null;
      tenantEnvironment?: string | null;
      revokedAt?: string | null;
      isActive?: boolean;
    }>;
    const existing = keys.find(
      (key) =>
        key.id &&
        key.serviceName === connection.sourceService &&
        key.tenantCompanyCode === params.companyCode &&
        key.tenantSystemCode === params.systemCode &&
        key.tenantEnvironment === params.environment &&
        key.isActive !== false &&
        !key.revokedAt,
    );

    const keyResponse = await firstValueFrom(
      this.httpService.request({
        method: 'POST',
        baseURL: connection.baseUrl ?? undefined,
        url: existing?.id
          ? `/api/tiramis/api-keys/${existing.id}/rotate`
          : '/api/tiramis/api-keys',
        data: existing?.id
          ? undefined
          : {
              name: `${connection.sourceService} ${params.companyCode} ${params.environment}`,
              serviceName: connection.sourceService,
              tenantCompanyCode: params.companyCode,
              tenantSystemCode: params.systemCode,
              tenantEnvironment: params.environment,
              scopes: [
                'tiramis:admin',
                'tiramis:submit',
                'tiramis:prepare',
                'tiramis:read',
                'tiramis:verify',
                'tiramis:retry',
              ],
              description: `Managed from insurance portal ${params.environment} configuration.`,
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
      );

    return {
      companyId: organizationContext.company.id,
      companyCode: organizationContext.tiramis.companyCode!,
      insurerCompanyCode: organizationContext.tiramis.insurerCompanyCode!,
      systemCode: organizationContext.tiramis.systemCode!,
      clientCode: organizationContext.tiramis.clientCode,
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
          tenantContext.companyCode ||
          tenantContext.systemCode ||
          tenantContext.companyId,
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
          [HTTP_HEADERS.SOURCE_SERVICE]: connection.sourceService,
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
      environment ??
      this.configService.get<string>('tiramisClient.targetEnvironment') ??
      'test';
    const configuration = await this.companyConfigurationRepository
      .createQueryBuilder('configuration')
      .addSelect('configuration.serviceApiKeyEncrypted')
      .where('configuration.companyId = :companyId', { companyId })
      .andWhere('configuration.environment = :environment', {
        environment: targetEnvironment,
      })
      .andWhere('configuration.isActive = true')
      .getOne();

    const apiKey = this.apiKeyVault.decrypt(
      configuration?.serviceApiKeyEncrypted,
    );

    if (!apiKey) {
      throw new ConflictException(
        'TIRAMIS API key is not configured for the current company.',
      );
    }

    return {
      apiKey,
      baseUrl: configuration?.baseUrl ?? null,
      sourceService:
        configuration?.sourceService ||
        this.configService.getOrThrow<string>('tiramisClient.sourceService'),
    };
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
              }
            : await this.buildTiramisReadyTenantContext(authContext)
          : undefined;

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
        (tenantContext as { environment?: string } | undefined)?.environment ??
          null,
      );

      const response = await firstValueFrom(
        this.httpService.request({
          method: isQuery ? 'GET' : 'POST',
          baseURL: connection.baseUrl ?? undefined,

          url: route.path,

          params: isQuery ? payload : undefined,

          data: isQuery ? undefined : this.httpPayload(pattern, payload),

          validateStatus: () => true,

          headers: {
            Accept: 'application/json',

            'X-API-Key': connection.apiKey,
            'X-Service-Context': serviceContext,

            [HTTP_HEADERS.SOURCE_SERVICE]: connection.sourceService,

            'X-Actor-User-Id': authContext?.id ?? '',

            'X-Actor-Membership-Id': authContext?.companyMembershipId ?? '',

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
    const submissionPatterns = new Set<string>([
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
    ]);
    const resolvedPayload = submissionPatterns.has(pattern)
      ? this.stripSignedTenantBodyFields(payload)
      : payload;

    if (pattern === TIRAMIS_MESSAGE_PATTERNS.SUBMIT_MOTOR_FLEET) {
      return { ...resolvedPayload, isFleet: true };
    }

    return resolvedPayload;
  }

  private stripSignedTenantBodyFields(payload: Record<string, any>) {
    const {
      companyCode,
      systemCode,
      systemName,
      clientCode,
      branchCode,
      ...body
    } = payload;

    void companyCode;
    void systemCode;
    void systemName;
    void clientCode;
    void branchCode;

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
