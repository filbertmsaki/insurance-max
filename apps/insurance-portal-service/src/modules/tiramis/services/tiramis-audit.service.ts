import { environment } from '@insurance-max/shared-config';
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { FilterTiramisAuditLogDto } from '../dto/filter-tiramis-audit-log.dto';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisAuditSeverity } from '../enums/tiramis-audit-severity.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisAuditLogRepository } from '../repositories/tiramis-audit-log.repository';

@Injectable()
export class TiramisAuditService {
  private readonly logger = new Logger(TiramisAuditService.name);

  constructor(private readonly auditLogRepository: TiramisAuditLogRepository) {}

  async log(params: {
    action: TiramisAuditAction;
    severity?: TiramisAuditSeverity;
    correlationId?: string | null;
    eventKey?: string | null;
    requestType?: TiramisRequestType | string | null;
    sourceService?: string | null;
    sourceCompanyId?: string | null;
    sourceUserId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
    localTrackingId?: string | null;
    tiramisTransactionId?: string | null;
    tiramisRequestId?: string | null;
    statusBefore?: string | null;
    statusAfter?: string | null;
    success?: boolean;
    error?: any;
    metadata?: Record<string, any> | null;
    requestPayloadSnapshot?: Record<string, any> | null;
    responsePayloadSnapshot?: Record<string, any> | null;
    durationMs?: number | null;
    authContext?: any;
  }) {
    if (environment.TIRAMIS_AUDIT_ENABLED === 'false') {
      return null;
    }

    try {
      const correlationId =
        params.correlationId ||
        params.authContext?.correlationId ||
        params.authContext?.requestId ||
        this.buildCorrelationId(params);

      const entity = this.auditLogRepository.create({
        action: params.action,
        severity: params.severity || this.resolveSeverity(params),
        correlationId,
        eventKey: params.eventKey || this.buildEventKey(params, correlationId),
        requestType: (params.requestType as any) || null,
        sourceService: params.sourceService || 'insurance-portal-service',
        sourceCompanyId:
          params.sourceCompanyId ||
          params.authContext?.companyId ||
          params.authContext?.activeCompanyId ||
          params.authContext?.active_company_id ||
          null,
        sourceUserId:
          params.sourceUserId ||
          params.authContext?.userId ||
          params.authContext?.sub ||
          params.authContext?.id ||
          null,
        actorUserType:
          params.authContext?.userType || params.authContext?.user_type || null,
        actorEmail:
          params.authContext?.email || params.authContext?.userEmail || null,
        sourceModule: params.sourceModule || null,
        sourceRecordId: params.sourceRecordId || null,
        businessReference: params.businessReference || null,
        localTrackingId: params.localTrackingId || null,
        tiramisTransactionId: params.tiramisTransactionId || null,
        tiramisRequestId: params.tiramisRequestId || null,
        statusBefore: params.statusBefore || null,
        statusAfter: params.statusAfter || null,
        success: params.success !== false,
        errorMessage: this.extractErrorMessage(params.error),
        ipAddress: params.authContext?.ipAddress || null,
        userAgent: params.authContext?.userAgent || null,
        httpMethod: params.authContext?.method || null,
        endpoint: params.authContext?.endpoint || null,
        durationMs: params.durationMs || null,
        metadata: this.sanitizeMetadata(params.metadata),
        requestPayloadSnapshot: this.shouldStorePayloadSnapshot()
          ? this.sanitizeMetadata(params.requestPayloadSnapshot)
          : null,
        responsePayloadSnapshot: this.shouldStorePayloadSnapshot()
          ? this.sanitizeMetadata(params.responsePayloadSnapshot)
          : null,
      });

      return await this.auditLogRepository.save(entity);
    } catch (error: any) {
      this.logger.warn(
        `Failed to write TIRAMIS audit log: ${error?.message || error}`,
      );

      return null;
    }
  }

