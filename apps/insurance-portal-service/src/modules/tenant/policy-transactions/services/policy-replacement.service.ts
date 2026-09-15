import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import { PolicyTransactionType } from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationStatus } from '../../quotations/enums/quotation-status.enum';
import { QuotationsService } from '../../quotations/quotations.service';
import { PolicyTransactionEligibilityService } from './policy-transaction-eligibility.service';
import { CreatePolicyReplacementDto } from '../dto/create-policy-replacement.dto';

@Injectable()
export class PolicyReplacementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly quotations: QuotationsService,
    private readonly eligibility: PolicyTransactionEligibilityService,
  ) {}

  async create(
    user: AuthenticatedUser,
    policyId: string,
    dto: CreatePolicyReplacementDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const policy = await manager.getRepository(Policy).findOne({
        where: { id: policyId, company_id: user.companyId! },
        lock: { mode: 'pessimistic_write' },
      });
      if (!policy) throw new BadRequestException('Policy not found');
      const existing = await manager.getRepository(Quotation).findOne({
        where: {
          company_id: user.companyId!,
          replacement_source_policy_id: policy.id,
          status: Not(QuotationStatus.CANCELLED),
        },
      });
      if (existing) return { quotation_id: existing.id };
      const eligibility = await this.eligibility.validate(
        manager,
        policy,
        PolicyTransactionType.CANCELLATION,
        dto.effective_date,
      );
      if (!eligibility.eligible || eligibility.claimsReviewRequired) {
        throw new BadRequestException(
          eligibility.claimsReviewRequired
            ? 'Resolve the outstanding claims review before replacing this policy.'
            : eligibility.blockers.map((item) => item.message).join(' '),
        );
      }
      if (!dto.reason.trim())
        throw new BadRequestException('A replacement reason is required.');
      const source = await manager.getRepository(Quotation).findOneByOrFail({
        id: policy.quotation_id!,
        company_id: user.companyId!,
      });
      const quotationId = await this.quotations.createDraftInTransaction(
        manager,
        user.companyId!,
        {
          insurer_company_id: policy.insurer_company_id,
          intermediary_company_id: policy.intermediary_company_id,
          department_id: policy.department_id,
          customer_id: policy.customer_id,
          category_id: policy.category_id,
          product_id: policy.product_id,
          sub_class_id: policy.sub_class_id,
          quotation_type: source.quotation_type,
          quotation_flow: source.quotation_flow,
          channel_type: source.channel_type,
          is_fleet: source.is_fleet,
          current_wizard_step: 'cover-note',
          draft_payload: {
            ...dto.draft_payload,
            valid_from: dto.effective_date,
            cover_note_number: '',
            cover_note_type: '1',
            prev_cover_note_reference: '',
            endorsement_type: '',
            endorsement_reason: '',
          },
        },
        user.id,
      );
      await manager.getRepository(Quotation).update(quotationId, {
        replacement_source_policy_id: policy.id,
        replacement_source_version_id: eligibility.currentVersion!.id,
        replacement_reason: dto.reason.trim(),
      });
      return { quotation_id: quotationId };
    });
  }
}
