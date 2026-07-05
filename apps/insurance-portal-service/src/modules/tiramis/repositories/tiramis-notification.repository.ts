import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisNotificationEntity } from '../entities/tiramis-notification.entity';

@Injectable()
export class TiramisNotificationRepository {
  constructor(
    @InjectRepository(TiramisNotificationEntity)
    private readonly repository: Repository<TiramisNotificationEntity>,
  ) {}

  create(data: Partial<TiramisNotificationEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisNotificationEntity) {
    return this.repository.save(entity);
  }

  findRecent(limit = 50) {
    return this.repository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  findUnread(limit = 50) {
    return this.repository.find({
      where: { isRead: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  findByTrackingId(localTrackingId: string) {
    return this.repository.find({
      where: { localTrackingId },
      order: { createdAt: 'DESC' },
    });
  }

  findByBusinessReference(businessReference: string) {
    return this.repository.find({
      where: { businessReference },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId?: string | null) {
    await this.repository.update(
      { id },
      {
        isRead: true,
        readAt: new Date(),
        readByUserId: userId || null,
      },
    );

    return this.repository.findOne({ where: { id } });
  }

  async markAllRead(userId?: string | null) {
    await this.repository.update(
      { isRead: false },
      {
        isRead: true,
        readAt: new Date(),
        readByUserId: userId || null,
      },
    );

    return {
      success: true,
    };
  }
}
