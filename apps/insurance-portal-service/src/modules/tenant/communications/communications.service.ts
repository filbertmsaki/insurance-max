import { randomUUID } from 'node:crypto';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';
import { CompanyUser } from '../../platform/companies/entities/company-user.entity';
import { BranchUser } from '../branches/entities/branch-user.entity';

import {
  AssignCommunicationThreadDto,
  CreateCommunicationMessageDto,
  CreateCommunicationThreadDto,
} from './dto/communications.dto';
import { CommunicationMessage } from './entities/communication-message.entity';
import { CommunicationThread } from './entities/communication-thread.entity';

@Injectable()
export class CommunicationsService {
  constructor(
    @InjectRepository(CommunicationThread)
    private readonly threadRepository: Repository<CommunicationThread>,
    @InjectRepository(CommunicationMessage)
    private readonly messageRepository: Repository<CommunicationMessage>,
  ) {}

  listThreads(user: AuthenticatedUser) {
    const qb = this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.company_id = :companyId', { companyId: user.companyId })
      .orderBy('thread.updated_at', 'DESC');
    if (!this.hasPermission(user, 'communications:read-internal')) {
      qb.andWhere(
        user.scope === 'platform' || user.companyType === 'INSURANCE_COMPANY'
          ? '(thread.customer_visible = true OR thread.intermediary_visible = true)'
          : user.scope === 'customer'
            ? 'thread.customer_visible = true'
            : 'thread.intermediary_visible = true',
      );
    }
    return qb.getMany();
  }

  async createThread(
    user: AuthenticatedUser,
    dto: CreateCommunicationThreadDto,
  ) {
    if (
      (dto.customer_visible || dto.intermediary_visible) &&
      !this.hasPermission(user, 'communications:publish-external')
    ) {
      throw new ForbiddenException(
        'External communication permission is required.',
      );
    }
    return this.threadRepository.save(
      this.threadRepository.create({
        company_id: user.companyId!,
        thread_no: `COM-${randomUUID().slice(0, 8).toUpperCase()}`,
        thread_type: dto.thread_type ?? 'GENERAL',
        subject: dto.subject,
        resource_type: dto.resource_type ?? null,
        resource_id: dto.resource_id ?? null,
        customer_visible: dto.customer_visible ?? false,
        intermediary_visible: dto.intermediary_visible ?? false,
        closed_at: null,
        closed_by: null,
        metadata: null,
      }),
    );
  }

  async findThread(user: AuthenticatedUser, id: string) {
    const thread = await this.threadRepository.findOne({
      where: {
        id,
        company_id: user.companyId!,
      },
    });

    if (!thread) {
      throw new NotFoundException('Communication thread not found');
    }

    return thread;
  }

  async listMessages(user: AuthenticatedUser, id: string) {
    const thread = await this.findThread(user, id);
    if (
      !this.hasPermission(user, 'communications:read-internal') &&
      !(
        (user.companyType === 'INSURANCE_COMPANY' &&
          (thread.customer_visible || thread.intermediary_visible)) ||
        (user.scope === 'customer' && thread.customer_visible) ||
        (['BROKER', 'AGENCY', 'BANCASSURANCE', 'REINSURANCE_BROKER'].includes(
          String(user.companyType),
        ) &&
          thread.intermediary_visible)
      )
    ) {
      throw new NotFoundException('Communication thread not found');
    }
    const canReadInternal = this.hasPermission(
      user,
      'communications:read-internal',
    );
    const externallyVisible =
      (user.companyType === 'INSURANCE_COMPANY' &&
        (thread.customer_visible || thread.intermediary_visible)) ||
      (['BROKER', 'AGENCY', 'BANCASSURANCE', 'REINSURANCE_BROKER'].includes(
        String(user.companyType),
      ) &&
        thread.intermediary_visible) ||
      (user.scope === 'platform' &&
        (thread.customer_visible || thread.intermediary_visible));
    return this.messageRepository.find({
      where: {
        company_id: user.companyId!,
        thread_id: id,
        ...(canReadInternal || !externallyVisible
          ? {}
          : { internal_only: false }),
      },
      order: { created_at: 'ASC' },
    });
  }

  async postMessage(
    user: AuthenticatedUser,
    id: string,
    dto: CreateCommunicationMessageDto,
  ) {
    const thread = await this.findThread(user, id);
    if (
      (thread.customer_visible || thread.intermediary_visible) &&
      !this.hasPermission(user, 'communications:publish-external')
    ) {
      throw new ForbiddenException(
        'External communication permission is required.',
      );
    }
    if (
      dto.internal_only &&
      !this.hasPermission(user, 'communications:send-internal')
    ) {
      throw new ForbiddenException(
        'Internal communication permission is required.',
      );
    }
    if (thread.closed_at) {
      throw new ForbiddenException(
        'Closed communication threads cannot receive messages.',
      );
    }
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        company_id: user.companyId!,
        thread_id: thread.id,
        direction: 'OUTBOUND',
        status: 'SENT',
        channel: dto.channel ?? 'IN_APP',
        subject: dto.subject ?? thread.subject,
        body_text: dto.body_text,
        body_html: null,
        sender_type: 'USER',
        sender_id: user.id,
        recipient_type: dto.recipient_type ?? null,
        recipient_id: dto.recipient_id ?? null,
        provider: null,
        provider_message_id: null,
        internal_only: dto.internal_only ?? false,
        metadata: null,
      }),
    );

    thread.updated_at = new Date();
    await this.threadRepository.save(thread);

    return message;
  }

  async assign(
    user: AuthenticatedUser,
    id: string,
    dto: AssignCommunicationThreadDto,
  ) {
    if (!this.hasPermission(user, 'communications:assign')) {
      throw new ForbiddenException(
        'Communication assignment permission is required.',
      );
    }
    const thread = await this.findThread(user, id);
    if (dto.assigned_user_id) {
      const assignment = await this.threadRepository.manager
        .getRepository(CompanyUser)
        .findOne({
          where: {
            user_id: dto.assigned_user_id,
            company_id: user.companyId!,
            status: 'active',
          },
          select: { id: true, user_id: true },
        });
      if (!assignment)
        throw new NotFoundException(
          'Assigned user not found in this organization.',
        );
      const branchUsers = await this.threadRepository.manager
        .getRepository(BranchUser)
        .find({ where: { company_user_id: assignment.id } });
      if (
        user.activeBranchId &&
        branchUsers.length > 0 &&
        !branchUsers.some(
          (branchUser) => branchUser.branch_id === user.activeBranchId,
        )
      ) {
        throw new NotFoundException(
          'Assigned user not found in this organization.',
        );
      }
    }
    thread.metadata = {
      ...(thread.metadata ?? {}),
      assigned_user_id: dto.assigned_user_id ?? user.id,
      assigned_at: new Date().toISOString(),
      assigned_by: user.id,
    };
    return this.threadRepository.save(thread);
  }

  async close(user: AuthenticatedUser, id: string) {
    const thread = await this.findThread(user, id);
    if (thread.closed_at) return thread;
    thread.closed_at = new Date();
    thread.closed_by = user.id;
    return this.threadRepository.save(thread);
  }

  async reopen(user: AuthenticatedUser, id: string) {
    const thread = await this.findThread(user, id);
    if (!thread.closed_at) return thread;
    thread.closed_at = null;
    thread.closed_by = null;
    return this.threadRepository.save(thread);
  }

  private hasPermission(user: AuthenticatedUser, permission: string): boolean {
    return (user.permissions ?? []).includes(permission);
  }
}
