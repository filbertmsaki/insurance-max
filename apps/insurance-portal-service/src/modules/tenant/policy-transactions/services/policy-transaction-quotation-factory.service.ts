import { BadRequestException, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PolicyTransactionType } from '@insurance-max/contracts';

import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationsService } from '../../quotations/quotations.service';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionContextService } from './policy-transaction-context.service';

@Injectable()
export class PolicyTransactionQuotationFactoryService {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly contextService: PolicyTransactionContextService,
  ) {}

  async createTransactionDraft(
    manager: EntityManager,
    user: AuthenticatedUser,
    params: {
      policy: Policy;
      version: PolicyVersion;
      transaction: PolicyTransaction;
      previousCoverNoteReference: string;
      endorsementType: number;
      endorsementReason: string;
      recordOnly?: boolean;
    },
  ): Promise<Quotation> {
    const context = this.contextService.buildDraftContext({
      policy: params.policy,
      version: params.version,
      transaction: params.transaction,
      type:
        params.transaction.transaction_type ===
        PolicyTransactionType.CANCELLATION
          ? 'CANCELLATION'
          : 'ENDORSEMENT',
      effectiveDate: params.transaction.effective_date,
      endDate: String(
        (params.transaction.proposed_policy_snapshot ??
          params.version.policy_snapshot)?.['endDate'] ??
          params.policy.end_date,
      ),
      previousCoverNoteReference: params.previousCoverNoteReference,
      endorsementType: params.endorsementType,
      endorsementReason: params.endorsementReason,
      recordOnly: params.recordOnly === true,
    });

    const quotationId = await this.quotationsService.createDraftInTransaction(
      manager,
      user.companyId!,
      context.dto,
      user.id,
      context.branchContext,
    );

    // These link columns are populated directly rather than via
    // SaveQuotationDraftDto because they are internal bookkeeping specific
    // to policy-transaction-generated quotations, not something a user
    // ever sets through the ordinary quotation wizard/DTO surface.
    await manager.getRepository(Quotation).update(
      { id: quotationId, company_id: user.companyId! },
      {
        source_policy_transaction_id: params.transaction.id,
        source_policy_id: params.policy.id,
        previous_quotation_id: params.policy.quotation_id ?? null,
      },
    );

    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: quotationId, company_id: user.companyId! },
    });

    if (!quotation) {
      throw new BadRequestException(
        'Policy transaction quotation could not be created.',
      );
    }

    return quotation;
  }
}
