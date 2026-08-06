import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { NotificationsService } from '../../work-items/notifications.service';
import { WorkItemsService } from '../../work-items/work-items.service';
import { ClaimSlaStatus } from '../enums/claim.enums';
import { ComplaintSlaEvent } from '../entities/complaint-sla-event.entity';

@Injectable()
export class ComplaintSlaMonitorService {
  constructor(
    @InjectRepository(ComplaintSlaEvent)
    private readonly eventRepository: Repository<ComplaintSlaEvent>,

    private readonly workItemsService: WorkItemsService,

    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(process.env.COMPLAINT_SLA_CRON || '*/15 * * * *')
  async monitor(): Promise<void> {
    const overdue = await this.eventRepository.find({
      where: {
        status: ClaimSlaStatus.PENDING,
        due_at: LessThanOrEqual(new Date()),
      },
      take: 500,
      order: {
        due_at: 'ASC',
      },
    });

    for (const event of overdue) {
      event.status = ClaimSlaStatus.BREACHED;
      event.breached_at = new Date();

      await this.eventRepository.save(event);

      await this.workItemsService.create({
        companyId: event.company_id,
        branchId: null,
        domain: 'COMPLAINTS',
        resourceType: 'complaint',
        resourceId: event.complaint_id,
        title: `Complaint SLA breached: ${event.event_type}`,
        priority: 'CRITICAL',
        assignedRole: 'CLAIMS_MANAGER',
        dueAt: event.due_at,
        dedupeKey: `complaint-sla-breach:${event.id}`,
        metadata: {
          event_type: event.event_type,
          due_at: event.due_at,
        },
      });

      await this.notificationsService.create({
        companyId: event.company_id,
        branchId: null,
        recipientRole: 'CLAIMS_MANAGER',
        type: 'COMPLAINT_SLA_BREACH',
        severity: 'CRITICAL',
        title: 'Complaint SLA breached',
        message: `Complaint action ${event.event_type} is overdue.`,
        resourceType: 'complaint',
        resourceId: event.complaint_id,
        actionUrl: `/complaints/${event.complaint_id}`,
      });
    }
  }
}
