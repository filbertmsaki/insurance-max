import { BadRequestException, Injectable } from '@nestjs/common';

import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisSubmissionTrackingRepository } from '../repositories/tiramis-submission-tracking.repository';
import { TiramisBusinessRecordSyncService } from './tiramis-business-record-sync.service';
import { TiramisRetryService } from './tiramis-retry.service';
import { TiramisStatusSyncService } from './tiramis-status-sync.service';

@Injectable()
export class TiramisMonitoringService {
  constructor(
    private readonly trackingRepository: TiramisSubmissionTrackingRepository,
    private readonly statusSyncService: TiramisStatusSyncService,
    private readonly retryService: TiramisRetryService,
    private readonly businessRecordSyncService: TiramisBusinessRecordSyncService,
  ) {}

  getSubmissions(
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.trackingRepository.findDashboardSubmissionsScoped(query, scope);
  }

  getStatistics(
    query: TiramisDashboardQueryDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.trackingRepository.getDashboardStatisticsScoped(query, scope);
  }

  getFailed(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.trackingRepository.findFailedSubmissionsScoped(limit, scope);
  }

  getRetryable(
    limit = 50,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    return this.trackingRepository.findRetryableSubmissionsScoped(limit, scope);
  }

  async getSubmission(id: string) {
    const tracking = await this.trackingRepository.findById(id);

    if (!tracking) {
      throw new BadRequestException('TIRAMIS tracking record not found');
    }

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
