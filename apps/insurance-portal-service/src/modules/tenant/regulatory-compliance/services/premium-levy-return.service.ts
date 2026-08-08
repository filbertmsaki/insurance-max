import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LevyAssessmentStatus,
  RegulatoryObligationStatus,
  RegulatoryReconciliationStatus,
} from '@insurance-max/contracts';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import { Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PremiumLevyReturnLine } from '../entities/premium-levy-return-line.entity';
import { PremiumLevyReturn } from '../entities/premium-levy-return.entity';
import { RegulatoryAuthorityProfile } from '../entities/regulatory-authority-profile.entity';
import { RegulatoryLevyAssessment } from '../entities/regulatory-levy-assessment.entity';
import { RegulatoryLevyRule } from '../entities/regulatory-levy-rule.entity';
import { RegulatoryObligationInstance } from '../entities/regulatory-obligation-instance.entity';
import { RegulatoryReturn } from '../entities/regulatory-return.entity';
import {
  PremiumLevyLineType,
  PremiumLevyReturnStatus,
  RegulatoryReturnStatus,
} from '../enums/regulatory.enums';
import { PremiumLedgerService } from './premium-ledger.service';
import { RegulatoryLedgerService } from './regulatory-ledger.service';
import { RegulatoryLevyCalculationService } from './regulatory-levy-calculation.service';

@Injectable()
export class PremiumLevyReturnService {
  constructor(
    @InjectRepository(RegulatoryReturn)
    private readonly returnRepository: Repository<RegulatoryReturn>,
    @InjectRepository(RegulatoryObligationInstance)
    private readonly instanceRepository: Repository<RegulatoryObligationInstance>,
    @InjectRepository(RegulatoryAuthorityProfile)
    private readonly authorityRepository: Repository<RegulatoryAuthorityProfile>,
    @InjectRepository(RegulatoryLevyRule)
    private readonly levyRuleRepository: Repository<RegulatoryLevyRule>,
    @InjectRepository(RegulatoryLevyAssessment)
    private readonly assessmentRepository: Repository<RegulatoryLevyAssessment>,
    @InjectRepository(PremiumLevyReturn)
    private readonly levyRepository: Repository<PremiumLevyReturn>,
    @InjectRepository(PremiumLevyReturnLine)
    private readonly lineRepository: Repository<PremiumLevyReturnLine>,
    private readonly premiumLedgerService: PremiumLedgerService,
    private readonly regulatoryLedgerService: RegulatoryLedgerService,
    private readonly regulatoryLevyCalculationService: RegulatoryLevyCalculationService,
    private readonly configService: ConfigService,
  ) {}

  async calculate(
    user: AuthenticatedUser,
    regulatoryReturnId: string,
    dto: { levy_rate?: string | number },
  ) {
    const regulatoryReturn = await this.returnRepository.findOne({
      where: {
        id: regulatoryReturnId,
        company_id: user.companyId!,
      },
    });

    if (!regulatoryReturn) {
      throw new NotFoundException('Regulatory return was not found');
    }

    if (
      regulatoryReturn.status === RegulatoryReturnStatus.SUBMITTED ||
      regulatoryReturn.status === RegulatoryReturnStatus.ACCEPTED
    ) {
      throw new BadRequestException('Submitted returns cannot be recalculated');
    }

    const summary = await this.premiumLedgerService.summarizeGrossPremium(
      user.companyId!,
      regulatoryReturn.period_start,
      regulatoryReturn.period_end,
      regulatoryReturn.currency,
    );

    const levyRate = DecimalUtil.rate(
      dto.levy_rate ??
        this.configService.get<string>('PREMIUM_LEVY_DEFAULT_RATE') ??
        '1.5',
    );
    const adjustments = await this.sumAdjustments(regulatoryReturnId);
    const levyAmount = DecimalUtil.money(
      DecimalUtil.value(summary.gross_premium)
        .plus(DecimalUtil.value(adjustments))
        .mul(DecimalUtil.value(levyRate))
        .div(100),
    );

    let levyReturn = await this.levyRepository.findOne({
      where: {
        company_id: user.companyId!,
        regulatory_return_id: regulatoryReturn.id,
      },
    });

    if (!levyReturn) {
      levyReturn = this.levyRepository.create({
        company_id: user.companyId!,
        regulatory_return_id: regulatoryReturn.id,
        levy_no: `LEVY-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${user.companyId!.slice(0, 6).toUpperCase()}`,
        status: PremiumLevyReturnStatus.CALCULATED,
        period_start: regulatoryReturn.period_start,
        period_end: regulatoryReturn.period_end,
        currency: regulatoryReturn.currency,
        prepared_by: user.id,
      });
    }

    levyReturn.levy_rate = levyRate;
    levyReturn.gross_premium = summary.gross_premium;
    levyReturn.adjustments_amount = adjustments;
    levyReturn.levy_amount = levyAmount;
    levyReturn.billed_amount = levyAmount;
    levyReturn.status = PremiumLevyReturnStatus.CALCULATED;

    regulatoryReturn.status = RegulatoryReturnStatus.CALCULATED;
    regulatoryReturn.prepared_by = user.id;
    regulatoryReturn.data = {
      ...(regulatoryReturn.data ?? {}),
      premium_levy: {
        gross_premium: summary.gross_premium,
        adjustments_amount: adjustments,
        levy_rate: levyRate,
        levy_amount: levyAmount,
        calculated_at: new Date().toISOString(),
      },
    };

    const savedReturn = await this.returnRepository.save(regulatoryReturn);
    const savedLevyReturn = await this.levyRepository.save(levyReturn);
    const assessment = await this.upsertCanonicalAssessment(
      user,
      savedReturn,
      summary.gross_premium,
      adjustments,
      levyRate,
      levyAmount,
    );

    return {
      levy_return: savedLevyReturn,
      regulatory_return: savedReturn,
      levy_assessment: assessment,
    };
  }

