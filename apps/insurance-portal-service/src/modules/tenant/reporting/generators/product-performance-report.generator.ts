import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductPerformanceSnapshot } from '../../regulatory-compliance/entities/product-performance-snapshot.entity';
import { ReportDefinition } from '../entities/report-definition.entity';
import {
  GeneratedReportPayload,
  ReportGenerator,
  ReportGeneratorContext,
} from '../interfaces/report-generator.interface';

@Injectable()
export class ProductPerformanceReportGenerator implements ReportGenerator {
  readonly key = 'product-performance';

  constructor(
    @InjectRepository(ProductPerformanceSnapshot)
    private readonly snapshotRepository: Repository<ProductPerformanceSnapshot>,
  ) {}

  supports(definition: ReportDefinition): boolean {
    return definition.generator_key === this.key;
  }

  async generate(
    context: ReportGeneratorContext,
  ): Promise<GeneratedReportPayload> {
    const filters = context.parameters ?? context.filters ?? {};
    const periodStart =
      typeof filters.period_start === 'string' ? filters.period_start : null;
    const periodEnd =
      typeof filters.period_end === 'string' ? filters.period_end : null;
    const branchId =
      typeof filters.branch_id === 'string'
        ? filters.branch_id
        : context.branchId;
    const allowedBranchIds = Array.from(
      new Set(context.allowedBranchIds ?? []),
    );
    const allowedDepartmentIds = Array.from(
      new Set(context.allowedDepartmentIds ?? []),
    );

    const query = this.snapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.company_id = :companyId', {
        companyId: context.companyId,
      });

    if (periodStart) {
      query.andWhere('snapshot.period_start >= :periodStart', { periodStart });
    }
    if (periodEnd) {
      query.andWhere('snapshot.period_end <= :periodEnd', { periodEnd });
    }
    if (branchId) {
      query.andWhere('snapshot.branch_id = :branchId', { branchId });
    } else if (context.allowedBranchIds) {
      if (!allowedBranchIds.length) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('snapshot.branch_id IN (:...allowedBranchIds)', {
          allowedBranchIds,
        });
      }
    }
    if (context.allowedDepartmentIds) {
      if (!allowedDepartmentIds.length) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('snapshot.department_id IN (:...allowedDepartmentIds)', {
          allowedDepartmentIds,
        });
      }
    }
    if (context.scopedUserId) {
      query.andWhere('snapshot.user_id = :scopedUserId', {
        scopedUserId: context.scopedUserId,
      });
    }

    const rows = await query
      .orderBy('snapshot.snapshot_date', 'DESC')
      .getMany();

    return {
      columns: [
        'snapshot_date',
        'branch_id',
        'department_id',
        'user_id',
        'product_id',
        'currency',
        'gross_written_premium',
        'earned_premium',
        'premium_collected',
        'claims_incurred',
        'claims_paid',
        'outstanding_reserve',
        'ceded_premium',
        'policies_count',
        'claims_count',
        'loss_ratio',
      ],
      rows: rows.map((row) => ({
        snapshot_date: row.snapshot_date,
        branch_id: row.branch_id,
        department_id: row.department_id,
        user_id: row.user_id,
        product_id: row.product_id,
        currency: row.currency,
        gross_written_premium: row.gross_written_premium,
        earned_premium: row.earned_premium,
        premium_collected: row.premium_collected,
        claims_incurred: row.claims_incurred,
        claims_paid: row.claims_paid,
        outstanding_reserve: row.outstanding_reserve,
        ceded_premium: row.ceded_premium,
        policies_count: row.policies_count,
        claims_count: row.claims_count,
        loss_ratio:
          row.earned_premium &&
          row.claims_incurred &&
          Number(row.earned_premium) !== 0
            ? row.loss_ratio
            : null,
      })),
      fileName: 'product-performance',
    };
  }
}
