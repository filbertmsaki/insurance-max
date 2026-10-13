import { BadRequestException, Injectable } from '@nestjs/common';

import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisAuditAction } from '../enums/tiramis-audit-action.enum';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisDashboardService } from './tiramis-dashboard.service';
import { TiramisRetryService } from './tiramis-retry.service';
import { TiramisStatusSyncService } from './tiramis-status-sync.service';
import { TiramisAuditService } from './tiramis-audit.service';
import type { ListQueryInput } from '@insurance-max/portal-shared/utils/paginate-query.util';

@Injectable()
export class TiramisMonitoringService {
  constructor(
    private readonly dashboardService: TiramisDashboardService,
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly statusSyncService: TiramisStatusSyncService,
    private readonly retryService: TiramisRetryService,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
    private readonly auditService: TiramisAuditService,
  ) {}

  getDashboard(
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.dashboardService.getDashboard(query, scope);
  }

  getHealth(
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.dashboardService.getHealth(query, scope);
  }

  getTrackingTimeline(
    localTrackingId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.dashboardService.getTrackingTimeline(localTrackingId, scope);
  }

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
      sourceCompanyId:
        authContext?.companyId || authContext?.activeCompanyId || null,
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
      sourceCompanyId:
        authContext?.companyId || authContext?.activeCompanyId || null,
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
      sourceCompanyId:
        authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: {
        view: 'failed',
        limit,
      },
    });

    return this.trackingRepository.findFailedSubmissionsScoped(limit, scope);
  }

  /** Paged variants used by the server-side tables (`?page=` present). */
  getFailedPage(
    query: ListQueryInput,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    void this.auditService.log({
      action: TiramisAuditAction.ADMIN_VIEW_SUBMISSIONS,
      sourceCompanyId:
        authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: { view: 'failed', query },
    });

    return this.trackingRepository.findFailedSubmissionsPage(query, scope);
  }

  getRetryablePage(
    query: ListQueryInput,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    void this.auditService.log({
      action: TiramisAuditAction.ADMIN_VIEW_SUBMISSIONS,
      sourceCompanyId:
        authContext?.companyId || authContext?.activeCompanyId || null,
      sourceUserId: authContext?.userId || null,
      authContext,
      metadata: { view: 'retryable', query },
    });

    return this.trackingRepository.findRetryableSubmissionsPage(query, scope);
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
      sourceCompanyId:
        authContext?.companyId || authContext?.activeCompanyId || null,
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
    return this.getSubmissionScoped(id, authContext);
  }

  async getSubmissionScoped(
    id: string,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS tracking record not found');
    }

    if (
      scope?.companyId &&
      !scope.canAccessAllCompanies &&
      String(tracking.sourceCompanyId || '') !== String(scope.companyId)
    ) {
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

  async retryOne(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    await this.getSubmissionScoped(id, null, scope);
    return this.retryService.retryOne(id);
  }

  retryAll() {
    return this.retryService.retryPendingSubmissions({
      automatic: false,
    });
  }

  async scheduleRetry(
    id: string,
    reason?: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    await this.getSubmissionScoped(id, null, scope);
    return this.retryService.scheduleRetry(id, reason);
  }

  async syncOne(
    id: string,
    authContext?: any,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    await this.getSubmissionScoped(id, null, scope);
    return this.statusSyncService.syncOne(id, authContext);
  }

  syncAll() {
    return this.statusSyncService.syncPendingFinalStatuses({
      automatic: false,
    });
  }

  async syncBusinessRecord(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const tracking = await this.getSubmissionScoped(id, null, scope);

    const result =
      await this.businessRecordSyncService.syncFromTracking(tracking);

    return {
      tracking,
      syncResult: result,
    };
  }
}
