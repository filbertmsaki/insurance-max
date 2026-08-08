import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';
import { ComplaintPriority, ComplaintStatus } from './enums/claim.enums';
import { ComplaintAppeal } from './entities/complaint-appeal.entity';
import { ComplaintComment } from './entities/complaint-comment.entity';
import { ComplaintStatusHistory } from './entities/complaint-status-history.entity';
import { Complaint } from './entities/complaint.entity';
import { ComplaintSlaService } from './services/complaint-sla.service';

const NOT_YET_TERMINAL = [ComplaintStatus.CLOSED, ComplaintStatus.CANCELLED];

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,

    @InjectRepository(ComplaintStatusHistory)
    private readonly historyRepository: Repository<ComplaintStatusHistory>,

    @InjectRepository(ComplaintAppeal)
    private readonly appealRepository: Repository<ComplaintAppeal>,

    @InjectRepository(ComplaintComment)
    private readonly commentRepository: Repository<ComplaintComment>,

    private readonly referenceService: BusinessReferenceService,

    private readonly scopeService: DataAccessScopeService,

    private readonly slaService: ComplaintSlaService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: {
      claim_id?: string;
      policy_id?: string;
      customer_id: string;
      category: string;
      subject: string;
      description: string;
      priority?: ComplaintPriority;
      reported_channel: string;
    },
  ) {
    const complaintNo = await this.referenceService.next({
      companyId: user.companyId!,
      documentType: 'COMPLAINT',
      prefix: `CMP-${new Date().getFullYear()}-`,
    });

    const complaint = await this.complaintRepository.save({
      company_id: user.companyId!,
      branch_id: user.activeBranchId ?? null,
      claim_id: dto.claim_id ?? null,
      policy_id: dto.policy_id ?? null,
      customer_id: dto.customer_id,
      complaint_no: complaintNo,
      category: dto.category.trim(),
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      priority: dto.priority ?? ComplaintPriority.MEDIUM,
      status: ComplaintStatus.OPEN,
      reported_channel: dto.reported_channel.trim(),
      assigned_user_id: null,
      acknowledged_by: null,
      acknowledged_at: null,
      resolution: null,
      resolved_by: null,
      resolved_at: null,
      escalated_by: null,
      escalated_at: null,
      escalation_reason: null,
      closed_by: null,
      closed_at: null,
      created_by: user.id,
    });

    await this.historyRepository.save({
      complaint_id: complaint.id,
      old_status: null,
      new_status: ComplaintStatus.OPEN,
      reason: 'Complaint created',
      changed_by: user.id,
    });

    const acknowledgementEvent = await this.slaService.startEvent({
      complaint,
      eventType: 'COMPLAINT_ACKNOWLEDGEMENT',
    });
    const resolutionEvent = await this.slaService.startEvent({
      complaint,
      eventType: 'COMPLAINT_RESOLUTION',
    });

    if (acknowledgementEvent) {
      complaint.acknowledgement_due_at = acknowledgementEvent.due_at;
    }
    if (resolutionEvent) {
      complaint.resolution_due_at = resolutionEvent.due_at;
    }
    if (acknowledgementEvent || resolutionEvent) {
      await this.complaintRepository.save(complaint);
    }

    return complaint;
  }

  findAll(user: AuthenticatedUser) {
    this.scopeService.resolve(user);

    return this.complaintRepository.find({
      where: { company_id: user.companyId! },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.getForCompany(user, id);
  }

  async acknowledge(user: AuthenticatedUser, id: string) {
    const complaint = await this.getForCompany(user, id);

    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new ConflictException('Only an open complaint can be acknowledged');
    }

    const updated = await this.transition(
      complaint,
      ComplaintStatus.ACKNOWLEDGED,
      'Complaint acknowledged',
      user.id,
      {
        acknowledged_by: user.id,
        acknowledged_at: new Date(),
      },
    );

    await this.slaService.completeEvent(
      complaint.id,
      'COMPLAINT_ACKNOWLEDGEMENT',
    );

    return updated;
  }

  async assign(user: AuthenticatedUser, id: string, assignedUserId: string) {
    const complaint = await this.getForCompany(user, id);
    this.assertNotTerminal(complaint);

    complaint.assigned_user_id = assignedUserId;

    return this.transition(
      complaint,
      ComplaintStatus.ASSIGNED,
      'Complaint assigned',
      user.id,
    );
  }

  async resolve(user: AuthenticatedUser, id: string, resolution: string) {
    if (!resolution?.trim()) {
      throw new BadRequestException('Complaint resolution is required');
    }

    const complaint = await this.getForCompany(user, id);
    this.assertNotTerminal(complaint);

    const updated = await this.transition(
      complaint,
      ComplaintStatus.RESOLVED,
      resolution,
      user.id,
      {
        resolution: resolution.trim(),
        resolved_by: user.id,
        resolved_at: new Date(),
      },
    );

    await this.slaService.completeEvent(complaint.id, 'COMPLAINT_RESOLUTION');

    return updated;
  }

  async escalate(user: AuthenticatedUser, id: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Escalation reason is required');
    }

    const complaint = await this.getForCompany(user, id);
    this.assertNotTerminal(complaint);

    return this.transition(
      complaint,
      ComplaintStatus.ESCALATED,
      reason,
      user.id,
      {
        escalated_by: user.id,
        escalated_at: new Date(),
        escalation_reason: reason.trim(),
      },
    );
  }

  async close(user: AuthenticatedUser, id: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Closure reason is required');
    }

    const complaint = await this.getForCompany(user, id);

    if (complaint.status !== ComplaintStatus.RESOLVED) {
      throw new ConflictException('Only a resolved complaint can be closed');
    }

    return this.transition(complaint, ComplaintStatus.CLOSED, reason, user.id, {
      closed_by: user.id,
      closed_at: new Date(),
      closure_reason: reason.trim(),
    });
  }

  async reopen(user: AuthenticatedUser, id: string, reason: string) {
    const complaint = await this.getForCompany(user, id);

    if (complaint.status !== ComplaintStatus.CLOSED) {
      throw new ConflictException('Only a closed complaint can be reopened');
    }

    if (complaint.closed_by === user.id) {
      throw new ForbiddenException(
        'The user who closed the complaint cannot reopen it',
      );
    }

    return this.transition(
      complaint,
      ComplaintStatus.REOPENED,
      reason,
      user.id,
      {
        reopened_by: user.id,
        reopened_at: new Date(),
      },
    );
  }

  async cancel(user: AuthenticatedUser, id: string, reason: string) {
    const complaint = await this.getForCompany(user, id);
    this.assertNotTerminal(complaint);

    return this.transition(
      complaint,
      ComplaintStatus.CANCELLED,
      reason,
      user.id,
      {
        cancelled_by: user.id,
        cancelled_at: new Date(),
      },
    );
  }

  async addComment(
    user: AuthenticatedUser,
    id: string,
    body: string,
    isCustomerVisible: boolean,
  ) {
    const complaint = await this.getForCompany(user, id);

    return this.commentRepository.save({
      company_id: complaint.company_id,
      complaint_id: complaint.id,
      body: body.trim(),
      is_customer_visible: isCustomerVisible,
      created_by: user.id,
    });
  }

  async listComments(user: AuthenticatedUser, id: string) {
    const complaint = await this.getForCompany(user, id);

    return this.commentRepository.find({
      where: { complaint_id: complaint.id },
      order: { created_at: 'ASC' },
    });
  }

  async appeal(user: AuthenticatedUser, id: string, reason: string) {
    const complaint = await this.getForCompany(user, id);

    if (complaint.customer_acceptance_status !== 'REJECTED') {
      throw new ConflictException(
        'An appeal requires the customer to have rejected the resolution first',
      );
    }

    const appealNo = await this.referenceService.next({
      companyId: complaint.company_id,
      documentType: 'COMPLAINT_APPEAL',
      prefix: `APL-${new Date().getFullYear()}-`,
    });

    const appeal = await this.appealRepository.save({
      company_id: complaint.company_id,
      complaint_id: complaint.id,
      appeal_no: appealNo,
      reason: reason.trim(),
      filed_by: user.id,
    });

    complaint.appeal_count = Number(complaint.appeal_count || 0) + 1;

    await this.transition(complaint, ComplaintStatus.APPEALED, reason, user.id);

    return appeal;
  }

  private assertNotTerminal(complaint: Complaint) {
    if (NOT_YET_TERMINAL.includes(complaint.status)) {
      throw new ConflictException(
        `Complaint cannot transition from ${complaint.status}`,
      );
    }
  }

  private async transition(
    complaint: Complaint,
    nextStatus: ComplaintStatus,
    reason: string,
    userId: string,
    changes: Partial<Complaint> = {},
  ) {
    const oldStatus = complaint.status;

    Object.assign(complaint, changes, {
      status: nextStatus,
    });

    const saved = await this.complaintRepository.save(complaint);

    await this.historyRepository.save({
      complaint_id: complaint.id,
      old_status: oldStatus,
      new_status: nextStatus,
      reason,
      changed_by: userId,
    });

    return saved;
  }

  private async getForCompany(user: AuthenticatedUser, id: string) {
    this.scopeService.resolve(user);

    const complaint = await this.complaintRepository.findOne({
      where: {
        id,
        company_id: user.companyId!,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }
}
