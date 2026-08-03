import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ReportScheduleService } from '../services/report-schedule.service';

@Injectable()
export class ReportWorkerJob {
  private readonly logger = new Logger(ReportWorkerJob.name);

  constructor(private readonly reportScheduleService: ReportScheduleService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingJobs() {
    const job =
      await this.reportScheduleService.claimNextPendingJob('report-worker');

    if (!job) {
      return;
    }

    try {
      await this.reportScheduleService.executeJob(job.id);
    } catch (error) {
      this.logger.error(
        `Failed to execute report job ${job.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
