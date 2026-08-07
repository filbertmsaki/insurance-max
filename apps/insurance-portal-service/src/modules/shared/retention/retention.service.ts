import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Repository } from 'typeorm';

import { DataRetentionStatus } from '@insurance-max/contracts';

import { DataRetentionPolicy } from './entities/data-retention-policy.entity';
import { LegalHold } from './entities/legal-hold.entity';

@Injectable()
export class RetentionService {
  constructor(
    @InjectRepository(DataRetentionPolicy)
    private readonly policyRepository: Repository<DataRetentionPolicy>,
    @InjectRepository(LegalHold)
    private readonly legalHoldRepository: Repository<LegalHold>,
    private readonly configService: ConfigService,
  ) {}

  listPolicies(companyId?: string | null) {
    return this.policyRepository.find({
      where: companyId
        ? [{ company_id: companyId }, { company_id: IsNull() }]
        : undefined,
      order: { resource_type: 'ASC', version_number: 'DESC', created_at: 'DESC' },
    });
  }

  listLegalHolds(companyId?: string | null) {
    return this.legalHoldRepository.find({
      where: companyId
        ? [{ company_id: companyId }, { company_id: IsNull() }]
        : undefined,
      order: { active: 'DESC', created_at: 'DESC' },
    });
  }

  async isUnderLegalHold(
    resourceType: string,
    resourceId: string,
    companyId?: string | null,
  ): Promise<boolean> {
    const hold = await this.legalHoldRepository.findOne({
      where: {
        resource_type: resourceType,
        resource_id: resourceId,
        active: true,
        company_id: companyId ?? IsNull(),
      },
    });

    return Boolean(hold);
  }

  async dryRun(companyId?: string | null) {
    const policies = await this.policyRepository.find({
      where: companyId
        ? [
            { company_id: companyId, status: DataRetentionStatus.ACTIVE },
            { company_id: IsNull(), status: DataRetentionStatus.ACTIVE },
          ]
        : { status: DataRetentionStatus.ACTIVE },
      order: { resource_type: 'ASC', version_number: 'DESC' },
    });

    return {
      enabled: this.configService.get<boolean>('DATA_RETENTION_ENABLED') ?? true,
      dryRunDefault:
        this.configService.get<boolean>('DATA_RETENTION_DRY_RUN_DEFAULT') ?? true,
      policiesEvaluated: policies.length,
      legalHoldsChecked: await this.legalHoldRepository.count({
        where: companyId
          ? [{ company_id: companyId }, { company_id: IsNull() }]
          : undefined,
      }),
      itemsMatched: 0,
      itemsBlockedByHold: 0,
      actions: policies.map((policy) => ({
        policyCode: policy.policy_code,
        resourceType: policy.resource_type,
        action: policy.action,
        retentionDays: policy.retention_days,
        archiveBeforeDelete: policy.archive_before_delete,
      })),
    };
  }
}
