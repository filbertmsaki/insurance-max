import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { IsNull, Not, Repository } from 'typeorm';

import { CompanyUser } from '../../companies/entities/company-user.entity';
import { ApiClient } from '../../api-clients/entities/api-client.entity';
import { Branch } from '../../../tenant/branches/entities/branch.entity';
import { ReportSchedule } from '../../../tenant/reporting/entities/report-schedule.entity';
import { ReportScheduleStatus } from '../../../tenant/reporting/enums/reporting.enums';
import { SubscriptionAccessService } from './subscription-access.service';
import { ApiClientStatus } from '@insurance-max/contracts';

@Injectable()
export class SubscriptionLimitService {
  constructor(
    private readonly subscriptionAccessService: SubscriptionAccessService,
    @InjectRepository(ApiClient)
    private readonly apiClientRepository: Repository<ApiClient>,
    @InjectRepository(CompanyUser)
    private readonly companyUserRepository: Repository<CompanyUser>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(ReportSchedule)
    private readonly reportScheduleRepository: Repository<ReportSchedule>,
  ) {}

  async assertCapacity(
    companyId: string,
    featureCode: string,
    additionalQuantity = 1,
  ): Promise<void> {
    const entitlement = await this.subscriptionAccessService.requireEntitlement(
      companyId,
      featureCode,
    );
    const limit = new Decimal(entitlement.value as Decimal.Value);
    const current = await this.currentUsage(companyId, featureCode);
    const requested = current.plus(additionalQuantity);

    if (requested.greaterThan(limit)) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_LIMIT_REACHED',
        featureCode,
        limit: limit.toString(),
        current: current.toString(),
        requested: requested.toString(),
      });
    }
  }

  async currentUsage(companyId: string, featureCode: string): Promise<Decimal> {
    switch (featureCode) {
      case 'api_clients.max':
        return new Decimal(
          await this.apiClientRepository.count({
            where: {
              company_id: companyId,
              status: Not(ApiClientStatus.REVOKED),
            },
          }),
        );
      case 'users.max':
        return new Decimal(
          await this.companyUserRepository.count({
            where: {
              company_id: companyId,
              status: 'active',
            },
          }),
        );
      case 'branches.max':
        return new Decimal(
          await this.branchRepository.count({
            where: {
              company_id: companyId,
              deleted_at: IsNull(),
            },
          }),
        );
      case 'reports.scheduled.max':
        return new Decimal(
          await this.reportScheduleRepository.count({
            where: {
              company_id: companyId,
              status: ReportScheduleStatus.ACTIVE,
              deleted_at: IsNull(),
            },
          }),
        );
      default:
        return new Decimal(0);
    }
  }
}