  async logFromTracking(params: {
    action: TiramisAuditAction;
    tracking: any;
    statusBefore?: string | null;
    success?: boolean;
    error?: any;
    metadata?: Record<string, any> | null;
    requestPayloadSnapshot?: Record<string, any> | null;
    responsePayloadSnapshot?: Record<string, any> | null;
    durationMs?: number | null;
    authContext?: any;
  }) {
    const tracking = params.tracking || {};

    return this.log({
      action: params.action,
      requestType: tracking.requestType,
      sourceService: tracking.sourceService,
      sourceCompanyId: tracking.sourceCompanyId,
      sourceUserId: tracking.sourceUserId,
      sourceModule: tracking.sourceModule,
      sourceRecordId: tracking.sourceRecordId,
      businessReference: tracking.businessReference,
      localTrackingId: tracking.id,
      tiramisTransactionId: tracking.tiramisTransactionId,
      tiramisRequestId: tracking.tiramisRequestId,
      statusBefore: params.statusBefore || null,
      statusAfter: tracking.status || null,
      success: params.success,
      error: params.error,
      metadata: {
        ...(params.metadata || {}),
        retryAttempts: tracking.retryAttempts,
        maxRetryAttempts: tracking.maxRetryAttempts,
        idempotencyKey: tracking.idempotencyKey,
        businessFingerprint: tracking.businessFingerprint,
      },
      requestPayloadSnapshot:
        params.requestPayloadSnapshot || tracking.requestPayload || null,
      responsePayloadSnapshot:
        params.responsePayloadSnapshot ||
        tracking.tiramisResponsePayload ||
        tracking.finalResponsePayload ||
        null,
      durationMs: params.durationMs,
      authContext: params.authContext,
    });
  }

  search(
    query: FilterTiramisAuditLogDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.auditLogRepository.search(query, scope);
  }

  findById(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.auditLogRepository.findById(id, scope);
  }

  findRecent(
    limit = 100,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.auditLogRepository.findRecent(limit, scope);
  }

  findByTrackingId(
    localTrackingId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.auditLogRepository.findByTrackingId(localTrackingId, scope);
  }

  findByCorrelationId(
    correlationId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.auditLogRepository.findByCorrelationId(correlationId, scope);
  }

  findByBusinessReference(
    businessReference: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.auditLogRepository.findByBusinessReference(
      businessReference,
      scope,
    );
  }

  private resolveSeverity(params: {
    success?: boolean;
    action: TiramisAuditAction;
    error?: any;
  }): TiramisAuditSeverity {
    if (params.error || params.success === false) {
      return TiramisAuditSeverity.ERROR;
    }

    if (
      [
        TiramisAuditAction.DUPLICATE_PREVENTED,
        TiramisAuditAction.RETRY_REQUESTED,
        TiramisAuditAction.STATUS_SYNC_REQUESTED,
      ].includes(params.action)
    ) {
      return TiramisAuditSeverity.WARNING;
    }

    return TiramisAuditSeverity.INFO;
  }

  private buildCorrelationId(params: {
    localTrackingId?: string | null;
    tiramisRequestId?: string | null;
    businessReference?: string | null;
  }): string {
    const base =
      params.localTrackingId ||
      params.tiramisRequestId ||
      params.businessReference ||
      crypto.randomUUID();

    return `tiramis-${base}`;
  }

  private buildEventKey(
    params: {
      action: TiramisAuditAction;
      localTrackingId?: string | null;
      sourceRecordId?: string | null;
      businessReference?: string | null;
    },
    correlationId: string,
  ): string {
    return [
      params.action,
      params.localTrackingId ||
        params.sourceRecordId ||
        params.businessReference ||
        correlationId,
      Date.now(),
    ].join(':');
  }

  private extractErrorMessage(error: any): string | null {
    if (!error) {
      return null;
    }

    const message =
      error?.message ||
      error?.response?.message ||
      error?.error?.message ||
      String(error);

    return Array.isArray(message) ? message.join(', ') : String(message);
  }

  private shouldStorePayloadSnapshot(): boolean {
    return environment.TIRAMIS_AUDIT_STORE_PAYLOAD_SNAPSHOT === 'true';
  }

  private sanitizeMetadata(metadata?: Record<string, any> | null): any {
    if (!metadata) {
      return null;
    }

    const maxSize = Number(
      environment.TIRAMIS_AUDIT_MAX_METADATA_SIZE || 20000,
    );
    let clone: any;

    try {
      clone = JSON.parse(JSON.stringify(metadata));
    } catch {
      return {
        value: '[unserializable]',
      };
    }

    clone = this.deepRedact(clone);

    const json = JSON.stringify(clone);

    if (json.length > maxSize) {
      return {
        truncated: true,
        maxSize,
        preview: json.slice(0, maxSize),
      };
    }

    return clone;
  }

  private deepRedact(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.deepRedact(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const sensitiveKeys = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'privateKey',
      'clientKey',
      'certificatePassword',
      'pfxPassword',
      'signature',
      'requestSignature',
      'responseSignature',
      'pfx',
      'secret',
    ];

    const result: Record<string, any> = {};

    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();

      if (
        sensitiveKeys.some((sensitive) =>
          normalizedKey.includes(sensitive.toLowerCase()),
        )
      ) {
        result[key] = '[redacted]';
      } else {
        result[key] = this.deepRedact(item);
      }
    }

    return result;
  }
}
