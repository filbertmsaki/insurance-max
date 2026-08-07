import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';

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
    return this.threadRepository.find({
      where: { company_id: user.companyId! },
      order: { updated_at: 'DESC' },
    });
  }

  async createThread(
    user: AuthenticatedUser,
    dto: CreateCommunicationThreadDto,
  ) {
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
    await this.findThread(user, id);
    return this.messageRepository.find({
      where: {
        company_id: user.companyId!,
        thread_id: id,
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
    const thread = await this.findThread(user, id);
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
    thread.closed_at = new Date();
    thread.closed_by = user.id;
    return this.threadRepository.save(thread);
  }

  async reopen(user: AuthenticatedUser, id: string) {
    const thread = await this.findThread(user, id);
    thread.closed_at = null;
    thread.closed_by = null;
    return this.threadRepository.save(thread);
  }
}
