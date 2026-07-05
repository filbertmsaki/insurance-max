import { Injectable, Logger } from '@nestjs/common';

import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisAuditLogRepository } from '../repositories/tiramis-audit-log.repository';

@Injectable()
export class TiramisAuditService {
  private readonly logger = new Logger(TiramisAuditService.name);

  constructor(
    private readonly auditLogRepository: TiramisAuditLogRepository,
  ) {}

  async log(params: {
    action: TiramisAuditAction;
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
    authContext?: any;
  }) {
    try {
      const entity = this.auditLogRepository.create({
        action: params.action,
        requestType: (params.requestType as any) || null,
        sourceService: params.sourceService || 'insurance-portal-service',
        sourceCompanyId:
          params.sourceCompanyId ||
          params.authContext?.companyId ||
          params.authContext?.activeCompanyId ||
          null,
        sourceUserId:
          params.sourceUserId ||
          params.authContext?.userId ||
          null,
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
        metadata: this.sanitizeMetadata(params.metadata),
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
      metadata: params.metadata,
      authContext: params.authContext,
    });
  }

  findRecent(limit = 100) {
    return this.auditLogRepository.findRecent(limit);
  }

  findByTrackingId(localTrackingId: string) {
    return this.auditLogRepository.findByTrackingId(localTrackingId);
  }

  findByBusinessReference(businessReference: string) {
    return this.auditLogRepository.findByBusinessReference(businessReference);
  }

  private extractErrorMessage(error: any): string | null {
    if (!error) {
      return null;
    }

    return (
      error?.message ||
      error?.response?.message ||
      error?.error?.message ||
      String(error)
    );
  }

  private sanitizeMetadata(metadata?: Record<string, any> | null) {
    if (!metadata) {
      return null;
    }

    const clone = JSON.parse(JSON.stringify(metadata));

    delete clone.password;
    delete clone.token;
    delete clone.accessToken;
    delete clone.refreshToken;
    delete clone.authorization;
    delete clone.privateKey;
    delete clone.certificatePassword;
    delete clone.pfxPassword;

    return clone;
  }
}
