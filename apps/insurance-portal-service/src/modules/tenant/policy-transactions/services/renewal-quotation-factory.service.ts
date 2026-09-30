import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { QuotationsService } from '../../quotations/quotations.service';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { copyNonMotorRiskToQuotation } from '../../underwrite/common/issued-policy-links';
import { PolicyTransactionContextService } from './policy-transaction-context.service';

@Injectable()
export class RenewalQuotationFactoryService {
  private readonly logger = new Logger(RenewalQuotationFactoryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly quotationsService: QuotationsService,
    private readonly contextService: PolicyTransactionContextService,
  ) {}

  async create(
    user: AuthenticatedUser,
    params: {
      policy: Policy;
      version: PolicyVersion;
      renewalStartDate: string;
      renewalEndDate: string;
      previousCoverNoteReference: string;
    },
  ) {
    const context = this.contextService.buildDraftContext({
      policy: params.policy,
      version: params.version,
      type: 'RENEWAL',
      effectiveDate: params.renewalStartDate,
      endDate: params.renewalEndDate,
      previousCoverNoteReference: params.previousCoverNoteReference,
    });

    const quotation = await this.quotationsService.createDraft(
      user.companyId!,
      context.dto,
      user,
    );

    if (quotation && context.quotationFlow === QuotationFlow.NON_MOTOR) {
      await this.copyNonMotorRiskDetails(user, params.policy, quotation.id);
    }

    return quotation;
  }

  /**
   * The Non-Motor risk schema data lives beside the quotation aggregate, so
   * the draft payload does not carry it. A failure is logged, never failing
   * the renewal offer: the underwriter can still capture the details.
   */
  private async copyNonMotorRiskDetails(
    user: AuthenticatedUser,
    policy: Policy,
    quotationId: string,
  ) {
    try {
      await copyNonMotorRiskToQuotation(this.dataSource.manager, {
        companyId: user.companyId!,
        policyId: policy.id,
        sourceQuotationId: policy.quotation_id ?? null,
        targetQuotationId: quotationId,
        userId: user.id ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Non-Motor risk details not copied to renewal quotation ${quotationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
