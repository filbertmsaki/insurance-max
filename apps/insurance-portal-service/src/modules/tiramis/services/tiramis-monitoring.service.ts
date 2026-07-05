import { BadRequestException, Injectable } from '@nestjs/common';

import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisRetryService } from './tiramis-retry.service';
import { TiramisStatusSyncService } from './tiramis-status-sync.service';
import { TiramisAuditService } from './tiramis-audit.service';

@Injectable()
export class TiramisMonitoringService {
  constructor(
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly statusSyncService: TiramisStatusSyncService,
    private readonly retryService: TiramisRetryService,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
  ) {}

  getSubmissions(
    query: TiramisDashboardQueryDto,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    void this.auditService.log({
      action: TiramisAuditAction.ADMIN_VIEW_SUBMISSIONS,
      sourceCompanyId: authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: {
        query,
      },
    });

    return this.trackingRepository.findDashboardSubmissionsScoped(query, scope);
  }

  getStatistics(
    query: TiramisDashboardQueryDto,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    void this.auditService.log({
      action: TiramisAuditAction.ADMIN_VIEW_STATISTICS,
      sourceCompanyId: authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: {
        query,
      },
    });

    return this.trackingRepository.getDashboardStatisticsScoped(query, scope);
  }

  getFailed(
    limit = 50,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    void this.auditService.log({
      action: TiramisAuditAction.ADMIN_VIEW_SUBMISSIONS,
      sourceCompanyId: authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: {
        view: 'failed',
        limit,
      },
    });

    return this.trackingRepository.findFailedSubmissionsScoped(limit, scope);
  }

  getRetryable(
    limit = 50,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    void this.auditService.log({
      action: TiramisAuditAction.ADMIN_VIEW_SUBMISSIONS,
      sourceCompanyId: authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: {
        view: 'retryable',
        limit,
      },
    });

    return this.trackingRepository.findRetryableSubmissionsScoped(limit, scope);
  }

  async getSubmission(id: string, authContext?: any) {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS tracking record not found');
    }

    void this.auditService.logFromTracking({
      action: TiramisAuditAction.ADMIN_VIEW_SUBMISSION_DETAIL,
      tracking,
      success: true,
      authContext,
    });

    return tracking;
  }

  retryOne(id: string) {
    return this.retryService.retryOne(id);
  }

  retryAll() {
    return this.retryService.retryPendingSubmissions();
  }

  syncOne(id: string) {
    return this.statusSyncService.syncOne(id);
  }

  syncAll() {
    return this.statusSyncService.syncPendingFinalStatuses();
  }

  async syncBusinessRecord(id: string) {
    const tracking = await this.getSubmission(id);

    const result = await this.businessRecordSyncService.syncFromTracking(
      tracking,
    );

    return {
      tracking,
      syncResult: result,
    };
  }
}
