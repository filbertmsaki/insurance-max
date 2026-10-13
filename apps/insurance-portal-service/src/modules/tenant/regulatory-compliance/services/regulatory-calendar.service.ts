import {
  RegulatoryAuthorityType,
  RegulatoryFrequency as ContractRegulatoryFrequency,
  RegulatoryObligationStatus as ContractRegulatoryObligationStatus,
  RegulatoryObligationType,
} from '@insurance-max/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import { In, Repository } from 'typeorm';
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';

import type { RegulatoryListQueryDto } from '../dto/regulatory-list-query.dto';
import { Company } from '../../../platform/companies/entities/company.entity';
import { CompanyRegulatoryProfile } from '../entities/company-regulatory-profile.entity';
import { RegulatoryAuthorityProfile } from '../entities/regulatory-authority-profile.entity';
import { RegulatoryLevyAssessment } from '../entities/regulatory-levy-assessment.entity';
import { RegulatoryObligationDefinition } from '../entities/regulatory-obligation-definition.entity';
import { RegulatoryObligationInstance } from '../entities/regulatory-obligation-instance.entity';
import { RegulatoryReturnSubmission } from '../entities/regulatory-return-submission.entity';
import { RegulatoryReturn } from '../entities/regulatory-return.entity';
import {
  RegulatoryFrequency,
  RegulatoryReturnStatus,
} from '../enums/regulatory.enums';
import { RegulatoryDueDateService } from './regulatory-due-date.service';

type DueDateRule = {
  type: string;
  day: number;
  monthsAfterPeriod: number;
  adjustForWeekend: boolean;
  weekendAdjustment: 'NEXT_WORKING_DAY' | 'PREVIOUS_WORKING_DAY';
};

