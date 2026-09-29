import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { QuotationsService } from '../../quotations/quotations.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransactionContextService } from './policy-transaction-context.service';

@Injectable()
export class RenewalQuotationFactoryService {
  constructor(
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

    return this.quotationsService.createDraft(
      user.companyId!,
      context.dto,
      user,
    );
  }
}
