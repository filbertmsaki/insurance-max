import { Injectable, Logger } from '@nestjs/common';

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
      type: TiramisNotificationType.SUBMISSION_FAILED,
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

  findRecent(limit = 50) {
    return this.notificationRepository.findRecent(limit);
  }

  findUnread(limit = 50) {
    return this.notificationRepository.findUnread(limit);
  }

  findByTrackingId(localTrackingId: string) {
    return this.notificationRepository.findByTrackingId(localTrackingId);
  }

  findByBusinessReference(businessReference: string) {
    return this.notificationRepository.findByBusinessReference(
      businessReference,
    );
  }

  markRead(id: string, userId?: string | null) {
    return this.notificationRepository.markRead(id, userId);
  }

  markAllRead(userId?: string | null) {
    return this.notificationRepository.markAllRead(userId);
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

    try {
      const notification = await this.notificationRepository.save(
        this.notificationRepository.create({
          type: params.type,
          severity: params.severity,
          title: params.title,
          message: params.message,
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
          errorMessage:
            tracking.lastErrorMessage ||
            this.extractErrorMessage(params.error) ||
            null,
          metadata: this.sanitizeMetadata({
            ...(params.metadata || {}),
            finalResponseStatusCode: tracking.finalResponseStatusCode || null,
            finalResponseStatusDesc: tracking.finalResponseStatusDesc || null,
            retryAttempts: tracking.retryAttempts || 0,
            maxRetryAttempts: tracking.maxRetryAttempts || 0,
          }),
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
    const webhookUrl = process.env.TIRAMIS_NOTIFICATION_WEBHOOK_URL;

    if (!webhookUrl) {
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.TIRAMIS_NOTIFICATION_WEBHOOK_TOKEN
            ? {
                Authorization: `Bearer ${process.env.TIRAMIS_NOTIFICATION_WEBHOOK_TOKEN}`,
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
        this.logger.warn(
          `TIRAMIS notification webhook failed with status ${response.status}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `TIRAMIS notification webhook error: ${error?.message || error}`,
      );
    }
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
