import { environment } from '@insurance-max/shared-config';
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { FilterTiramisNotificationDto } from '../dto/filter-tiramis-notification.dto';
import { TiramisNotificationDeliveryStatus } from '../enums/tiramis-notification-delivery-status.enum';
import { TiramisNotificationSeverity } from '../enums/tiramis-notification-severity.enum';
import { TiramisNotificationType } from '../enums/tiramis-notification-type.enum';
import { TiramisNotificationRepository } from '../repositories/tiramis-notification.repository';

@Injectable()
export class TiramisNotificationService {
  private readonly logger = new Logger(TiramisNotificationService.name);

  constructor(
    private readonly notificationRepository: TiramisNotificationRepository,
  ) {}

  async notifySubmissionFailed(params: {
    tracking: any;
    error?: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: params.tracking?.isRetryable
        ? TiramisNotificationType.SUBMISSION_RETRY_SCHEDULED
        : TiramisNotificationType.SUBMISSION_FAILED,
      severity: params.tracking?.isRetryable
        ? TiramisNotificationSeverity.WARNING
        : TiramisNotificationSeverity.ERROR,
      title: params.tracking?.isRetryable
        ? 'TIRAMIS submission failed and will be retried'
        : 'TIRAMIS submission failed',
      message:
        params.tracking?.lastErrorMessage ||
        this.extractErrorMessage(params.error) ||
        'TIRAMIS submission failed.',
      tracking: params.tracking,
      error: params.error,
      metadata: params.metadata,
    });
  }

  async notifyValidationFailed(params: {
    tracking?: any;
    requestType?: string | null;
    sourceCompanyId?: string | null;
    sourceUserId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
    errors?: any[];
    metadata?: Record<string, any> | null;
  }) {
    return this.create({
      type: TiramisNotificationType.VALIDATION_FAILED,
      severity: TiramisNotificationSeverity.WARNING,
      title: 'TIRAMIS validation failed',
      message:
        'The TIRAMIS payload failed portal validation before submission.',
      tracking: params.tracking,
      requestType: params.requestType,
      sourceCompanyId: params.sourceCompanyId,
      sourceUserId: params.sourceUserId,
      sourceModule: params.sourceModule,
      sourceRecordId: params.sourceRecordId,
      businessReference: params.businessReference,
      metadata: {
        ...(params.metadata || {}),
        errors: params.errors || [],
      },
    });
  }

  async notifyDuplicatePrevented(params: {
    tracking?: any;
    existingTracking?: any;
    reason?: string | null;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.DUPLICATE_PREVENTED,
      severity: TiramisNotificationSeverity.WARNING,
      title: 'Duplicate TIRAMIS submission prevented',
      message:
        params.reason ||
        'A duplicate TIRAMIS submission was prevented by idempotency rules.',
      tracking: params.existingTracking || params.tracking,
      metadata: {
        ...(params.metadata || {}),
        duplicateOfTrackingId:
          params.existingTracking?.id || params.tracking?.duplicateOfTrackingId,
      },
    });
  }

  async notifyRetryFailed(params: {
    tracking: any;
    error?: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.RETRY_FAILED,
      severity: TiramisNotificationSeverity.WARNING,
      title: 'TIRAMIS retry failed',
      message:
        params.tracking?.retryErrorMessage ||
        this.extractErrorMessage(params.error) ||
        'TIRAMIS retry attempt failed.',
      tracking: params.tracking,
      error: params.error,
      metadata: params.metadata,
    });
  }

  async notifyRetryExhausted(params: {
    tracking: any;
    error?: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.RETRY_EXHAUSTED,
      severity: TiramisNotificationSeverity.CRITICAL,
      title: 'TIRAMIS retry exhausted',
      message:
        params.tracking?.lastErrorMessage ||
        this.extractErrorMessage(params.error) ||
        'TIRAMIS retry attempts have been exhausted.',
      tracking: params.tracking,
      error: params.error,
      metadata: params.metadata,
    });
  }

  async notifyFinalResponseSuccess(params: {
    tracking: any;
    metadata?: Record<string, any> | null;
  }) {
    if (environment.TIRAMIS_NOTIFICATION_NOTIFY_FINAL_SUCCESS !== 'true') {
      return null;
    }

    return this.createFromTracking({
      type: TiramisNotificationType.FINAL_RESPONSE_SUCCESS,
      severity: TiramisNotificationSeverity.INFO,
      title: 'TIRAMIS final response successful',
      message:
        params.tracking?.finalResponseStatusDesc ||
        'TIRAMIS returned a successful final response.',
      tracking: params.tracking,
      metadata: params.metadata,
    });
  }

  async notifyFinalResponseFailed(params: {
    tracking: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.FINAL_RESPONSE_FAILED,
      severity: TiramisNotificationSeverity.ERROR,
      title: 'TIRAMIS final response failed',
      message:
        params.tracking?.finalResponseStatusDesc ||
        params.tracking?.lastErrorMessage ||
        'TIRAMIS returned a failed final response.',
      tracking: params.tracking,
      metadata: params.metadata,
    });
  }

  async notifyCallbackOverdue(params: {
    tracking: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.CALLBACK_OVERDUE,
      severity: TiramisNotificationSeverity.WARNING,
      title: 'TIRAMIS final callback overdue',
      message:
        params.tracking?.lastErrorMessage ||
        'TIRAMIS acknowledgement was accepted, but the final callback is overdue.',
      tracking: params.tracking,
      metadata: params.metadata,
    });
  }

  async notifyStatusSyncFailed(params: {
    tracking: any;
    error?: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.STATUS_SYNC_FAILED,
      severity: TiramisNotificationSeverity.WARNING,
      title: 'TIRAMIS status sync failed',
      message:
        this.extractErrorMessage(params.error) ||
        'Failed to sync latest status from tiramis-service.',
      tracking: params.tracking,
      error: params.error,
      metadata: params.metadata,
    });
  }

  async notifyBusinessRecordSyncSuccess(params: {
    tracking: any;
    metadata?: Record<string, any> | null;
  }) {
    if (
      environment.TIRAMIS_NOTIFICATION_NOTIFY_BUSINESS_SYNC_SUCCESS !== 'true'
    ) {
      return null;
    }

    return this.createFromTracking({
      type: TiramisNotificationType.BUSINESS_RECORD_SYNC_SUCCESS,
      severity: TiramisNotificationSeverity.INFO,
      title: 'TIRAMIS business record synced',
      message: 'TIRAMIS status was synced to the business record.',
      tracking: params.tracking,
      metadata: params.metadata,
    });
  }

  async notifyBusinessRecordSyncFailed(params: {
    tracking: any;
    error?: any;
    metadata?: Record<string, any> | null;
  }) {
    return this.createFromTracking({
      type: TiramisNotificationType.BUSINESS_RECORD_SYNC_FAILED,
      severity: TiramisNotificationSeverity.WARNING,
      title: 'TIRAMIS business record sync failed',
      message:
        this.extractErrorMessage(params.error) ||
        params.tracking?.businessRecordSyncError ||
        'Failed to sync TIRAMIS status to business record.',
      tracking: params.tracking,
      error: params.error,
      metadata: params.metadata,
    });
  }

  search(
    query: FilterTiramisNotificationDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.search(query, scope);
  }

  getSummary(scope?: {
    companyId?: string | null;
    canAccessAllCompanies?: boolean;
  }) {
    return this.notificationRepository.getSummary(scope);
  }

  findRecent(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.findRecent(limit, scope);
  }

  findUnread(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.findUnread(limit, scope);
  }

  findByTrackingId(
    localTrackingId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.findByTrackingId(localTrackingId, scope);
  }

  findByBusinessReference(
    businessReference: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.findByBusinessReference(
      businessReference,
      scope,
    );
  }

  markRead(
    id: string,
    userId?: string | null,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.markRead(id, userId, scope);
  }

  markUnread(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.markUnread(id, scope);
  }

  markAllRead(params?: {
    userId?: string | null;
    sourceCompanyId?: string | null;
    canAccessAllCompanies?: boolean;
  }) {
    return this.notificationRepository.markAllRead(params);
  }

  dismiss(
    id: string,
    userId?: string | null,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.notificationRepository.dismiss(id, userId, scope);
  }

  private async createFromTracking(params: {
    type: TiramisNotificationType;
    severity: TiramisNotificationSeverity;
    title: string;
    message: string;
    tracking: any;
    error?: any;
    metadata?: Record<string, any> | null;
  }) {
    const tracking = params.tracking || {};

    return this.create({
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      tracking,
      error: params.error,
      requestType: tracking.requestType || null,
      sourceCompanyId: tracking.sourceCompanyId || null,
      sourceUserId: tracking.sourceUserId || null,
      sourceModule: tracking.sourceModule || null,
      sourceRecordId: tracking.sourceRecordId || null,
      businessReference: tracking.businessReference || null,
      localTrackingId: tracking.id || null,
      tiramisTransactionId: tracking.tiramisTransactionId || null,
      tiramisRequestId: tracking.tiramisRequestId || null,
      status: tracking.status || null,
      metadata: {
        ...(params.metadata || {}),
        finalResponseStatusCode: tracking.finalResponseStatusCode || null,
        finalResponseStatusDesc: tracking.finalResponseStatusDesc || null,
        acknowledgementStatusCode: tracking.acknowledgementStatusCode || null,
        acknowledgementStatusDesc: tracking.acknowledgementStatusDesc || null,
        retryAttempts: tracking.retryAttempts || 0,
        maxRetryAttempts: tracking.maxRetryAttempts || 0,
        idempotencyKey: tracking.idempotencyKey || null,
        businessFingerprint: tracking.businessFingerprint || null,
      },
    });
  }

  private async create(params: {
    type: TiramisNotificationType;
    severity: TiramisNotificationSeverity;
    title: string;
    message: string;
    tracking?: any;
    error?: any;
    requestType?: string | null;
    sourceCompanyId?: string | null;
    sourceUserId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
    localTrackingId?: string | null;
    tiramisTransactionId?: string | null;
    tiramisRequestId?: string | null;
    status?: string | null;
    metadata?: Record<string, any> | null;
  }) {
    if (environment.TIRAMIS_NOTIFICATION_ENABLED === 'false') {
      return null;
    }

    try {
      const dedupeKey = this.buildDedupeKey(params);
      const dedupeMinutes = Number(
        environment.TIRAMIS_NOTIFICATION_DEDUPE_MINUTES || 30,
      );

      const existing =
        await this.notificationRepository.findDuplicateByDedupeKey({
          dedupeKey,
          withinMinutes: dedupeMinutes,
        });

      if (existing) {
        return existing;
      }

      const notification = await this.notificationRepository.save(
        this.notificationRepository.create({
          type: params.type,
          severity: params.severity,
          title: params.title,
          message: params.message,
          correlationId: this.resolveCorrelationId(params),
          eventKey: this.buildEventKey(params),
          dedupeKey,
          channel: 'IN_APP',
          deliveryStatus: TiramisNotificationDeliveryStatus.PENDING,
          requestType: (params.requestType as any) || null,
          sourceCompanyId: params.sourceCompanyId || null,
          sourceUserId: params.sourceUserId || null,
          sourceModule: params.sourceModule || null,
          sourceRecordId: params.sourceRecordId || null,
          businessReference: params.businessReference || null,
          localTrackingId: params.localTrackingId || null,
          tiramisTransactionId: params.tiramisTransactionId || null,
          tiramisRequestId: params.tiramisRequestId || null,
          status: params.status || null,
          errorMessage:
            this.extractErrorMessage(params.error) ||
            params.tracking?.lastErrorMessage ||
            null,
          metadata: this.sanitizeMetadata(params.metadata),
        }),
      );

      await this.sendWebhookIfEnabled(notification);

      return notification;
    } catch (error: any) {
      this.logger.warn(
        `Failed to create TIRAMIS notification: ${error?.message || error}`,
      );

      return null;
    }
  }

  private async sendWebhookIfEnabled(notification: any) {
    if (environment.TIRAMIS_NOTIFICATION_WEBHOOK_ENABLED !== 'true') {
      await this.notificationRepository.markDeliverySkipped(
        notification.id,
        'Webhook disabled',
      );
      return;
    }

    const webhookUrl = environment.TIRAMIS_NOTIFICATION_WEBHOOK_URL;

    if (!webhookUrl) {
      await this.notificationRepository.markDeliverySkipped(
        notification.id,
        'Webhook URL not configured',
      );
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(environment.TIRAMIS_NOTIFICATION_WEBHOOK_TOKEN
            ? {
                Authorization: `Bearer ${environment.TIRAMIS_NOTIFICATION_WEBHOOK_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({
          source: 'insurance-portal-service',
          module: 'tiramis',
          notification,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Notification webhook failed with status ${response.status}`,
        );
      }

      await this.notificationRepository.markDeliverySent(notification.id);
    } catch (error: any) {
      await this.notificationRepository.markDeliveryFailed(
        notification.id,
        error,
      );

      this.logger.warn(
        `TIRAMIS notification webhook error: ${error?.message || error}`,
      );
    }
  }

  private resolveCorrelationId(params: {
    localTrackingId?: string | null;
    tiramisRequestId?: string | null;
    businessReference?: string | null;
  }) {
    return (
      params.localTrackingId ||
      params.tiramisRequestId ||
      params.businessReference ||
      crypto.randomUUID()
    );
  }

  private buildEventKey(params: {
    type: TiramisNotificationType;
    localTrackingId?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    return [
      params.type,
      params.localTrackingId ||
        params.sourceRecordId ||
        params.businessReference ||
        crypto.randomUUID(),
      Date.now(),
    ].join(':');
  }

  private buildDedupeKey(params: {
    type: TiramisNotificationType;
    requestType?: string | null;
    localTrackingId?: string | null;
    sourceCompanyId?: string | null;
    sourceModule?: string | null;
    sourceRecordId?: string | null;
    businessReference?: string | null;
  }) {
    const raw = [
      params.type,
      params.requestType || '',
      params.localTrackingId || '',
      params.sourceCompanyId || '',
      params.sourceModule || '',
      params.sourceRecordId || '',
      params.businessReference || '',
    ]
      .map((item) => String(item).trim().toLowerCase())
      .join('|');

    return crypto.createHash('sha256').update(raw).digest('hex');
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

  private sanitizeMetadata(metadata?: Record<string, any> | null) {
    if (!metadata) {
      return null;
    }

    const maxSize = Number(
      environment.TIRAMIS_NOTIFICATION_MAX_METADATA_SIZE || 20000,
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
