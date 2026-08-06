import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClaimSlaStatus } from '../enums/claim.enums';
import { Complaint } from '../entities/complaint.entity';
import { ComplaintSlaEvent } from '../entities/complaint-sla-event.entity';
import { ComplaintSlaRule } from '../entities/complaint-sla-rule.entity';

/**
 * Mirrors `ClaimSlaService` exactly, against the complaint-specific tables —
 * complaint and claim SLA remain separately configurable (§14.2/14.30).
 */
@Injectable()
export class ComplaintSlaService {
  constructor(
    @InjectRepository(ComplaintSlaRule)
    private readonly ruleRepository: Repository<ComplaintSlaRule>,

    @InjectRepository(ComplaintSlaEvent)
    private readonly eventRepository: Repository<ComplaintSlaEvent>,
  ) {}

  async startEvent(params: {
    complaint: Complaint;
    eventType: string;
    startedAt?: Date;
    metadata?: Record<string, unknown>;
  }) {
    const startedAt = params.startedAt ?? new Date();

    const rule = await this.ruleRepository
      .createQueryBuilder('rule')
      .where('rule.event_type = :eventType', { eventType: params.eventType })
      .andWhere('rule.is_active = true')
      .andWhere('(rule.company_id = :companyId OR rule.company_id IS NULL)', {
        companyId: params.complaint.company_id,
      })
      .andWhere('rule.effective_from <= CURRENT_DATE')
      .andWhere(
        '(rule.effective_to IS NULL OR rule.effective_to >= CURRENT_DATE)',
      )
      .orderBy('CASE WHEN rule.company_id IS NULL THEN 2 ELSE 1 END', 'ASC')
      .addOrderBy('rule.effective_from', 'DESC')
      .getOne();

    if (!rule) {
      return null;
    }

    const dueAt = new Date(
      startedAt.getTime() + rule.duration_hours * 60 * 60 * 1000,
    );
    const warningAt = new Date(
      dueAt.getTime() - rule.warning_hours_before * 60 * 60 * 1000,
    );

    const existing = await this.eventRepository.findOne({
      where: {
        complaint_id: params.complaint.id,
        event_type: params.eventType,
        status: ClaimSlaStatus.PENDING,
      },
    });

    if (existing) {
      return existing;
    }

    return this.eventRepository.save({
      company_id: params.complaint.company_id,
      complaint_id: params.complaint.id,
      event_type: params.eventType,
      started_at: startedAt,
      due_at: dueAt,
      warning_at: warningAt,
      completed_at: null,
      breached_at: null,
      status: ClaimSlaStatus.PENDING,
      rule_snapshot: {
        rule_id: rule.id,
        duration_hours: rule.duration_hours,
        warning_hours_before: rule.warning_hours_before,
        effective_from: rule.effective_from,
        effective_to: rule.effective_to,
      },
      metadata: params.metadata ?? null,
    });
  }

  async completeEvent(complaintId: string, eventType: string) {
    const event = await this.eventRepository.findOne({
      where: {
        complaint_id: complaintId,
        event_type: eventType,
        status: ClaimSlaStatus.PENDING,
      },
    });

    if (!event) {
      return null;
    }

    event.status = ClaimSlaStatus.COMPLETED;
    event.completed_at = new Date();

    return this.eventRepository.save(event);
  }
}
