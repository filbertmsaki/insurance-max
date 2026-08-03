import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ReportScheduleService } from '../services/report-schedule.service';

@Injectable()
export class ReportSchedulerJob {
  constructor(private readonly reportScheduleService: ReportScheduleService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async enqueueDueSchedules() {
    await this.reportScheduleService.createJobsForDueSchedules();
  }
}
