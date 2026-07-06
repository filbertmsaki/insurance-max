import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FilterTiramisAuditLogDto } from '../dto/filter-tiramis-audit-log.dto';
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

  findById(
    id: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('audit')
      .where('audit.id = :id', { id });

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('audit.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getOne();
  }

  async search(
    query: FilterTiramisAuditLogDto,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);

    const qb = this.repository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.severity) {
      qb.andWhere('audit.severity = :severity', {
        severity: query.severity,
      });
    }

    if (query.requestType) {
      qb.andWhere('audit.requestType = :requestType', {
        requestType: query.requestType,
      });
    }

    if (query.correlationId) {
      qb.andWhere('audit.correlationId = :correlationId', {
        correlationId: query.correlationId,
      });
    }

    if (query.localTrackingId) {
      qb.andWhere('audit.localTrackingId = :localTrackingId', {
        localTrackingId: query.localTrackingId,
      });
    }

    if (query.businessReference) {
      qb.andWhere('audit.businessReference = :businessReference', {
        businessReference: query.businessReference,
      });
    }

    if (query.sourceModule) {
      qb.andWhere('audit.sourceModule = :sourceModule', {
        sourceModule: query.sourceModule,
      });
    }

    if (query.sourceRecordId) {
      qb.andWhere('audit.sourceRecordId = :sourceRecordId', {
        sourceRecordId: query.sourceRecordId,
      });
    }

    if (query.startDate) {
      qb.andWhere('audit.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('audit.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('audit.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    const includePayload = query.includePayload === 'true';

    return {
      data: includePayload ? rows : rows.map((row) => this.hidePayload(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  findRecent(
    limit = 100,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC')
      .take(limit);

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('audit.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  findByTrackingId(
    localTrackingId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('audit')
      .where('audit.localTrackingId = :localTrackingId', {
        localTrackingId,
      })
      .orderBy('audit.createdAt', 'DESC');

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('audit.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  findByCorrelationId(
    correlationId: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('audit')
      .where('audit.correlationId = :correlationId', {
        correlationId,
      })
      .orderBy('audit.createdAt', 'ASC');

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('audit.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  findByBusinessReference(
    businessReference: string,
    scope?: {
      companyId?: string | null;
      canAccessAllCompanies?: boolean;
    },
  ) {
    const qb = this.repository
      .createQueryBuilder('audit')
      .where('audit.businessReference = :businessReference', {
        businessReference,
      })
      .orderBy('audit.createdAt', 'DESC');

    if (scope?.companyId && !scope.canAccessAllCompanies) {
      qb.andWhere('audit.sourceCompanyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    return qb.getMany();
  }

  private hidePayload(row: TiramisAuditLogEntity) {
    return {
      ...row,
      requestPayloadSnapshot: row.requestPayloadSnapshot ? '[hidden]' : null,
      responsePayloadSnapshot: row.responsePayloadSnapshot ? '[hidden]' : null,
    };
  }
}
