import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisAuditLogEntity } from '../entities/tiramis-audit-log.entity';

@Injectable()
export class TiramisAuditLogRepository {
  constructor(
    @InjectRepository(TiramisAuditLogEntity)
    private readonly repository: Repository<TiramisAuditLogEntity>,
  ) {}

  create(data: Partial<TiramisAuditLogEntity>) {
    return this.repository.create(data);
  }

  save(entity: TiramisAuditLogEntity) {
    return this.repository.save(entity);
  }

  findRecent(limit = 100) {
    return this.repository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  findByTrackingId(localTrackingId: string) {
    return this.repository.find({
      where: {
        localTrackingId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findByBusinessReference(businessReference: string) {
    return this.repository.find({
      where: {
        businessReference,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
