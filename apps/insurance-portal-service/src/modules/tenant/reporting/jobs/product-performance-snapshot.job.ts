import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { ProductPerformanceSnapshotService } from '../services/product-performance-snapshot.service';

/**
 * Refreshes `product_performance_snapshots` once a day for every active
 * company, covering the trailing full month up to today. Without this job
 * the table stays permanently empty and the `product-performance` report
 * always returns zero rows.
 */
@Injectable()
export class ProductPerformanceSnapshotJob {
  private readonly logger = new Logger(ProductPerformanceSnapshotJob.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly snapshotService: ProductPerformanceSnapshotService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async refreshAllCompanies() {
    const companies: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM companies WHERE status = 'active' AND deleted_at IS NULL`,
    );

    const today = new Date();
    const snapshotDate = today.toISOString().slice(0, 10);
    const periodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 10);
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      .toISOString()
      .slice(0, 10);

    let refreshed = 0;

    for (const company of companies) {
      try {
        await this.snapshotService.refreshSnapshots({
          companyId: company.id,
          periodStart,
          periodEnd,
          snapshotDate,
        });
        refreshed += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to refresh product performance snapshots for company ${company.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    if (refreshed > 0) {
      this.logger.log(
        `Refreshed product performance snapshots for ${refreshed}/${companies.length} companies`,
      );
    }
  }
}
