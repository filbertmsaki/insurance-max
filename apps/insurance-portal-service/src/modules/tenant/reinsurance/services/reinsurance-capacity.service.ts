import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { ReinsuranceExposureSnapshot } from '@insurance-max/contracts';
import { Repository } from 'typeorm';

import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { PolicyCession } from '../entities/policy-cession.entity';
import { ReinsuranceClaimRecovery } from '../entities/reinsurance-claim-recovery.entity';
import { ReinsuranceTreatyEligibilityRule } from '../entities/reinsurance-treaty-eligibility-rule.entity';
import { ReinsuranceTreatySection } from '../entities/reinsurance-treaty-section.entity';
import { ReinsuranceTreaty } from '../entities/reinsurance-treaty.entity';
import {
  ReinsuranceCessionStatus,
  TreatyForm,
} from '../enums/reinsurance.enums';

const NON_PROPORTIONAL_FORMS: TreatyForm[] = [
  TreatyForm.EXCESS_OF_LOSS,
  TreatyForm.CATASTROPHE_EXCESS_OF_LOSS,
  TreatyForm.STOP_LOSS,
];

const CAPACITY_CONSUMING_CESSION_STATUSES = [
  ReinsuranceCessionStatus.APPROVED,
  ReinsuranceCessionStatus.ACTIVE,
  ReinsuranceCessionStatus.DECLARED,
];

export interface EvaluateCapacityParams {
  treatyId: string;
  treatySectionId?: string | null;
  exposureAmount: string | number;
  classOfBusiness?: string | null;
  territory?: string | null;
}

/**
 * Standalone, read-only exposure/capacity evaluation. Nothing in
 * `quotations.service.ts` or the cession-creation path calls this — it
 * exists so capacity can be checked on demand without gating live issuance
 * (scoping decision: "standalone evaluation only").
 */
@Injectable()
export class ReinsuranceCapacityService {
  constructor(
    @InjectRepository(ReinsuranceTreaty)
    private readonly treatyRepository: Repository<ReinsuranceTreaty>,

    @InjectRepository(ReinsuranceTreatySection)
    private readonly sectionRepository: Repository<ReinsuranceTreatySection>,

    @InjectRepository(PolicyCession)
    private readonly cessionRepository: Repository<PolicyCession>,

    @InjectRepository(ReinsuranceClaimRecovery)
    private readonly recoveryRepository: Repository<ReinsuranceClaimRecovery>,

    @InjectRepository(ReinsuranceTreatyEligibilityRule)
    private readonly eligibilityRuleRepository: Repository<ReinsuranceTreatyEligibilityRule>,

    private readonly scopeService: DataAccessScopeService,
  ) {}

