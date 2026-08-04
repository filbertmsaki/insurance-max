import { Injectable } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class BenchmarkService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async listSnapshots(query: {
    metricCode?: string;
    cohortKey?: string;
    from?: string;
    to?: string;
  }) {
    return this.analyticsService.listBenchmarkSnapshots(query);
  }
}
