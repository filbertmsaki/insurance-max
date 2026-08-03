import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';
import { ComplaintPriority, ComplaintStatus } from './enums/claim.enums';
import { ComplaintStatusHistory } from './entities/complaint-status-history.entity';
import { Complaint } from './entities/complaint.entity';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,

    @InjectRepository(ComplaintStatusHistory)
    private readonly historyRepository: Repository<ComplaintStatusHistory>,

    private readonly referenceService: BusinessReferenceService,

    private readonly scopeService: DataAccessScopeService,
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

    return complaint;
  }

  async acknowledge(user: AuthenticatedUser, id: string) {
    const complaint = await this.getForCompany(user, id);

    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new ConflictException('Only an open complaint can be acknowledged');
    }

    return this.transition(
      complaint,
      ComplaintStatus.ACKNOWLEDGED,
      'Complaint acknowledged',
      user.id,
      {
        acknowledged_by: user.id,
        acknowledged_at: new Date(),
      },
    );
  }

  async assign(user: AuthenticatedUser, id: string, assignedUserId: string) {
    const complaint = await this.getForCompany(user, id);

    complaint.assigned_user_id = assignedUserId;

    return this.transition(
      complaint,
      ComplaintStatus.ASSIGNED,
      'Complaint assigned',
      user.id,
    );
  }

  async resolve(user: AuthenticatedUser, id: string, resolution: string) {
    if (!resolution.trim()) {
      throw new BadRequestException('Complaint resolution is required');
    }

    const complaint = await this.getForCompany(user, id);

    return this.transition(
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
  }

  async escalate(user: AuthenticatedUser, id: string, reason: string) {
    if (!reason.trim()) {
      throw new BadRequestException('Escalation reason is required');
    }

    const complaint = await this.getForCompany(user, id);

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