  async addAdjustment(
    user: AuthenticatedUser,
    regulatoryReturnId: string,
    dto: {
      amount: string | number;
      description: string;
      evidence_reference?: string;
    },
  ) {
    if (!dto.description?.trim()) {
      throw new BadRequestException('Adjustment reason is required');
    }

    const requireEvidence =
      String(
        this.configService.get<string>(
          'PREMIUM_LEVY_REQUIRE_ADJUSTMENT_EVIDENCE',
        ) ?? 'true',
      ) === 'true';

    if (requireEvidence && !dto.evidence_reference?.trim()) {
      throw new BadRequestException(
        'Adjustment evidence is required by configuration',
      );
    }

    const levyReturn = await this.levyRepository.findOne({
      where: {
        regulatory_return_id: regulatoryReturnId,
        company_id: user.companyId!,
      },
    });

    if (!levyReturn) {
      throw new NotFoundException('Premium levy return was not found');
    }

    return this.lineRepository.save(
      this.lineRepository.create({
        levy_return_id: levyReturn.id,
        line_type: PremiumLevyLineType.ADJUSTMENT,
        description: dto.description.trim(),
        amount: DecimalUtil.money(dto.amount),
        evidence_reference: dto.evidence_reference?.trim() ?? null,
      }),
    );
  }