@Injectable()
export class RegulatoryCalendarService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyRegulatoryProfile)
    private readonly profileRepository: Repository<CompanyRegulatoryProfile>,
    @InjectRepository(RegulatoryAuthorityProfile)
    private readonly authorityRepository: Repository<RegulatoryAuthorityProfile>,
    @InjectRepository(RegulatoryObligationDefinition)
    private readonly definitionRepository: Repository<RegulatoryObligationDefinition>,
    @InjectRepository(RegulatoryObligationInstance)
    private readonly instanceRepository: Repository<RegulatoryObligationInstance>,
    @InjectRepository(RegulatoryReturn)
    private readonly returnRepository: Repository<RegulatoryReturn>,
    @InjectRepository(RegulatoryReturnSubmission)
    private readonly submissionRepository: Repository<RegulatoryReturnSubmission>,
    @InjectRepository(RegulatoryLevyAssessment)
    private readonly assessmentRepository: Repository<RegulatoryLevyAssessment>,
    private readonly dueDateService: RegulatoryDueDateService,
    private readonly configService: ConfigService,
  ) {}

  async getProfile(companyId: string) {
    return this.ensureProfile(companyId);
  }

  async updateProfile(
    companyId: string,
    dto: Partial<CompanyRegulatoryProfile>,
    userId?: string | null,
  ) {
    const profile = await this.ensureProfile(companyId);
    Object.assign(profile, {
      financial_year_start_month:
        dto.financial_year_start_month ?? profile.financial_year_start_month,
      regulator_name: dto.regulator_name ?? profile.regulator_name,
      regulator_code: dto.regulator_code ?? profile.regulator_code,
      timezone: dto.timezone ?? profile.timezone,
      levy_frequency: dto.levy_frequency ?? profile.levy_frequency,
      levy_rate: dto.levy_rate ?? profile.levy_rate,
      metadata: dto.metadata ?? profile.metadata,
      updated_by: userId ?? profile.updated_by,
    });

    const saved = await this.profileRepository.save(profile);
    await this.syncDefaultAuthorityFromProfile(saved);
    return saved;
  }

  async listAuthorities(companyId: string) {
    await this.ensureDefaultAuthorityProfile(companyId);
    return this.authorityRepository.find({
      where: { company_id: companyId },
      order: { authority_name: 'ASC' },
    });
  }

  async listDefinitions(companyId: string) {
    await this.ensureCanonicalSetup(companyId);
    return this.definitionRepository.find({
      where: { company_id: companyId, active: true },
      order: {
        obligation_name: 'ASC',
        version_number: 'DESC',
      },
    });
  }

  async listCalendar(companyId: string, query?: RegulatoryListQueryDto) {
    await this.ensureCanonicalSetup(companyId);
    await this.refreshObligationStatuses(companyId);

    if (query && isPagedRequest(query)) {
      const qb = this.instanceRepository
        .createQueryBuilder('instance')
        .where('instance.company_id = :companyId', { companyId });
      if (query.status) {
        qb.andWhere('instance.status = :status', { status: query.status });
      }
      const page = await paginateQueryBuilder(qb, query, {
        sortable: {
          due_at: 'instance.due_at',
          period: 'instance.period_start',
          status: 'instance.status',
          obligation: 'instance.obligation_reference',
          created_at: 'instance.created_at',
        },
        defaultSort: 'due_at',
        defaultOrder: 'ASC',
        searchable: ['instance.obligation_reference', 'instance.status'],
        tieBreaker: 'instance.id',
      });
      return {
        ...page,
        data: await this.enrichInstances(companyId, page.data),
      };
    }

    const instances = await this.instanceRepository.find({
      where: { company_id: companyId },
      order: { due_at: 'ASC', created_at: 'DESC' },
      take: 500,
    });
    return this.enrichInstances(companyId, instances);
  }

  private async enrichInstances(
    companyId: string,
    instances: RegulatoryObligationInstance[],
  ) {
    const returnIds = instances
      .map((instance) => instance.active_return_id)
      .filter((id): id is string => Boolean(id));
    const assessmentIds = instances
      .map((instance) => instance.active_levy_assessment_id)
      .filter((id): id is string => Boolean(id));
    const [definitions, authorities, returns, assessments] = await Promise.all([
      this.definitionRepository.find({ where: { company_id: companyId } }),
      this.authorityRepository.find({ where: { company_id: companyId } }),
      returnIds.length
        ? this.returnRepository.find({
            where: { company_id: companyId, id: In(returnIds) },
          })
        : Promise.resolve([] as RegulatoryReturn[]),
      assessmentIds.length
        ? this.assessmentRepository.find({
            where: { company_id: companyId, id: In(assessmentIds) },
          })
        : Promise.resolve([] as RegulatoryLevyAssessment[]),
    ]);

    const definitionsById = new Map(definitions.map((item) => [item.id, item]));
    const authoritiesById = new Map(authorities.map((item) => [item.id, item]));
    const returnsById = new Map(returns.map((item) => [item.id, item]));
    const assessmentsById = new Map(assessments.map((item) => [item.id, item]));

    return instances.map((instance) => {
      const definition = definitionsById.get(instance.definition_id) ?? null;
      const authority = definition
        ? (authoritiesById.get(definition.authority_profile_id) ?? null)
        : null;
      const activeReturn = instance.active_return_id
        ? (returnsById.get(instance.active_return_id) ?? null)
        : null;
      const activeAssessment = instance.active_levy_assessment_id
        ? (assessmentsById.get(instance.active_levy_assessment_id) ?? null)
        : null;

      return {
        ...instance,
        definition,
        authority,
        active_return: activeReturn,
        active_levy_assessment: activeAssessment,
        days_remaining: Math.ceil(
          DateTime.fromJSDate(instance.due_at).diffNow('days').days,
        ),
        allowed_actions: this.resolveAllowedActions(
          instance,
          activeReturn,
          activeAssessment,
        ),
      };
    });
  }

  async listReturns(companyId: string, query?: RegulatoryListQueryDto) {
    await this.ensureCanonicalSetup(companyId);

    if (query && isPagedRequest(query)) {
      const qb = this.returnRepository
        .createQueryBuilder('return')
        .where('return.company_id = :companyId', { companyId });
      if (query.status) {
        qb.andWhere('return.status = :status', { status: query.status });
      }
      const page = await paginateQueryBuilder(qb, query, {
        sortable: {
          created_at: 'return.created_at',
          return_no: 'return.return_no',
          status: 'return.status',
          period: 'return.period_end',
        },
        defaultSort: 'created_at',
        searchable: ['return.return_no', 'return.status'],
        tieBreaker: 'return.id',
      });
      return {
        ...page,
        data: await Promise.all(
          page.data.map((record) => this.enrichReturn(companyId, record)),
        ),
      };
    }

    const returns = await this.returnRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      take: 500,
    });

    return Promise.all(
      returns.map((record) => this.enrichReturn(companyId, record)),
    );
  }

  async getReturn(companyId: string, returnId: string) {
    await this.ensureCanonicalSetup(companyId);
    const record = await this.returnRepository.findOne({
      where: { id: returnId, company_id: companyId },
    });

    if (!record) {
      throw new NotFoundException('Regulatory return was not found');
    }

    return this.enrichReturn(companyId, record);
  }

  async getObligation(companyId: string, obligationId: string) {
    await this.ensureCanonicalSetup(companyId);
    await this.refreshObligationStatuses(companyId);

    const instance = await this.instanceRepository.findOne({
      where: { id: obligationId, company_id: companyId },
    });

    if (!instance) {
      throw new NotFoundException('Regulatory obligation was not found');
    }

    const [record] = await this.enrichInstances(companyId, [instance]);
    return record;
  }

  async generateForCompany(companyId: string, year: number, userId?: string) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company was not found');
    }

    const { profile, authority, definitions } = await this.ensureCanonicalSetup(
      companyId,
      company,
      userId,
    );

    const timezone =
      profile.timezone ??
      this.configService.get<string>('REGULATORY_DEFAULT_TIMEZONE') ??
      'Africa/Dar_es_Salaam';

    let generatedInstances = 0;
    let generatedReturns = 0;

    for (const definition of definitions) {
      const periods = this.buildPeriods(year, definition.frequency, timezone);

      for (const period of periods) {
        const existing = await this.instanceRepository.findOne({
          where: {
            definition_id: definition.id,
            period_start: period.start.toISODate() ?? '',
            period_end: period.end.toISODate() ?? '',
          },
        });

        let instance = existing;
        if (!instance) {
          const obligationReference = `${authority.authority_code}-${definition.obligation_code}-${period.start.toFormat('yyyyLL')}`;
          instance = await this.instanceRepository.save(
            this.instanceRepository.create({
              company_id: companyId,
              definition_id: definition.id,
              obligation_reference: obligationReference,
              period_start: period.start.toISODate() ?? '',
              period_end: period.end.toISODate() ?? '',
              due_at: this.dueDateService.calculateDueDateFromRule(
                definition.due_date_rule as DueDateRule,
                period.end,
                timezone,
              ),
              status: ContractRegulatoryObligationStatus.UPCOMING,
            }),
          );
          generatedInstances += 1;
        }

        const activeReturn = await this.ensureActiveReturn(
          companyId,
          instance,
          definition,
          year,
          userId,
        );
        if (activeReturn.created) {
          generatedReturns += 1;
        }
      }
    }

    return {
      company_id: companyId,
      year,
      generated_instances: generatedInstances,
      generated_returns: generatedReturns,
    };
  }

  async validateReturn(companyId: string, returnId: string, userId: string) {
    const record = await this.requireReturn(companyId, returnId);
    const errors: string[] = [];

    if (!record.report_definition_code?.trim()) {
      errors.push('Report definition code is required');
    }

    if (!record.period_start || !record.period_end) {
      errors.push('Return period is required');
    }

    if (!record.source_cutoff_at) {
      record.source_cutoff_at = new Date();
    }

    const snapshot = this.buildReturnSnapshot(record);
    const snapshotHash = this.hashPayload(snapshot);
    record.return_snapshot = snapshot;
    record.return_snapshot_hash = snapshotHash;
    record.validation_results = {
      validatedBy: userId,
      validatedAt: new Date().toISOString(),
      errors,
    };
    record.status =
      errors.length > 0
        ? RegulatoryReturnStatus.VALIDATION_FAILED
        : RegulatoryReturnStatus.GENERATED;

    await this.returnRepository.save(record);
    return {
      return_id: record.id,
      valid: errors.length === 0,
      errors,
      snapshot_hash: snapshotHash,
    };
  }

  async reconcileReturn(companyId: string, returnId: string, userId: string) {
    const record = await this.requireReturn(companyId, returnId);
    const tolerance = Number(
      this.configService.get<string>('REGULATORY_RECONCILIATION_TOLERANCE') ??
        '0.01',
    );

    const assessment = record.obligation_instance_id
      ? await this.assessmentRepository.findOne({
          where: {
            company_id: companyId,
            obligation_instance_id: record.obligation_instance_id,
          },
          order: { created_at: 'DESC' },
        })
      : null;

    const reportedBasis = Number(assessment?.basis_amount ?? '0');
    const financeBasis = Number(assessment?.basis_amount ?? '0');
    const difference = Math.abs(reportedBasis - financeBasis);
    const inBalance = difference <= tolerance;

    record.reconciliation_status = inBalance ? 'IN_BALANCE' : 'OUT_OF_BALANCE';
    record.reconciliation_summary = {
      reconciledBy: userId,
      reconciledAt: new Date().toISOString(),
      reportedBasis,
      financeBasis,
      difference,
      tolerance,
      status: record.reconciliation_status,
    };

    await this.returnRepository.save(record);
    return record.reconciliation_summary;
  }

  async submitForReview(companyId: string, returnId: string, userId: string) {
    const record = await this.requireReturn(companyId, returnId);

    const validationErrors = this.extractValidationErrors(
      record.validation_results,
    );
    if (validationErrors.length > 0) {
      throw new BadRequestException(
        `Return validation failed: ${validationErrors.join(', ')}`,
      );
    }

    record.status = RegulatoryReturnStatus.PENDING_REVIEW;
    record.submitted_for_review_by = userId;
    record.submitted_for_review_at = new Date();
    await this.returnRepository.save(record);
    return record;
  }

  async approveReturn(companyId: string, returnId: string, userId: string) {
    const record = await this.requireReturn(companyId, returnId);

    if (record.prepared_by && record.prepared_by === userId) {
      throw new BadRequestException(
        'Maker-checker rule prevents preparer approval',
      );
    }

    const validationErrors = this.extractValidationErrors(
      record.validation_results,
    );
    if (validationErrors.length > 0) {
      throw new BadRequestException(
        `Return validation failed: ${validationErrors.join(', ')}`,
      );
    }

    if (
      record.reconciliation_status &&
      record.reconciliation_status !== 'IN_BALANCE'
    ) {
      throw new BadRequestException(
        'Return reconciliation must be in balance before approval',
      );
    }

    if (!record.return_snapshot) {
      record.return_snapshot = this.buildReturnSnapshot(record);
      record.return_snapshot_hash = this.hashPayload(record.return_snapshot);
    }

    record.status = RegulatoryReturnStatus.APPROVED;
    record.approved_by = userId;
    record.approved_at = new Date();
    await this.returnRepository.save(record);
    return record;
  }

  async createCorrection(companyId: string, returnId: string, userId: string) {
    const current = await this.requireReturn(companyId, returnId);
    const instanceId = current.obligation_instance_id;

    if (!instanceId) {
      throw new BadRequestException(
        'Only canonical regulatory returns can create corrections',
      );
    }

    const latestVersion = await this.returnRepository.find({
      where: {
        company_id: companyId,
        obligation_instance_id: instanceId,
      },
      order: { version_number: 'DESC' },
      take: 1,
    });

    const versionNumber = (latestVersion[0]?.version_number ?? 0) + 1;
    const correction = await this.returnRepository.save(
      this.returnRepository.create({
        company_id: current.company_id,
        definition_id: current.definition_id,
        obligation_id: current.obligation_id,
        obligation_instance_id: current.obligation_instance_id,
        return_no: this.buildReturnNumber(
          current.company_id,
          current.period_start,
          versionNumber,
        ),
        return_code: current.return_code,
        version_number: versionNumber,
        report_definition_code: current.report_definition_code,
        report_definition_version: current.report_definition_version,
        status: RegulatoryReturnStatus.DRAFT,
        period_start: current.period_start,
        period_end: current.period_end,
        due_at: current.due_at,
        currency: current.currency,
        currency_code: current.currency_code ?? current.currency,
        parameters: current.parameters ?? {},
        parameters_hash:
          current.parameters_hash ?? this.hashPayload(current.parameters ?? {}),
        source_cutoff_at: new Date(),
        reconciliation_status: 'NOT_CHECKED',
        prepared_by: userId,
        prepared_at: new Date(),
        supersedes_return_id: current.id,
        state_version: 1,
      }),
    );

    current.status = RegulatoryReturnStatus.SUPERSEDED;
    await this.returnRepository.save(current);

    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId, company_id: companyId },
    });
    if (instance) {
      instance.active_return_id = correction.id;
      await this.instanceRepository.save(instance);
    }

    return correction;
  }

  async recordSubmission(
    companyId: string,
    returnId: string,
    userId: string,
    dto: {
      submission_channel: string;
      submission_reference?: string;
      evidence_document_id?: string;
      acknowledgement_reference?: string;
      acknowledgement_code?: string;
      acknowledgement_message?: string;
      acknowledged_at?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const record = await this.requireReturn(companyId, returnId);

    const requireEvidence =
      String(
        this.configService.get<string>(
          'REGULATORY_REQUIRE_SUBMISSION_EVIDENCE',
        ) ?? 'true',
      ) === 'true';

    if (requireEvidence && !dto.evidence_document_id?.trim()) {
      throw new BadRequestException('Submission evidence is required');
    }

    const submission = await this.submissionRepository.save(
      this.submissionRepository.create({
        company_id: companyId,
        regulatory_return_id: returnId,
        submission_no: this.buildSubmissionNumber(companyId),
        submission_channel: dto.submission_channel.trim(),
        submission_reference: dto.submission_reference?.trim() ?? null,
        status: dto.acknowledgement_reference
          ? RegulatoryReturnStatus.ACKNOWLEDGED
          : RegulatoryReturnStatus.SUBMITTED,
        submitted_payload_hash: this.hashPayload({
          returnId,
          companyId,
          ...dto,
        }),
        acknowledgement_reference:
          dto.acknowledgement_reference?.trim() ?? null,
        acknowledgement_code: dto.acknowledgement_code?.trim() ?? null,
        acknowledgement_message: dto.acknowledgement_message?.trim() ?? null,
        submitted_by: userId,
        submitted_at: new Date(),
        acknowledged_at: dto.acknowledged_at
          ? new Date(dto.acknowledged_at)
          : dto.acknowledgement_reference
            ? new Date()
            : null,
        evidence_document_id: dto.evidence_document_id?.trim() ?? null,
        metadata: dto.metadata ?? null,
      }),
    );

    record.submitted_at = submission.submitted_at;
    record.submission_reference = submission.submission_reference;
    record.status = dto.acknowledgement_reference
      ? RegulatoryReturnStatus.ACKNOWLEDGED
      : RegulatoryReturnStatus.SUBMITTED;

    await this.returnRepository.save(record);

    if (record.obligation_instance_id) {
      const instance = await this.instanceRepository.findOne({
        where: { id: record.obligation_instance_id, company_id: companyId },
      });
      if (instance) {
        instance.status = dto.acknowledgement_reference
          ? ContractRegulatoryObligationStatus.ACKNOWLEDGED
          : ContractRegulatoryObligationStatus.SUBMITTED;
        if (dto.acknowledgement_reference) {
          instance.completed_at = new Date();
        }
        await this.instanceRepository.save(instance);
      }
    }

    return submission;
  }

  async acknowledgeSubmission(
    companyId: string,
    submissionId: string,
    dto: {
      acknowledgement_reference?: string;
      acknowledgement_code?: string;
      acknowledgement_message?: string;
    },
  ) {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId, company_id: companyId },
    });

    if (!submission) {
      throw new NotFoundException('Submission was not found');
    }

    submission.acknowledgement_reference =
      dto.acknowledgement_reference?.trim() ??
      submission.acknowledgement_reference;
    submission.acknowledgement_code =
      dto.acknowledgement_code?.trim() ?? submission.acknowledgement_code;
    submission.acknowledgement_message =
      dto.acknowledgement_message?.trim() ?? submission.acknowledgement_message;
    submission.acknowledged_at = new Date();
    submission.status = RegulatoryReturnStatus.ACKNOWLEDGED;
    await this.submissionRepository.save(submission);

    const record = await this.requireReturn(
      companyId,
      submission.regulatory_return_id,
    );
    record.status = RegulatoryReturnStatus.ACKNOWLEDGED;
    await this.returnRepository.save(record);

    return submission;
  }

  async waiveObligation(
    companyId: string,
    instanceId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason.trim()) {
      throw new BadRequestException('Waiver reason is required');
    }

    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId, company_id: companyId },
    });

    if (!instance) {
      throw new NotFoundException('Regulatory obligation was not found');
    }

    instance.status = ContractRegulatoryObligationStatus.WAIVED;
    instance.waived_by = userId;
    instance.waived_at = new Date();
    instance.waiver_reason = reason.trim();
    await this.instanceRepository.save(instance);
    return instance;
  }

  async assignObligation(
    companyId: string,
    instanceId: string,
    dto: {
      assigned_user_id?: string | null;
      assigned_role_id?: string | null;
    },
  ) {
    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId, company_id: companyId },
    });

    if (!instance) {
      throw new NotFoundException('Regulatory obligation was not found');
    }

    instance.assigned_user_id = dto.assigned_user_id ?? null;
    instance.assigned_role_id = dto.assigned_role_id ?? null;
    return this.instanceRepository.save(instance);
  }

  async markNotApplicable(
    companyId: string,
    instanceId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason.trim()) {
      throw new BadRequestException('Reason is required');
    }

    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId, company_id: companyId },
    });

    if (!instance) {
      throw new NotFoundException('Regulatory obligation was not found');
    }

    instance.status = ContractRegulatoryObligationStatus.NOT_APPLICABLE;
    instance.waived_by = userId;
    instance.waived_at = new Date();
    instance.waiver_reason = reason.trim();
    instance.completed_at = new Date();
    return this.instanceRepository.save(instance);
  }

  private async ensureCanonicalSetup(
    companyId: string,
    providedCompany?: Company,
    userId?: string,
  ) {
    const company =
      providedCompany ??
      (await this.companyRepository.findOne({ where: { id: companyId } }));
    if (!company) {
      throw new NotFoundException('Company was not found');
    }

    const profile = await this.ensureProfile(companyId);
    const authority = await this.ensureDefaultAuthorityProfile(
      companyId,
      profile,
    );
    const definitions = await this.ensureDefaultDefinitions(
      companyId,
      company,
      authority,
      userId,
    );

    return { company, profile, authority, definitions };
  }

  private async ensureProfile(companyId: string) {
    let profile = await this.profileRepository.findOne({
      where: { company_id: companyId },
    });

    if (!profile) {
      profile = await this.profileRepository.save(
        this.profileRepository.create({
          company_id: companyId,
          financial_year_start_month: 1,
          regulator_name: 'TIRA',
          timezone:
            this.configService.get<string>('REGULATORY_DEFAULT_TIMEZONE') ??
            'Africa/Dar_es_Salaam',
          levy_frequency: RegulatoryFrequency.MONTHLY,
          levy_rate: String(
            this.configService.get<string>('PREMIUM_LEVY_DEFAULT_RATE') ??
              '1.5',
          ),
        }),
      );
    }

    return profile;
  }

  private async syncDefaultAuthorityFromProfile(
    profile: CompanyRegulatoryProfile,
  ) {
    const existing = await this.authorityRepository.findOne({
      where: { company_id: profile.company_id, authority_code: 'TIRA' },
    });

    if (!existing) {
      return;
    }

    existing.authority_name = profile.regulator_name;
    existing.jurisdiction_code = profile.regulator_code ?? 'TZ';
    await this.authorityRepository.save(existing);
  }

  private async ensureDefaultAuthorityProfile(
    companyId: string,
    existingProfile?: CompanyRegulatoryProfile,
  ) {
    const profile = existingProfile ?? (await this.ensureProfile(companyId));
    let authority = await this.authorityRepository.findOne({
      where: { company_id: companyId, authority_code: 'TIRA' },
    });

    if (!authority) {
      authority = this.authorityRepository.create({
        company_id: companyId,
        authority_code: 'TIRA',
        authority_name: profile.regulator_name,
        authority_type: RegulatoryAuthorityType.INSURANCE_REGULATOR,
        jurisdiction_code: profile.regulator_code ?? 'TZ',
        submission_channel: 'MANUAL',
        active: true,
        metadata: {
          seededBy: 'regulatory-calendar',
        },
      });
    } else {
      authority.authority_name = profile.regulator_name;
      authority.jurisdiction_code =
        profile.regulator_code ?? authority.jurisdiction_code;
      authority.active = true;
    }

    return this.authorityRepository.save(authority);
  }

  private async ensureDefaultDefinitions(
    companyId: string,
    company: Company,
    authority: RegulatoryAuthorityProfile,
    userId?: string,
  ) {
    const actorId = userId ?? company.id;
    const defaults = [
      {
        obligation_code: 'PREMIUM_LEVY_MONTHLY',
        obligation_name: 'Monthly premium levy return',
        obligation_type: RegulatoryObligationType.LEVY,
        frequency: ContractRegulatoryFrequency.MONTHLY,
        report_code: 'PREMIUM_LEVY',
        due_date_rule: this.defaultDueDateRule(),
      },
      {
        obligation_code: 'REGULATORY_RETURN_QUARTERLY',
        obligation_name: 'Quarterly regulatory return',
        obligation_type: RegulatoryObligationType.RETURN,
        frequency: ContractRegulatoryFrequency.QUARTERLY,
        report_code: 'PRODUCT_PERFORMANCE',
        due_date_rule: this.defaultDueDateRule(),
      },
    ] as const;

    const definitions: RegulatoryObligationDefinition[] = [];
    for (const item of defaults) {
      let definition = await this.definitionRepository.findOne({
        where: {
          company_id: companyId,
          obligation_code: item.obligation_code,
          version_number: 1,
        },
      });

      const snapshot = {
        authority_profile_id: authority.id,
        company_type: company.company_type ?? CompanyType.INSURANCE_COMPANY,
        ...item,
      };

      if (!definition) {
        definition = this.definitionRepository.create({
          company_id: companyId,
          authority_profile_id: authority.id,
          obligation_code: item.obligation_code,
          obligation_name: item.obligation_name,
          obligation_type: item.obligation_type,
          frequency: item.frequency,
          effective_from: '2020-01-01',
          effective_to: null,
          due_date_rule: item.due_date_rule,
          report_code: item.report_code,
          requires_approval: true,
          requires_submission_evidence: true,
          requires_reconciliation: true,
          active: true,
          version_number: 1,
          definition_snapshot: snapshot,
          definition_snapshot_hash: this.hashPayload(snapshot),
          created_by: actorId,
        });
      } else {
        definition.authority_profile_id = authority.id;
        definition.obligation_name = item.obligation_name;
        definition.obligation_type = item.obligation_type;
        definition.frequency = item.frequency;
        definition.due_date_rule = item.due_date_rule;
        definition.report_code = item.report_code;
        definition.active = true;
        definition.definition_snapshot = snapshot;
        definition.definition_snapshot_hash = this.hashPayload(snapshot);
      }

      definitions.push(await this.definitionRepository.save(definition));
    }

    return definitions;
  }

  private async ensureActiveReturn(
    companyId: string,
    instance: RegulatoryObligationInstance,
    definition: RegulatoryObligationDefinition,
    year: number,
    userId?: string,
  ) {
    let record = await this.returnRepository.findOne({
      where: {
        company_id: companyId,
        obligation_instance_id: instance.id,
        version_number: 1,
      },
    });

    let created = false;
    if (!record) {
      record = await this.returnRepository.save(
        this.returnRepository.create({
          company_id: companyId,
          definition_id: instance.definition_id,
          obligation_id: instance.id,
          obligation_instance_id: instance.id,
          return_no: this.buildReturnNumber(
            companyId,
            instance.period_start,
            1,
          ),
          return_code: definition.report_code ?? definition.obligation_code,
          version_number: 1,
          status: RegulatoryReturnStatus.DRAFT,
          report_definition_code:
            definition.report_code ?? definition.obligation_code,
          report_definition_version: 1,
          period_start: instance.period_start,
          period_end: instance.period_end,
          due_at: instance.due_at,
          currency: 'TZS',
          currency_code: 'TZS',
          parameters: {
            company_id: companyId,
            year,
            period_start: instance.period_start,
            period_end: instance.period_end,
          },
          parameters_hash: this.hashPayload({
            company_id: companyId,
            year,
            period_start: instance.period_start,
            period_end: instance.period_end,
          }),
          source_cutoff_at: new Date(),
          reconciliation_status: 'NOT_CHECKED',
          prepared_by: userId ?? null,
          prepared_at: new Date(),
        }),
      );
      created = true;
    }

    if (instance.active_return_id !== record.id) {
      instance.active_return_id = record.id;
      await this.instanceRepository.save(instance);
    }

    return { record, created };
  }

  private async enrichReturn(companyId: string, record: RegulatoryReturn) {
    const [submissions, instance, siblingVersions, assessment] =
      await Promise.all([
        this.submissionRepository.find({
          where: { company_id: companyId, regulatory_return_id: record.id },
          order: { created_at: 'DESC' },
        }),
        record.obligation_instance_id
          ? this.instanceRepository.findOne({
              where: {
                id: record.obligation_instance_id,
                company_id: companyId,
              },
            })
          : null,
        record.obligation_instance_id
          ? this.returnRepository.find({
              where: {
                company_id: companyId,
                obligation_instance_id: record.obligation_instance_id,
              },
              order: { version_number: 'DESC' },
            })
          : [],
        record.obligation_instance_id
          ? this.assessmentRepository.findOne({
              where: {
                company_id: companyId,
                obligation_instance_id: record.obligation_instance_id,
              },
              order: { created_at: 'DESC' },
            })
          : null,
      ]);

    return {
      ...record,
      submissions,
      active_levy_assessment: assessment,
      obligation_instance: instance,
      versions: siblingVersions.map((item) => ({
        id: item.id,
        return_no: item.return_no,
        version_number: item.version_number,
        status: item.status,
        created_at: item.created_at,
      })),
      read_only: [
        RegulatoryReturnStatus.SUBMITTED,
        RegulatoryReturnStatus.ACKNOWLEDGED,
        RegulatoryReturnStatus.ACCEPTED,
      ].includes(record.status),
    };
  }

  private async refreshObligationStatuses(companyId: string) {
    const records = await this.instanceRepository.find({
      where: { company_id: companyId },
      take: 500,
    });

    const now = DateTime.now();
    for (const record of records) {
      if (
        (
          [
            ContractRegulatoryObligationStatus.COMPLETED,
            ContractRegulatoryObligationStatus.ACKNOWLEDGED,
            ContractRegulatoryObligationStatus.WAIVED,
            ContractRegulatoryObligationStatus.NOT_APPLICABLE,
          ] as ContractRegulatoryObligationStatus[]
        ).includes(record.status)
      ) {
        continue;
      }

      const dueAt = DateTime.fromJSDate(record.due_at);
      let nextStatus: ContractRegulatoryObligationStatus =
        ContractRegulatoryObligationStatus.UPCOMING;

      if (dueAt < now) {
        nextStatus = ContractRegulatoryObligationStatus.OVERDUE;
      } else if (dueAt.startOf('day').equals(now.startOf('day'))) {
        nextStatus = ContractRegulatoryObligationStatus.DUE;
      }

      if (record.status !== nextStatus) {
        record.status = nextStatus;
        await this.instanceRepository.save(record);
      }
    }
  }

  private buildPeriods(
    year: number,
    frequency: ContractRegulatoryFrequency | RegulatoryFrequency,
    timezone: string,
  ) {
    if (frequency === ContractRegulatoryFrequency.QUARTERLY) {
      return [0, 1, 2, 3].map((index) => {
        const start = DateTime.fromObject(
          { year, month: index * 3 + 1, day: 1 },
          { zone: timezone },
        ).startOf('day');
        const end = start.plus({ month: 3 }).minus({ day: 1 }).endOf('day');
        return { start, end };
      });
    }

    if (frequency === ContractRegulatoryFrequency.ANNUAL) {
      const start = DateTime.fromObject(
        { year, month: 1, day: 1 },
        { zone: timezone },
      ).startOf('day');
      const end = start.endOf('year');
      return [{ start, end }];
    }

    return Array.from({ length: 12 }, (_, index) => {
      const start = DateTime.fromObject(
        { year, month: index + 1, day: 1 },
        { zone: timezone },
      ).startOf('day');
      const end = start.endOf('month');
      return { start, end };
    });
  }

  private defaultDueDateRule(): DueDateRule {
    return {
      type: 'DAY_OF_MONTH_AFTER_PERIOD',
      day: 15,
      monthsAfterPeriod: 1,
      adjustForWeekend: true,
      weekendAdjustment: 'NEXT_WORKING_DAY',
    };
  }

  private resolveAllowedActions(
    instance: RegulatoryObligationInstance,
    activeReturn: RegulatoryReturn | null,
    activeAssessment: RegulatoryLevyAssessment | null,
  ) {
    const actions = ['ASSIGN'];

    if (!activeReturn) {
      actions.push('GENERATE_RETURN');
    } else {
      actions.push('OPEN_RETURN');
      if (
        !(
          [
            RegulatoryReturnStatus.SUBMITTED,
            RegulatoryReturnStatus.ACKNOWLEDGED,
            RegulatoryReturnStatus.ACCEPTED,
          ] as RegulatoryReturnStatus[]
        ).includes(activeReturn.status)
      ) {
        actions.push('VALIDATE_RETURN', 'RECONCILE_RETURN', 'SUBMIT_REVIEW');
      }
      if (activeReturn.status === RegulatoryReturnStatus.APPROVED) {
        actions.push('RECORD_SUBMISSION');
      }
    }

    if (!activeAssessment) {
      actions.push('CALCULATE_LEVY');
    }

    if (
      !(
        [
          ContractRegulatoryObligationStatus.COMPLETED,
          ContractRegulatoryObligationStatus.ACKNOWLEDGED,
          ContractRegulatoryObligationStatus.WAIVED,
        ] as ContractRegulatoryObligationStatus[]
      ).includes(instance.status)
    ) {
      actions.push('WAIVE', 'MARK_NOT_APPLICABLE');
    }

    return actions;
  }

  private buildReturnSnapshot(record: RegulatoryReturn) {
    return {
      return_no: record.return_no,
      return_code: record.return_code,
      version_number: record.version_number,
      period_start: record.period_start,
      period_end: record.period_end,
      currency_code: record.currency_code ?? record.currency,
      parameters: record.parameters ?? {},
      source_cutoff_at: record.source_cutoff_at?.toISOString() ?? null,
      calculated_at: new Date().toISOString(),
    };
  }

  private extractValidationErrors(payload: Record<string, unknown> | null) {
    const value = payload?.errors;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private requireReturn(companyId: string, returnId: string) {
    return this.returnRepository
      .findOne({
        where: { id: returnId, company_id: companyId },
      })
      .then((record) => {
        if (!record) {
          throw new NotFoundException('Regulatory return was not found');
        }
        return record;
      });
  }

  private buildReturnNumber(
    companyId: string,
    periodStart: string,
    versionNumber: number,
  ) {
    return `RET-${periodStart.replace(/-/g, '')}-${versionNumber}-${companyId.slice(0, 6).toUpperCase()}`;
  }

  private buildSubmissionNumber(companyId: string) {
    return `SUB-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${companyId.slice(0, 6).toUpperCase()}`;
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
