import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { IsNull, Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PlatformUsageEvent } from '../entities/platform-usage-event.entity';
import { PlatformUsageSnapshot } from '../entities/platform-usage-snapshot.entity';

@Injectable()
export class UsageMeteringService {
  constructor(
    @InjectRepository(PlatformUsageEvent)
    private readonly eventRepository: Repository<PlatformUsageEvent>,
    @InjectRepository(PlatformUsageSnapshot)
    private readonly snapshotRepository: Repository<PlatformUsageSnapshot>,
  ) {}

  async recordEvent(dto: {
    company_id: string;
    subscription_id?: string | null;
    metric_code: string;
    quantity: string | number;
    idempotency_key: string;
    resource_type?: string | null;
    resource_id?: string | null;
    dimension_key?: string;
    dimensions?: Record<string, unknown>;
    occurred_at?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (DecimalUtil.value(dto.quantity).isNegative()) {
      throw new BadRequestException('Usage quantity cannot be negative');
    }

    const existing = await this.eventRepository.findOne({
      where: {
        company_id: dto.company_id,
        metric_code: dto.metric_code,
        idempotency_key: dto.idempotency_key,
      },
    });

    if (existing) {
      return existing;
    }

    return this.eventRepository.save(
      this.eventRepository.create({
        company_id: dto.company_id,
        subscription_id: dto.subscription_id ?? null,
        metric_code: dto.metric_code,
        quantity: DecimalUtil.quantity(dto.quantity),
        idempotency_key: dto.idempotency_key,
        resource_type: dto.resource_type ?? null,
        resource_id: dto.resource_id ?? null,
        dimension_key: dto.dimension_key ?? 'default',
        dimensions: dto.dimensions ?? {},
        occurred_at: dto.occurred_at ? new Date(dto.occurred_at) : new Date(),
        metadata: dto.metadata ?? null,
      }),
    );
  }

  async aggregateUsage(companyId: string, periodStart: Date, periodEnd: Date) {
    const rows = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.company_id', 'company_id')
      .addSelect('event.subscription_id', 'subscription_id')
      .addSelect('event.metric_code', 'metric_code')
      .addSelect('event.dimension_key', 'dimension_key')
      .addSelect('COALESCE(SUM(event.quantity), 0)', 'quantity')
      .where('event.company_id = :companyId', { companyId })
      .andWhere('event.occurred_at >= :periodStart', { periodStart })
      .andWhere('event.occurred_at <= :periodEnd', { periodEnd })
      .groupBy('event.company_id')
      .addGroupBy('event.subscription_id')
      .addGroupBy('event.metric_code')
      .addGroupBy('event.dimension_key')
      .getRawMany<{
        company_id: string;
        subscription_id: string | null;
        metric_code: string;
        dimension_key: string;
        quantity: string;
      }>();

    const snapshots: PlatformUsageSnapshot[] = [];
    for (const row of rows) {
      let snapshot = await this.snapshotRepository.findOne({
        where: {
          company_id: row.company_id,
          subscription_id: row.subscription_id ?? IsNull(),
          metric_code: row.metric_code,
          dimension_key: row.dimension_key,
          period_start: periodStart,
          period_end: periodEnd,
        },
      });

      if (!snapshot) {
        snapshot = this.snapshotRepository.create({
          company_id: row.company_id,
          subscription_id: row.subscription_id,
          metric_code: row.metric_code,
          period_start: periodStart,
          period_end: periodEnd,
          dimension_key: row.dimension_key,
          quantity: DecimalUtil.quantity(row.quantity),
        });
      } else {
        snapshot.quantity = DecimalUtil.quantity(row.quantity);
      }

      snapshots.push(await this.snapshotRepository.save(snapshot));
    }

    return {
      period_start: DateTime.fromJSDate(periodStart).toISO(),
      period_end: DateTime.fromJSDate(periodEnd).toISO(),
      snapshots,
    };
  }

  async listEvents() {
    return this.eventRepository.find({
      order: {
        occurred_at: 'DESC',
      },
      take: 200,
    });
  }
}