  async listAssessments(companyId: string) {
    return this.assessmentRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      take: 500,
    });
  }

  async getAssessment(companyId: string, assessmentId: string) {
    const assessment = await this.assessmentRepository.findOne({
      where: { id: assessmentId, company_id: companyId },
    });

    if (!assessment) {
      throw new NotFoundException('Regulatory levy assessment was not found');
    }

    return assessment;
  }

  async submitForApproval(user: AuthenticatedUser, assessmentId: string) {
    const assessment = await this.getAssessment(user.companyId!, assessmentId);

    if (assessment.status !== LevyAssessmentStatus.CALCULATED) {
      throw new BadRequestException(
        'Only calculated levy assessments can be submitted for approval',
      );
    }

    assessment.status = LevyAssessmentStatus.PENDING_APPROVAL;
    return this.assessmentRepository.save(assessment);
  }

  async approveAssessment(user: AuthenticatedUser, assessmentId: string) {
    const assessment = await this.getAssessment(user.companyId!, assessmentId);

    if (assessment.prepared_by === user.id) {
      throw new BadRequestException(
        'Maker-checker rule prevents preparer approval',
      );
    }

    if (
      !(
        [
          LevyAssessmentStatus.CALCULATED,
          LevyAssessmentStatus.PENDING_APPROVAL,
        ] as LevyAssessmentStatus[]
      ).includes(assessment.status)
    ) {
      throw new BadRequestException('Levy assessment is not awaiting approval');
    }

    assessment.status = LevyAssessmentStatus.APPROVED;
    assessment.approved_by = user.id;
    assessment.approved_at = new Date();
    assessment.outstanding_amount = DecimalUtil.money(
      DecimalUtil.value(assessment.assessed_amount).minus(
        DecimalUtil.value(assessment.paid_amount),
      ),
    );
    if (DecimalUtil.value(assessment.outstanding_amount).greaterThan(0)) {
      assessment.status = LevyAssessmentStatus.PAYMENT_PENDING;
    }

    const saved = await this.assessmentRepository.save(assessment);

    const regulatoryReturn = await this.findReturnByInstance(
      saved.company_id,
      saved.obligation_instance_id,
    );
    const authority = await this.findAuthorityProfile(saved.company_id);
    await this.regulatoryLedgerService.recordLevyAssessmentApproval({
      assessment: saved,
      authorityProfileId: authority?.id ?? null,
      regulatoryReturnId: regulatoryReturn?.id ?? null,
      createdBy: user.id,
    });

    await this.syncInstanceStatus(
      saved.company_id,
      saved.obligation_instance_id,
      RegulatoryObligationStatus.APPROVED,
      saved.id,
    );

    return saved;
  }

  async requestPayment(companyId: string, assessmentId: string) {
    const assessment = await this.getAssessment(companyId, assessmentId);

    if (
      !(
        [
          LevyAssessmentStatus.APPROVED,
          LevyAssessmentStatus.PAYMENT_PENDING,
        ] as LevyAssessmentStatus[]
      ).includes(assessment.status)
    ) {
      throw new BadRequestException(
        'Only approved levy assessments can request payment',
      );
    }

    assessment.status = LevyAssessmentStatus.PAYMENT_PENDING;
    return this.assessmentRepository.save(assessment);
  }

  async reconcileAssessment(companyId: string, assessmentId: string) {
    const assessment = await this.getAssessment(companyId, assessmentId);
    const outstanding = DecimalUtil.value(assessment.assessed_amount).minus(
      DecimalUtil.value(assessment.paid_amount),
    );

    assessment.outstanding_amount = DecimalUtil.money(
      outstanding.greaterThan(0) ? outstanding : 0,
    );
    assessment.reconciliation_status = outstanding.isZero()
      ? RegulatoryReconciliationStatus.IN_BALANCE
      : RegulatoryReconciliationStatus.OUT_OF_BALANCE;
    assessment.status = outstanding.isZero()
      ? LevyAssessmentStatus.PAID
      : DecimalUtil.value(assessment.paid_amount).greaterThan(0)
        ? LevyAssessmentStatus.PARTIALLY_PAID
        : LevyAssessmentStatus.PAYMENT_PENDING;

    return this.assessmentRepository.save(assessment);
  }

  private async sumAdjustments(regulatoryReturnId: string) {
    const levyReturn = await this.levyRepository.findOne({
      where: { regulatory_return_id: regulatoryReturnId },
    });

    if (!levyReturn) {
      return '0.00';
    }

    const rows = await this.lineRepository
      .createQueryBuilder('line')
      .select('COALESCE(SUM(line.amount), 0)', 'amount')
      .where('line.levy_return_id = :levyReturnId', {
        levyReturnId: levyReturn.id,
      })
      .andWhere('line.line_type = :lineType', {
        lineType: PremiumLevyLineType.ADJUSTMENT,
      })
      .getRawOne<{ amount: string }>();

    return DecimalUtil.money(rows?.amount ?? 0);
  }

  private async upsertCanonicalAssessment(
    user: AuthenticatedUser,
    regulatoryReturn: RegulatoryReturn,
    grossPremium: string,
    adjustments: string,
    levyRate: string,
    levyAmount: string,
  ) {
    if (!regulatoryReturn.obligation_instance_id) {
      return null;
    }

    const authority = await this.findAuthorityProfile(user.companyId!);
    if (!authority) {
      throw new BadRequestException(
        'Regulatory authority profile is required for levy assessment',
      );
    }

    const rule = await this.ensureDefaultLevyRule(user, authority, levyRate);
    const basisAmount = DecimalUtil.add(grossPremium, adjustments);
    const assessedAmount = this.regulatoryLevyCalculationService.calculate(
      rule,
      basisAmount,
    );

    let assessment = await this.assessmentRepository.findOne({
      where: {
        company_id: user.companyId!,
        obligation_instance_id: regulatoryReturn.obligation_instance_id,
      },
      order: { created_at: 'DESC' },
    });

    if (!assessment) {
      assessment = this.assessmentRepository.create({
        company_id: user.companyId!,
        obligation_instance_id: regulatoryReturn.obligation_instance_id,
        levy_rule_id: rule.id,
        assessment_no: `ASM-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${user.companyId!.slice(0, 6).toUpperCase()}`,
        period_start: regulatoryReturn.period_start,
        period_end: regulatoryReturn.period_end,
        status: LevyAssessmentStatus.CALCULATED,
        basis_amount: basisAmount,
        rate_value: rule.rate_value,
        assessed_amount: DecimalUtil.money(assessedAmount),
        paid_amount: '0.00',
        outstanding_amount: DecimalUtil.money(assessedAmount),
        currency_code:
          regulatoryReturn.currency_code ?? regulatoryReturn.currency,
        source_report_code: regulatoryReturn.report_definition_code,
        source_report_job_id: regulatoryReturn.report_job_id,
        calculation_snapshot: {},
        calculation_snapshot_hash: '',
        reconciliation_status: RegulatoryReconciliationStatus.NOT_CHECKED,
        prepared_by: user.id,
      });
    }

    assessment.levy_rule_id = rule.id;
    assessment.status = LevyAssessmentStatus.CALCULATED;
    assessment.basis_amount = basisAmount;
    assessment.rate_value = rule.rate_value;
    assessment.assessed_amount = DecimalUtil.money(
      assessedAmount || levyAmount,
    );
    assessment.outstanding_amount = DecimalUtil.money(
      DecimalUtil.value(assessment.assessed_amount).minus(
        DecimalUtil.value(assessment.paid_amount),
      ),
    );
    assessment.currency_code =
      regulatoryReturn.currency_code ?? regulatoryReturn.currency;
    assessment.source_report_code = regulatoryReturn.report_definition_code;
    assessment.source_report_job_id = regulatoryReturn.report_job_id;
    assessment.calculation_snapshot = {
      source: 'premium-ledger',
      regulatory_return_id: regulatoryReturn.id,
      gross_premium: grossPremium,
      adjustments_amount: adjustments,
      basis_amount: basisAmount,
      rate_value: rule.rate_value,
      assessed_amount: assessment.assessed_amount,
      rule_snapshot: rule.rule_snapshot,
    };
    assessment.calculation_snapshot_hash = this.hashPayload(
      assessment.calculation_snapshot,
    );

    const savedAssessment = await this.assessmentRepository.save(assessment);
    await this.syncInstanceStatus(
      user.companyId!,
      regulatoryReturn.obligation_instance_id,
      RegulatoryObligationStatus.PREPARATION_IN_PROGRESS,
      savedAssessment.id,
    );

    return savedAssessment;
  }

  private async ensureDefaultLevyRule(
    user: AuthenticatedUser,
    authority: RegulatoryAuthorityProfile,
    levyRate: string,
  ) {
    let rule = await this.levyRuleRepository.findOne({
      where: {
        company_id: user.companyId!,
        levy_code: 'PREMIUM_LEVY',
        version_number: 1,
      },
    });

    const snapshot = {
      levy_code: 'PREMIUM_LEVY',
      levy_name: 'Premium levy',
      basis_type: 'GROSS_WRITTEN_PREMIUM',
      rate_type: 'PERCENTAGE',
      rate_value: levyRate,
      authority_profile_id: authority.id,
    };

    if (!rule) {
      rule = this.levyRuleRepository.create({
        company_id: user.companyId!,
        authority_profile_id: authority.id,
        levy_code: 'PREMIUM_LEVY',
        levy_name: 'Premium levy',
        basis_type: 'GROSS_WRITTEN_PREMIUM',
        rate_type: 'PERCENTAGE',
        rate_value: levyRate,
        minimum_amount: null,
        maximum_amount: null,
        currency_code: 'TZS',
        effective_from: '2020-01-01',
        effective_to: null,
        calculation_configuration: {
          source: 'premium-ledger',
          basis_field: 'gross_written_premium',
        },
        version_number: 1,
        rule_snapshot: snapshot,
        rule_snapshot_hash: this.hashPayload(snapshot),
        active: true,
        created_by: user.id,
      });
    } else if (levyRate && rule.rate_value !== levyRate) {
      rule.rate_value = levyRate;
      rule.rule_snapshot = snapshot;
      rule.rule_snapshot_hash = this.hashPayload(snapshot);
    }

    return this.levyRuleRepository.save(rule);
  }

  private async findAuthorityProfile(companyId: string) {
    return this.authorityRepository.findOne({
      where: { company_id: companyId, active: true },
      order: { updated_at: 'DESC' },
    });
  }

  private async findReturnByInstance(
    companyId: string,
    obligationInstanceId: string | null,
  ) {
    if (!obligationInstanceId) {
      return null;
    }

    return this.returnRepository.findOne({
      where: {
        company_id: companyId,
        obligation_instance_id: obligationInstanceId,
      },
      order: { version_number: 'DESC' },
    });
  }

  private async syncInstanceStatus(
    companyId: string,
    obligationInstanceId: string | null,
    status: RegulatoryObligationStatus,
    assessmentId?: string | null,
  ) {
    if (!obligationInstanceId) {
      return;
    }

    const instance = await this.instanceRepository.findOne({
      where: { id: obligationInstanceId, company_id: companyId },
    });

    if (!instance) {
      return;
    }

    instance.status = status;
    if (assessmentId) {
      instance.active_levy_assessment_id = assessmentId;
    }
    await this.instanceRepository.save(instance);
  }

  private hashPayload(payload: unknown) {
    return createHash('sha256')
      .update(this.stableStringify(payload))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }
}