  async evaluate(
    user: AuthenticatedUser,
    params: EvaluateCapacityParams,
  ): Promise<ReinsuranceExposureSnapshot> {
    const scope = this.scopeService.resolve(user);

    const treaty = await this.treatyRepository.findOne({
      where: { id: params.treatyId, company_id: scope.companyId },
    });

    if (!treaty) {
      throw new NotFoundException('Treaty not found');
    }

    const section = params.treatySectionId
      ? await this.sectionRepository.findOne({
          where: { id: params.treatySectionId, treaty_id: treaty.id },
        })
      : null;

    if (params.treatySectionId && !section) {
      throw new BadRequestException(
        'Selected treaty section does not belong to this treaty',
      );
    }

    const exposureAmount = Number(params.exposureAmount ?? 0);
    const isNonProportional = NON_PROPORTIONAL_FORMS.includes(
      treaty.treaty_form,
    );

    let cededAmountToDate: number;
    let limit: number;

    if (isNonProportional) {
      // XOL/CAT-XOL/stop-loss: capacity is tracked against the layer's
      // aggregate/period limit, consumed by admitted recoveries to date.
      limit = Number(
        section?.aggregate_limit ??
          treaty.aggregate_limit ??
          section?.treaty_limit ??
          0,
      );
      cededAmountToDate = await this.sumAdmittedRecoveries(
        treaty.id,
        section?.id ?? null,
      );
    } else {
      // Quota-share/surplus: capacity is tracked against the treaty/section
      // limit, consumed by ceded sum insured on live cessions.
      limit = Number(section?.treaty_limit ?? treaty.total_capacity ?? 0);
      cededAmountToDate = await this.sumCededSumInsured(
        treaty.id,
        section?.id ?? null,
      );
    }

    const availableCapacity = Math.max(0, limit - cededAmountToDate);
    const utilizationPercentage =
      limit > 0 ? (cededAmountToDate / limit) * 100 : 0;

    const breachedRuleIds = await this.findBreachedRules(
      treaty.id,
      exposureAmount,
      params.classOfBusiness ?? null,
      params.territory ?? null,
    );

    return {
      treatyId: treaty.id,
      treatySectionId: section?.id ?? null,
      treatyForm: treaty.treaty_form,
      grossExposureAmount: exposureAmount.toFixed(2),
      cededAmountToDate: cededAmountToDate.toFixed(2),
      availableCapacity: availableCapacity.toFixed(2),
      utilizationPercentage: utilizationPercentage.toFixed(4),
      classOfBusiness: params.classOfBusiness ?? null,
      territory: null,
      breachedRuleIds,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async assertCapacityAvailable(
    user: AuthenticatedUser,
    params: EvaluateCapacityParams,
  ): Promise<ReinsuranceExposureSnapshot> {
    const snapshot = await this.evaluate(user, params);
    const exposureAmount = Number(params.exposureAmount ?? 0);
    const availableCapacity = Number(snapshot.availableCapacity ?? 0);

    if (snapshot.breachedRuleIds.length) {
      throw new ConflictException(
        'Treaty eligibility rules block this reinsurance cession',
      );
    }

    if (exposureAmount > availableCapacity) {
      throw new ConflictException(
        'Treaty capacity is insufficient for this reinsurance cession',
      );
    }

    return snapshot;
  }

  private async sumCededSumInsured(
    treatyId: string,
    treatySectionId: string | null,
  ) {
    const query = this.cessionRepository
      .createQueryBuilder('cession')
      .select('COALESCE(SUM(cession.ceded_sum_insured), 0)', 'total')
      .where('cession.treaty_id = :treatyId', { treatyId })
      .andWhere('cession.status IN (:...statuses)', {
        statuses: CAPACITY_CONSUMING_CESSION_STATUSES,
      })
      .andWhere('cession.deleted_at IS NULL');

    if (treatySectionId) {
      query.andWhere('cession.treaty_section_id = :sectionId', {
        sectionId: treatySectionId,
      });
    }

    const row = await query.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async sumAdmittedRecoveries(
    treatyId: string,
    treatySectionId: string | null,
  ) {
    const query = this.recoveryRepository
      .createQueryBuilder('recovery')
      .innerJoin(PolicyCession, 'cession', 'cession.id = recovery.cession_id')
      .select('COALESCE(SUM(recovery.admitted_recovery), 0)', 'total')
      .where('cession.treaty_id = :treatyId', { treatyId })
      .andWhere('recovery.deleted_at IS NULL');

    if (treatySectionId) {
      query.andWhere('cession.treaty_section_id = :sectionId', {
        sectionId: treatySectionId,
      });
    }

    const row = await query.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async findBreachedRules(
    treatyId: string,
    exposureAmount: number,
    classOfBusiness: string | null,
    territory: string | null,
  ) {
    const rules = await this.eligibilityRuleRepository.find({
      where: { treaty_id: treatyId, is_exclusion: true },
    });

    const breached: string[] = [];
    for (const rule of rules) {
      if (
        rule.rule_type === 'SUM_INSURED_MAX' &&
        exposureAmount > Number(rule.rule_value)
      ) {
        breached.push(rule.id);
      } else if (
        rule.rule_type === 'CLASS_OF_BUSINESS' &&
        classOfBusiness &&
        rule.rule_value === classOfBusiness
      ) {
        breached.push(rule.id);
      } else if (
        rule.rule_type === 'TERRITORY' &&
        territory &&
        rule.rule_value === territory
      ) {
        breached.push(rule.id);
      }
    }

    return breached;
  }
}
