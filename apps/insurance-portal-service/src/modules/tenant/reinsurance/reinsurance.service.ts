import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Company } from '../../platform/companies/entities/company.entity';
import { AuditService } from '../../shared/audit/audit.service';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { MoneyUtil } from '../billing-commission/utils/money.util';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { NotificationsService } from '../work-items/notifications.service';
import { WorkItemsService } from '../work-items/work-items.service';
import {
  AcceptFacultativeOfferDto,
  CreateFacultativePlacementDto,
  CreatePolicyCessionDto,
  CreateTreatyDto,
  CreateTreatyParticipantDto,
  CreateTreatySectionDto,
  InviteFacultativeOfferDto,
  RespondFacultativeOfferDto,
} from './dto/reinsurance.dto';
import {
  FacultativeOfferStatus,
  FacultativePlacementStatus,
  ReinsuranceCessionStatus,
  ReinsuranceCessionType,
  ReinsuranceDeclarationStatus,
  TreatyParticipantStatus,
  TreatyStatus,
} from './enums/reinsurance.enums';
import { FacultativePlacementOffer } from './entities/facultative-placement-offer.entity';
import { FacultativePlacement } from './entities/facultative-placement.entity';
import { PolicyCessionParticipant } from './entities/policy-cession-participant.entity';
import { PolicyCession } from './entities/policy-cession.entity';
import {
  ReinsuranceDeclaration,
  ReinsuranceDeclarationParticipant,
} from './entities/reinsurance-declaration.entity';
import { ReinsuranceTreatyParticipant } from './entities/reinsurance-treaty-participant.entity';
import { ReinsuranceTreatySection } from './entities/reinsurance-treaty-section.entity';
import { ReinsuranceTreaty } from './entities/reinsurance-treaty.entity';
import { ReinsuranceCapacityService } from './services/reinsurance-capacity.service';

@Injectable()
export class ReinsuranceService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(ReinsuranceTreaty)
    private readonly treatyRepository: Repository<ReinsuranceTreaty>,

    @InjectRepository(ReinsuranceTreatySection)
    private readonly sectionRepository: Repository<ReinsuranceTreatySection>,

    @InjectRepository(ReinsuranceTreatyParticipant)
    private readonly treatyParticipantRepository: Repository<ReinsuranceTreatyParticipant>,

    @InjectRepository(FacultativePlacement)
    private readonly placementRepository: Repository<FacultativePlacement>,

    @InjectRepository(FacultativePlacementOffer)
    private readonly offerRepository: Repository<FacultativePlacementOffer>,

    @InjectRepository(PolicyCession)
    private readonly cessionRepository: Repository<PolicyCession>,

    @InjectRepository(PolicyCessionParticipant)
    private readonly cessionParticipantRepository: Repository<PolicyCessionParticipant>,

    @InjectRepository(ReinsuranceDeclaration)
    private readonly declarationRepository: Repository<ReinsuranceDeclaration>,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(PolicyRisk)
    private readonly policyRiskRepository: Repository<PolicyRisk>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    private readonly scopeService: DataAccessScopeService,
    private readonly referenceService: BusinessReferenceService,
    private readonly tiramisSubmitService: TiramisBusinessSubmitService,
    private readonly workItemsService: WorkItemsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly capacityService: ReinsuranceCapacityService,
  ) {}

  async findTreaties(user: AuthenticatedUser) {
    const scope = this.scopeService.resolve(user);
    const query = this.treatyRepository
      .createQueryBuilder('treaty')
      .leftJoinAndSelect('treaty.sections', 'sections')
      .leftJoinAndSelect('treaty.participants', 'participants')
      .orderBy('treaty.created_at', 'DESC');

    this.scopeService.applyTreatyReadScope(query, 'treaty', scope);

    return query.getMany();
  }

  async createTreaty(user: AuthenticatedUser, dto: CreateTreatyDto) {
    this.assertCedantCompany(user);

    if (new Date(dto.effective_from) >= new Date(dto.effective_to)) {
      throw new BadRequestException(
        'Treaty end date must be after the start date',
      );
    }

    const treatyNo = await this.referenceService.next({
      companyId: user.companyId!,
      documentType: 'REINSURANCE_TREATY',
      prefix: `TRT-${new Date().getFullYear()}-`,
    });

    const treaty = this.treatyRepository.create({
      company_id: user.companyId!,
      branch_id: user.activeBranchId ?? null,
      treaty_no: treatyNo,
      treaty_name: dto.treaty_name.trim(),
      treaty_type: dto.treaty_type,
      treaty_form: dto.treaty_form,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to,
      currency: dto.currency.trim().toUpperCase(),
      total_capacity: this.money(dto.total_capacity),
      company_retention: this.money(dto.company_retention),
      aggregate_limit: this.money(dto.aggregate_limit ?? 0),
      minimum_deposit_premium: this.money(dto.minimum_deposit_premium ?? 0),
      reinstatement_count: dto.reinstatement_count ?? 0,
      agreement_reference: dto.agreement_reference?.trim() ?? null,
      agreement_document_url: dto.agreement_document_url?.trim() ?? null,
      created_by: user.id,
      metadata: dto.metadata ?? null,
    });

    const saved = await this.treatyRepository.save(treaty);
    await this.auditService.log({
      userId: user.id,
      companyId: user.companyId!,
      action: 'reinsurance.treaty.create',
      resource: 'reinsurance_treaties',
      resourceId: saved.id,
      metadata: { treaty_no: saved.treaty_no },
    });
    return saved;
  }

  async addTreatySection(
    user: AuthenticatedUser,
    treatyId: string,
    dto: CreateTreatySectionDto,
  ) {
    const treaty = await this.getTreatyForWrite(user, treatyId);

    if (![TreatyStatus.DRAFT, TreatyStatus.REJECTED].includes(treaty.status)) {
      throw new ConflictException(
        'Sections can only be changed while the treaty is in draft',
      );
    }

    return this.sectionRepository.save(
      this.sectionRepository.create({
        company_id: treaty.company_id,
        treaty_id: treaty.id,
        section_no: dto.section_no.trim(),
        section_name: dto.section_name.trim(),
        category_id: dto.category_id ?? null,
        product_id: dto.product_id ?? null,
        sub_class_id: dto.sub_class_id ?? null,
        retention_amount: this.money(dto.retention_amount),
        cession_limit: this.money(dto.cession_limit),
        treaty_limit: this.money(dto.treaty_limit),
        line_count: this.decimal(dto.line_count ?? 0, 4),
        rate_on_line: this.decimal(dto.rate_on_line ?? 0, 10),
        minimum_premium: this.money(dto.minimum_premium ?? 0),
        maximum_premium: this.money(dto.maximum_premium ?? 0),
        ceding_commission_rate: this.decimal(
          dto.ceding_commission_rate ?? 0,
          10,
        ),
        brokerage_rate: this.decimal(dto.brokerage_rate ?? 0, 10),
        profit_commission_rate: this.decimal(
          dto.profit_commission_rate ?? 0,
          10,
        ),
        event_limit: this.money(dto.event_limit ?? 0),
        aggregate_limit: this.money(dto.aggregate_limit ?? 0),
        reinsurance_category: dto.reinsurance_category ?? 1,
        reinsurance_form: dto.reinsurance_form ?? 1,
        reinsurance_type: dto.reinsurance_type ?? 1,
        status: 'ACTIVE',
        metadata: null,
      }),
    );
  }

  async addTreatyParticipant(
    user: AuthenticatedUser,
    treatyId: string,
    dto: CreateTreatyParticipantDto,
  ) {
    const treaty = await this.getTreatyForWrite(user, treatyId);

    if (treaty.status !== TreatyStatus.DRAFT) {
      throw new ConflictException(
        'Participants can only be added to a draft treaty',
      );
    }

    const participantCompany = await this.companyRepository.findOne({
      where: {
        id: dto.participant_company_id,
        company_type: CompanyType.REINSURANCE_COMPANY,
      },
    });

    if (!participantCompany) {
      throw new BadRequestException(
        'Participant must be a registered reinsurance company',
      );
    }

    if (dto.treaty_section_id) {
      const section = await this.sectionRepository.findOne({
        where: { id: dto.treaty_section_id, treaty_id: treaty.id },
      });

      if (!section) {
        throw new BadRequestException(
          'Treaty section does not belong to the treaty',
        );
      }
    }

    await this.assertTreatyShareAvailable({
      treatyId: treaty.id,
      treatySectionId: dto.treaty_section_id ?? null,
      additionalShare: this.percentage(dto.share_percent),
    });

    return this.treatyParticipantRepository.save(
      this.treatyParticipantRepository.create({
        company_id: treaty.company_id,
        treaty_id: treaty.id,
        treaty_section_id: dto.treaty_section_id ?? null,
        participant_company_id: dto.participant_company_id,
        reinsurance_broker_company_id:
          dto.reinsurance_broker_company_id ?? null,
        participant_code: dto.participant_code.trim(),
        re_broker_code: dto.re_broker_code?.trim() ?? null,
        participant_role: dto.participant_role,
        share_percent: this.percentage(dto.share_percent),
        signed_line_percent: this.percentage(
          dto.signed_line_percent ?? dto.share_percent,
        ),
        capacity_amount: this.money(dto.capacity_amount ?? 0),
        brokerage_commission_rate: this.percentage(
          dto.brokerage_commission_rate ?? 0,
        ),
        reinsurance_commission_rate: this.percentage(
          dto.reinsurance_commission_rate ?? 0,
        ),
        participation_date: dto.participation_date
          ? new Date(dto.participation_date)
          : new Date(),
        effective_from: dto.effective_from ?? null,
        effective_to: dto.effective_to ?? null,
        status: TreatyParticipantStatus.INVITED,
        created_by: user.id,
      }),
    );
  }

  async submitTreaty(user: AuthenticatedUser, treatyId: string) {
    const treaty = await this.getTreatyForWrite(user, treatyId);

    if (treaty.status !== TreatyStatus.DRAFT) {
      throw new ConflictException('Only a draft treaty can be submitted');
    }

    const participantCount = await this.treatyParticipantRepository.count({
      where: { treaty_id: treaty.id },
    });

    if (!participantCount) {
      throw new ConflictException(
        'At least one treaty participant is required before submission',
      );
    }

    treaty.status = TreatyStatus.SUBMITTED;
    treaty.submitted_by = user.id;
    treaty.submitted_at = new Date();

    const saved = await this.treatyRepository.save(treaty);
    await this.createWorkflowArtifacts({
      user,
      resourceType: 'reinsurance_treaty',
      resourceId: saved.id,
      title: `Treaty ${saved.treaty_no} awaiting approval`,
      message: `Reinsurance treaty ${saved.treaty_no} has been submitted for approval.`,
      role: 'REINSURANCE_ADMIN',
    });

    return saved;
  }

  async approveTreaty(user: AuthenticatedUser, treatyId: string) {
    const treaty = await this.getTreatyForWrite(user, treatyId);

    if (treaty.status !== TreatyStatus.SUBMITTED) {
      throw new ConflictException('Only a submitted treaty can be approved');
    }

    treaty.status = TreatyStatus.APPROVED;
    treaty.approved_by = user.id;
    treaty.approved_at = new Date();

    return this.treatyRepository.save(treaty);
  }

  async activateTreaty(user: AuthenticatedUser, treatyId: string) {
    const treaty = await this.getTreatyForWrite(user, treatyId);

    await this.assertParticipantSharesComplete(treaty.id);

    if (
      ![TreatyStatus.APPROVED, TreatyStatus.SUSPENDED].includes(treaty.status)
    ) {
      throw new ConflictException(
        'Only an approved or suspended treaty can be activated',
      );
    }

    treaty.status = TreatyStatus.ACTIVE;
    treaty.activated_by = user.id;
    treaty.activated_at = new Date();

    await this.treatyParticipantRepository.update(
      { treaty_id: treaty.id, status: TreatyParticipantStatus.INVITED },
      { status: TreatyParticipantStatus.ACTIVE },
    );

    return this.treatyRepository.save(treaty);
  }

  async createFacultativePlacement(
    user: AuthenticatedUser,
    dto: CreateFacultativePlacementDto,
  ) {
    this.assertCedantCompany(user);

    const policy = await this.getPolicyForWrite(user, dto.policy_id);
    const policyRisk = dto.policy_risk_id
      ? await this.getPolicyRisk(policy.id, dto.policy_risk_id)
      : null;

    const grossSumInsured = policyRisk?.sum_insured ?? policy.sum_insured;
    const grossPremium = policyRisk?.total_premium ?? policy.total_premium;
    const retention = this.money(
      dto.company_retention ??
        policyRisk?.retention_amount ??
        policy.retention_amount,
    );
    const amountToPlace = this.money(
      dto.amount_to_place ??
        Math.max(0, Number(grossSumInsured) - Number(retention)),
    );
    const premiumToPlace = this.money(
      dto.premium_to_place ??
        Math.max(
          0,
          Number(grossPremium) -
            Number(policyRisk?.ceded_premium ?? policy.ceded_premium ?? 0),
        ),
    );

    const placementNo = await this.referenceService.next({
      companyId: user.companyId!,
      documentType: 'FACULTATIVE_PLACEMENT',
      prefix: `FAC-${new Date().getFullYear()}-`,
    });

    return this.placementRepository.save(
      this.placementRepository.create({
        company_id: user.companyId!,
        branch_id: policy.branch_id,
        policy_id: policy.id,
        policy_risk_id: policyRisk?.id ?? null,
        placement_no: placementNo,
        placement_reference: `${policy.policy_no}-${Date.now()}`,
        risk_description: dto.risk_description.trim(),
        gross_sum_insured: this.money(grossSumInsured),
        company_retention: retention,
        amount_to_place: amountToPlace,
        gross_premium: this.money(grossPremium),
        premium_to_place: premiumToPlace,
        currency: policy.currency,
        exchange_rate: '1.000000',
        target_share_percent: '100.0000000000',
        accepted_share_percent: '0.0000000000',
        status: FacultativePlacementStatus.DRAFT,
        submission_deadline: dto.submission_deadline
          ? new Date(dto.submission_deadline)
          : null,
        notes: dto.notes?.trim() ?? null,
        created_by: user.id,
      }),
    );
  }

  async inviteFacultativeOffer(
    user: AuthenticatedUser,
    placementId: string,
    dto: InviteFacultativeOfferDto,
  ) {
    const placement = await this.getPlacementForWrite(user, placementId);

    if (
      ![
        FacultativePlacementStatus.DRAFT,
        FacultativePlacementStatus.MARKETED,
        FacultativePlacementStatus.QUOTED,
      ].includes(placement.status)
    ) {
      throw new ConflictException(
        'This placement can no longer be marketed to new participants',
      );
    }

    const reinsurer = await this.companyRepository.findOne({
      where: {
        id: dto.reinsurer_company_id,
        company_type: CompanyType.REINSURANCE_COMPANY,
      },
    });

    if (!reinsurer) {
      throw new BadRequestException(
        'Selected offer recipient is not a reinsurance company',
      );
    }

    const offeredShare = this.percentage(dto.offered_share_percent);
    const offerNo = await this.referenceService.next({
      companyId: user.companyId!,
      documentType: 'FACULTATIVE_OFFER',
      prefix: `FCO-${new Date().getFullYear()}-`,
    });

    const offer = await this.offerRepository.save(
      this.offerRepository.create({
        company_id: placement.company_id,
        placement_id: placement.id,
        reinsurer_company_id: dto.reinsurer_company_id,
        reinsurance_broker_company_id:
          dto.reinsurance_broker_company_id ?? null,
        offer_no: offerNo,
        participant_code: dto.participant_code?.trim() ?? null,
        re_broker_code: dto.re_broker_code?.trim() ?? null,
        offered_share_percent: offeredShare,
        offered_amount: this.money(
          (Number(placement.amount_to_place) * Number(offeredShare)) / 100,
        ),
        offered_premium: this.money(
          (Number(placement.premium_to_place) * Number(offeredShare)) / 100,
        ),
        quoted_share_percent: '0.0000000000',
        quoted_amount: '0.00',
        quoted_premium: '0.00',
        accepted_share_percent: '0.0000000000',
        accepted_amount: '0.00',
        accepted_premium: '0.00',
        invited_by: user.id,
        status: FacultativeOfferStatus.INVITED,
      }),
    );

    if (placement.status === FacultativePlacementStatus.DRAFT) {
      placement.status = FacultativePlacementStatus.MARKETED;
      await this.placementRepository.save(placement);
    }

    return offer;
  }

  async respondToFacultativeOffer(
    user: AuthenticatedUser,
    offerId: string,
    dto: RespondFacultativeOfferDto,
  ) {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId },
      relations: { placement: true },
    });

    if (!offer) {
      throw new NotFoundException('Facultative offer not found');
    }

    if (offer.reinsurer_company_id !== user.companyId) {
      throw new ForbiddenException(
        'Only the invited reinsurer can respond to this offer',
      );
    }

    if (offer.status !== FacultativeOfferStatus.INVITED) {
      throw new ConflictException('This offer has already been responded to');
    }

    const quotedShare = this.percentage(dto.quoted_share_percent);
    offer.quoted_share_percent = quotedShare;
    offer.quoted_amount = this.money(
      (Number(offer.placement.amount_to_place) * Number(quotedShare)) / 100,
    );
    offer.quoted_premium = this.money(
      dto.quoted_premium ??
        (Number(offer.placement.premium_to_place) * Number(quotedShare)) / 100,
    );
    offer.brokerage_commission_rate = this.percentage(
      dto.brokerage_commission_rate ?? 0,
    );
    offer.reinsurance_commission_rate = this.percentage(
      dto.reinsurance_commission_rate ?? 0,
    );
    offer.terms = dto.terms?.trim() ?? null;
    offer.conditions = dto.conditions?.trim() ?? null;
    offer.exclusions = dto.exclusions?.trim() ?? null;
    offer.status =
      quotedShare === '0.0000000000'
        ? FacultativeOfferStatus.DECLINED
        : FacultativeOfferStatus.QUOTED;
    offer.responded_by = user.id;
    offer.responded_at = new Date();

    const saved = await this.offerRepository.save(offer);

    if (saved.placement.status === FacultativePlacementStatus.MARKETED) {
      saved.placement.status = FacultativePlacementStatus.QUOTED;
      await this.placementRepository.save(saved.placement);
    }

    return saved;
  }

  async acceptFacultativeOffer(
    user: AuthenticatedUser,
    offerId: string,
    dto: AcceptFacultativeOfferDto,
  ) {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId },
      relations: { placement: true },
    });

    if (!offer) {
      throw new NotFoundException('Facultative offer not found');
    }

    await this.assertPlacementWriteAccess(user, offer.placement);

    if (offer.status !== FacultativeOfferStatus.QUOTED) {
      throw new ConflictException('Only a quoted offer can be accepted');
    }

    const acceptedShare = this.percentage(dto.accepted_share_percent);
    offer.accepted_share_percent = acceptedShare;
    offer.accepted_amount = this.money(
      (Number(offer.placement.amount_to_place) * Number(acceptedShare)) / 100,
    );
    offer.accepted_premium = this.money(
      (Number(offer.placement.premium_to_place) * Number(acceptedShare)) / 100,
    );
    offer.status =
      Number(acceptedShare) > 0
        ? FacultativeOfferStatus.ACCEPTED
        : FacultativeOfferStatus.DECLINED;

    const saved = await this.offerRepository.save(offer);

    const totals = await this.offerRepository
      .createQueryBuilder('offer')
      .select('COALESCE(SUM(offer.accepted_share_percent), 0)', 'share')
      .where('offer.placement_id = :placementId', {
        placementId: saved.placement_id,
      })
      .andWhere('offer.status = :status', {
        status: FacultativeOfferStatus.ACCEPTED,
      })
      .getRawOne<{ share: string }>();

    const acceptedTotal = Number(totals?.share ?? 0);
    saved.placement.accepted_share_percent = this.percentage(acceptedTotal);
    saved.placement.status =
      acceptedTotal >= Number(saved.placement.target_share_percent)
        ? FacultativePlacementStatus.FULLY_PLACED
        : FacultativePlacementStatus.PARTIALLY_PLACED;
    await this.placementRepository.save(saved.placement);

    return saved;
  }

  async findCessions(user: AuthenticatedUser) {
    const scope = this.scopeService.resolve(user);
    const query = this.cessionRepository
      .createQueryBuilder('cession')
      .leftJoinAndSelect('cession.policy', 'policy')
      .leftJoinAndSelect('cession.participants', 'participants')
      .orderBy('cession.created_at', 'DESC');

    this.scopeService.applyReinsuranceCessionReadScope(query, 'cession', scope);

    return query.getMany();
  }

  async createPolicyCession(
    user: AuthenticatedUser,
    dto: CreatePolicyCessionDto,
  ) {
    this.assertCedantCompany(user);

    return this.dataSource.transaction(async (manager) => {
      const policy = await this.getPolicyForWrite(user, dto.policy_id, manager);
      const policyRisk = dto.policy_risk_id
        ? await this.getPolicyRisk(policy.id, dto.policy_risk_id, manager)
        : null;

      const cessionParticipants = await this.resolveParticipantsForCession(
        manager,
        dto,
      );

      if (!cessionParticipants.length) {
        throw new ConflictException(
          'No participant capacity is available for this cession',
        );
      }

      const grossSumInsured = Number(
        policyRisk?.sum_insured ?? policy.sum_insured,
      );
      const grossPremium = Number(
        policyRisk?.total_premium ?? policy.total_premium,
      );
      const retentionAmount = Number(
        dto.retention_amount ??
          policyRisk?.retention_amount ??
          policy.retention_amount ??
          0,
      );
      const cededSumInsured = Math.max(0, grossSumInsured - retentionAmount);
      const cededPremium = Math.max(
        0,
        grossPremium *
          (grossSumInsured > 0 ? cededSumInsured / grossSumInsured : 0),
      );

      if (dto.treaty_id) {
        await this.capacityService.assertCapacityAvailable(user, {
          treatyId: dto.treaty_id,
          treatySectionId: dto.treaty_section_id ?? null,
          exposureAmount: cededSumInsured,
          classOfBusiness: policy.product_id,
          territory: null,
        });
      }

      const cessionNo = await this.referenceService.next({
        companyId: user.companyId!,
        documentType: 'POLICY_CESSION',
        prefix: `CES-${new Date().getFullYear()}-`,
        manager,
      });

      const cession = await manager.getRepository(PolicyCession).save(
        manager.getRepository(PolicyCession).create({
          company_id: user.companyId!,
          branch_id: policy.branch_id,
          policy_id: policy.id,
          policy_risk_id: policyRisk?.id ?? null,
          treaty_id: dto.treaty_id ?? null,
          treaty_section_id: dto.treaty_section_id ?? null,
          facultative_placement_id: dto.facultative_placement_id ?? null,
          cession_no: cessionNo,
          cession_type: dto.cession_type,
          effective_from: policy.start_date,
          effective_to: policy.end_date,
          currency: policy.currency,
          exchange_rate: '1.000000',
          gross_sum_insured: this.money(grossSumInsured),
          gross_premium: this.money(grossPremium),
          retention_amount: this.money(retentionAmount),
          retained_premium: this.money(grossPremium - cededPremium),
          ceded_sum_insured: this.money(cededSumInsured),
          ceded_premium: this.money(cededPremium),
          ceded_share_percent: this.percentage(
            grossSumInsured > 0 ? (cededSumInsured / grossSumInsured) * 100 : 0,
          ),
          reinsurance_category: 1,
          authorizing_officer_name:
            dto.authorizing_officer_name?.trim() ??
            user.email ??
            'Portal Officer',
          authorizing_officer_title:
            dto.authorizing_officer_title?.trim() ??
            user.userType ??
            'Underwriter',
          status: ReinsuranceCessionStatus.CALCULATED,
          created_by: user.id,
          metadata: {
            source: dto.cession_type,
          },
        }),
      );

      for (const participant of cessionParticipants) {
        await manager.getRepository(PolicyCessionParticipant).save(
          manager.getRepository(PolicyCessionParticipant).create({
            company_id: cession.company_id,
            cession_id: cession.id,
            participant_company_id: participant.participant_company_id,
            reinsurance_broker_company_id:
              participant.reinsurance_broker_company_id,
            source_treaty_participant_id:
              participant.source_treaty_participant_id,
            source_facultative_offer_id:
              participant.source_facultative_offer_id,
            participant_code: participant.participant_code,
            participant_type: participant.participant_type,
            reinsurance_form: participant.reinsurance_form,
            reinsurance_type: participant.reinsurance_type,
            re_broker_code: participant.re_broker_code,
            brokerage_commission: participant.brokerage_commission,
            reinsurance_commission: participant.reinsurance_commission,
            premium_share: participant.premium_share,
            sum_insured_share: this.money(
              (cededSumInsured * Number(participant.premium_share)) / 100,
            ),
            ceded_premium_share: this.money(
              (cededPremium * Number(participant.premium_share)) / 100,
            ),
            participation_date: new Date(),
            status: 'ACTIVE',
          }),
        );
      }

      return manager.getRepository(PolicyCession).findOneOrFail({
        where: { id: cession.id },
        relations: { participants: true, policy: true },
      });
    });
  }

  async submitCession(user: AuthenticatedUser, cessionId: string) {
    const cession = await this.getCessionForWrite(user, cessionId);

    if (cession.status !== ReinsuranceCessionStatus.CALCULATED) {
      throw new ConflictException('Only a calculated cession can be submitted');
    }

    cession.status = ReinsuranceCessionStatus.SUBMITTED;
    cession.submitted_by = user.id;
    cession.submitted_at = new Date();
    return this.cessionRepository.save(cession);
  }

  async approveCession(user: AuthenticatedUser, cessionId: string) {
    const cession = await this.getCessionForWrite(user, cessionId);

    if (cession.status !== ReinsuranceCessionStatus.SUBMITTED) {
      throw new ConflictException('Only a submitted cession can be approved');
    }

    cession.status = ReinsuranceCessionStatus.APPROVED;
    cession.approved_by = user.id;
    cession.approved_at = new Date();
    return this.cessionRepository.save(cession);
  }

  async applyCession(user: AuthenticatedUser, cessionId: string) {
    const cession = await this.getCessionForWrite(user, cessionId);

    if (cession.status !== ReinsuranceCessionStatus.APPROVED) {
      throw new ConflictException('Only an approved cession can be applied');
    }

    await this.dataSource.transaction(async (manager) => {
      cession.status = ReinsuranceCessionStatus.ACTIVE;
      cession.applied_by = user.id;
      cession.applied_at = new Date();
      await manager.getRepository(PolicyCession).save(cession);

      await manager.getRepository(Policy).update(
        { id: cession.policy_id },
        {
          reinsurance_required: true,
          reinsurance_status: ReinsuranceCessionStatus.ACTIVE,
          retention_amount: cession.retention_amount,
          ceded_sum_insured: cession.ceded_sum_insured,
          ceded_premium: cession.ceded_premium,
        },
      );

      if (cession.policy_risk_id) {
        await manager.getRepository(PolicyRisk).update(
          { id: cession.policy_risk_id },
          {
            reinsurance_required: true,
            reinsurance_status: ReinsuranceCessionStatus.ACTIVE,
            retention_amount: cession.retention_amount,
            ceded_sum_insured: cession.ceded_sum_insured,
            ceded_premium: cession.ceded_premium,
          },
        );
      }
    });

    return this.cessionRepository.findOneOrFail({
      where: { id: cession.id },
      relations: { participants: true, policy: true },
    });
  }

  async createDeclaration(user: AuthenticatedUser, cessionId: string) {
    const cession = await this.getCessionForWrite(user, cessionId);

    if (
      ![
        ReinsuranceCessionStatus.ACTIVE,
        ReinsuranceCessionStatus.DECLARED,
      ].includes(cession.status)
    ) {
      throw new ConflictException(
        'Only an active cession can be turned into a declaration',
      );
    }

    const existing = await this.declarationRepository.findOne({
      where: { cession_id: cession.id },
    });

    if (existing) {
      return existing;
    }

    const participants = await this.cessionParticipantRepository.find({
      where: { cession_id: cession.id },
      order: { created_at: 'ASC' },
    });

    if (!participants.length) {
      throw new ConflictException(
        'This cession does not have any participants',
      );
    }

    const policy = await this.policyRepository.findOne({
      where: { id: cession.policy_id },
    });

    if (!policy?.cover_note_no) {
      throw new ConflictException(
        'The underlying policy does not contain a cover-note reference number',
      );
    }

    const declarationNo = await this.referenceService.next({
      companyId: user.companyId!,
      documentType: 'REINSURANCE_DECLARATION',
      prefix: `RED-${new Date().getFullYear()}-`,
    });

    return this.declarationRepository.save(
      this.declarationRepository.create({
        company_id: cession.company_id,
        branch_id: cession.branch_id,
        policy_id: cession.policy_id,
        cession_id: cession.id,
        declaration_no: declarationNo,
        cover_note_reference_number: policy.cover_note_no,
        premium_including_tax: cession.ceded_premium,
        currency_code: cession.currency,
        exchange_rate: cession.exchange_rate,
        authorizing_officer_name:
          cession.authorizing_officer_name ?? user.email ?? 'Portal Officer',
        authorizing_officer_title:
          cession.authorizing_officer_title ?? user.userType ?? 'Underwriter',
        reinsurance_category: cession.reinsurance_category,
        participants: participants.map((participant) =>
          this.mapDeclarationParticipant(participant),
        ),
        status: ReinsuranceDeclarationStatus.READY,
        created_by: user.id,
        metadata: {
          cession_no: cession.cession_no,
        },
      }),
    );
  }

  async submitDeclarationToTiramis(
    user: AuthenticatedUser,
    declarationId: string,
  ) {
    const declaration = await this.getDeclarationForWrite(user, declarationId);

    if (
      ![
        ReinsuranceDeclarationStatus.READY,
        ReinsuranceDeclarationStatus.FAILED,
        ReinsuranceDeclarationStatus.REJECTED,
      ].includes(declaration.status)
    ) {
      throw new ConflictException(
        'Only a ready or failed declaration can be submitted to TIRAMIS',
      );
    }

    const result = await this.tiramisSubmitService.submitReinsurance({
      id: declaration.id,
      businessReference: declaration.cover_note_reference_number,
      returnExisting: false,
      authContext: user,
    });

    declaration.status = ReinsuranceDeclarationStatus.SUBMITTED;
    declaration.submitted_at = new Date();
    declaration.tiramis_payload =
      result?.submittedPayload ?? declaration.tiramis_payload;

    await this.declarationRepository.save(declaration);

    await this.createWorkflowArtifacts({
      user,
      resourceType: 'reinsurance_declaration',
      resourceId: declaration.id,
      title: `Declaration ${declaration.declaration_no} submitted to TIRAMIS`,
      message: `Reinsurance declaration ${declaration.declaration_no} was submitted to TIRAMIS.`,
      role: 'REINSURANCE_ADMIN',
    });

    return {
      declaration,
      tiramis: result,
    };
  }

  private async resolveParticipantsForCession(
    manager: EntityManager,
    dto: CreatePolicyCessionDto,
  ) {
    if (dto.cession_type === ReinsuranceCessionType.TREATY) {
      if (!dto.treaty_id) {
        throw new BadRequestException(
          'A treaty is required for a treaty cession',
        );
      }

      const treaty = await manager.getRepository(ReinsuranceTreaty).findOne({
        where: { id: dto.treaty_id },
      });

      if (
        !treaty ||
        ![TreatyStatus.ACTIVE, TreatyStatus.APPROVED].includes(treaty.status)
      ) {
        throw new ConflictException('The selected treaty is not active');
      }

      const participantQuery = manager
        .getRepository(ReinsuranceTreatyParticipant)
        .createQueryBuilder('participant')
        .where('participant.treaty_id = :treatyId', {
          treatyId: dto.treaty_id,
        });

      if (dto.treaty_section_id) {
        participantQuery.andWhere(
          'participant.treaty_section_id = :sectionId',
          {
            sectionId: dto.treaty_section_id,
          },
        );
      } else {
        participantQuery.andWhere('participant.treaty_section_id IS NULL');
      }

      const participants = await participantQuery.getMany();

      return participants.map((participant) => ({
        participant_company_id: participant.participant_company_id,
        reinsurance_broker_company_id:
          participant.reinsurance_broker_company_id,
        source_treaty_participant_id: participant.id,
        source_facultative_offer_id: null,
        participant_code: participant.participant_code,
        participant_type: 1,
        reinsurance_form: 1,
        reinsurance_type: 1,
        re_broker_code: participant.re_broker_code,
        brokerage_commission: this.money(participant.brokerage_commission_rate),
        reinsurance_commission: this.money(
          participant.reinsurance_commission_rate,
        ),
        premium_share: participant.share_percent,
      }));
    }

    if (dto.cession_type === ReinsuranceCessionType.FACULTATIVE) {
      if (!dto.facultative_placement_id) {
        throw new BadRequestException(
          'A facultative placement is required for a facultative cession',
        );
      }

      const offers = await manager
        .getRepository(FacultativePlacementOffer)
        .find({
          where: {
            placement_id: dto.facultative_placement_id,
            status: FacultativeOfferStatus.ACCEPTED,
          },
        });

      return offers.map((offer) => ({
        participant_company_id: offer.reinsurer_company_id,
        reinsurance_broker_company_id: offer.reinsurance_broker_company_id,
        source_treaty_participant_id: null,
        source_facultative_offer_id: offer.id,
        participant_code: offer.participant_code ?? `RE-${offer.offer_no}`,
        participant_type: 1,
        reinsurance_form: 1,
        reinsurance_type: 1,
        re_broker_code: offer.re_broker_code,
        brokerage_commission: this.money(offer.brokerage_commission_rate),
        reinsurance_commission: this.money(offer.reinsurance_commission_rate),
        premium_share: offer.accepted_share_percent,
      }));
    }

    const treatyParticipants = dto.treaty_id
      ? await this.resolveParticipantsForCession(manager, {
          ...dto,
          cession_type: ReinsuranceCessionType.TREATY,
        })
      : [];
    const facParticipants = dto.facultative_placement_id
      ? await this.resolveParticipantsForCession(manager, {
          ...dto,
          cession_type: ReinsuranceCessionType.FACULTATIVE,
        })
      : [];

    return [...treatyParticipants, ...facParticipants];
  }

  private async getTreatyForWrite(user: AuthenticatedUser, treatyId: string) {
    const scope = this.scopeService.resolve(user);
    const query = this.treatyRepository
      .createQueryBuilder('treaty')
      .where('treaty.id = :id', { id: treatyId });

    this.scopeService.applyOwnedRecordWriteScope(query, 'treaty', scope);

    const treaty = await query.getOne();

    if (!treaty) {
      throw new NotFoundException('Reinsurance treaty not found');
    }

    return treaty;
  }

  private async getPlacementForWrite(
    user: AuthenticatedUser,
    placementId: string,
  ) {
    const scope = this.scopeService.resolve(user);
    const query = this.placementRepository
      .createQueryBuilder('placement')
      .where('placement.id = :id', { id: placementId });

    this.scopeService.applyOwnedRecordWriteScope(query, 'placement', scope);

    const placement = await query.getOne();

    if (!placement) {
      throw new NotFoundException('Facultative placement not found');
    }

    return placement;
  }

  private async getCessionForWrite(user: AuthenticatedUser, cessionId: string) {
    const scope = this.scopeService.resolve(user);
    const query = this.cessionRepository
      .createQueryBuilder('cession')
      .leftJoinAndSelect('cession.participants', 'participants')
      .where('cession.id = :id', { id: cessionId });

    this.scopeService.applyOwnedRecordWriteScope(query, 'cession', scope);

    const cession = await query.getOne();

    if (!cession) {
      throw new NotFoundException('Policy cession not found');
    }

    return cession;
  }

  private async getDeclarationForWrite(
    user: AuthenticatedUser,
    declarationId: string,
  ) {
    const scope = this.scopeService.resolve(user);
    const query = this.declarationRepository
      .createQueryBuilder('declaration')
      .where('declaration.id = :id', { id: declarationId });

    this.scopeService.applyOwnedRecordWriteScope(query, 'declaration', scope);

    const declaration = await query.getOne();

    if (!declaration) {
      throw new NotFoundException('Reinsurance declaration not found');
    }

    return declaration;
  }

  private async getPolicyForWrite(
    user: AuthenticatedUser,
    policyId: string,
    manager?: EntityManager,
  ) {
    const repository = manager?.getRepository(Policy) ?? this.policyRepository;
    const scope = this.scopeService.resolve(user);
    const query = repository
      .createQueryBuilder('policy')
      .where('policy.id = :policyId', { policyId });

    this.scopeService.applyOwnedRecordWriteScope(query, 'policy', scope);

    const policy = await query.getOne();

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  private async getPolicyRisk(
    policyId: string,
    policyRiskId: string,
    manager?: EntityManager,
  ) {
    const repository =
      manager?.getRepository(PolicyRisk) ?? this.policyRiskRepository;
    const policyRisk = await repository.findOne({
      where: { id: policyRiskId, policy_id: policyId },
    });

    if (!policyRisk) {
      throw new BadRequestException(
        'Selected policy risk does not belong to this policy',
      );
    }

    return policyRisk;
  }

  private async assertTreatyShareAvailable(params: {
    treatyId: string;
    treatySectionId: string | null;
    additionalShare: string;
  }) {
    const query = this.treatyParticipantRepository
      .createQueryBuilder('participant')
      .select('COALESCE(SUM(participant.share_percent), 0)', 'share')
      .where('participant.treaty_id = :treatyId', { treatyId: params.treatyId })
      .andWhere('participant.deleted_at IS NULL');

    if (params.treatySectionId) {
      query.andWhere('participant.treaty_section_id = :sectionId', {
        sectionId: params.treatySectionId,
      });
    } else {
      query.andWhere('participant.treaty_section_id IS NULL');
    }

    const row = await query.getRawOne<{ share: string }>();
    const totalShare = Number(row?.share ?? 0) + Number(params.additionalShare);

    if (totalShare > 100.0000000001) {
      throw new ConflictException('Treaty participation exceeds 100%');
    }
  }

  /**
   * A single treaty participant push is only checked against a 100% ceiling
   * (`assertTreatyShareAvailable`) — nothing ever verified the shares add up
   * to exactly 100% before a treaty goes live. Grouped by section so a
   * sectioned treaty must have every section fully placed, not just the
   * treaty as a whole.
   */
  private async assertParticipantSharesComplete(treatyId: string) {
    const rows = await this.treatyParticipantRepository
      .createQueryBuilder('participant')
      .select('participant.treaty_section_id', 'sectionId')
      .addSelect('COALESCE(SUM(participant.share_percent), 0)', 'share')
      .where('participant.treaty_id = :treatyId', { treatyId })
      .andWhere('participant.deleted_at IS NULL')
      .andWhere('participant.status IN (:...statuses)', {
        statuses: [
          TreatyParticipantStatus.INVITED,
          TreatyParticipantStatus.CONFIRMED,
          TreatyParticipantStatus.ACTIVE,
        ],
      })
      .groupBy('participant.treaty_section_id')
      .getRawMany<{ sectionId: string | null; share: string }>();

    if (!rows.length) {
      throw new BadRequestException(
        'Treaty has no participants — add participants before activation',
      );
    }

    const EPSILON = 0.0001;
    for (const row of rows) {
      const totalShare = Number(row.share ?? 0);
      if (Math.abs(totalShare - 100) > EPSILON) {
        throw new BadRequestException(
          `Treaty participant shares must total 100% before activation${
            row.sectionId ? ` for section ${row.sectionId}` : ''
          } (currently ${totalShare.toFixed(4)}%)`,
        );
      }
    }
  }

  private async assertPlacementWriteAccess(
    user: AuthenticatedUser,
    placement: FacultativePlacement,
  ) {
    const scope = this.scopeService.resolve(user);

    if (placement.company_id !== scope.companyId) {
      throw new ForbiddenException(
        'Only the placement owner can manage this facultative placement',
      );
    }
  }

  private mapDeclarationParticipant(
    participant: PolicyCessionParticipant,
  ): ReinsuranceDeclarationParticipant {
    return {
      participantCode: participant.participant_code,
      participantType: participant.participant_type,
      reinsuranceForm: participant.reinsurance_form,
      reinsuranceType: participant.reinsurance_type,
      reBrokerCode: participant.re_broker_code ?? '',
      brokerageCommission: participant.brokerage_commission,
      reinsuranceCommission: participant.reinsurance_commission,
      premiumShare: participant.premium_share,
      participationDate: participant.participation_date.toISOString(),
    };
  }

  private assertCedantCompany(user: AuthenticatedUser) {
    if (user.companyType !== CompanyType.INSURANCE_COMPANY) {
      throw new ForbiddenException(
        'Only an insurance company can originate cedant reinsurance workflows',
      );
    }
  }

  private async createWorkflowArtifacts(params: {
    user: AuthenticatedUser;
    resourceType: string;
    resourceId: string;
    title: string;
    message: string;
    role: string;
  }) {
    await this.workItemsService.create({
      companyId: params.user.companyId!,
      branchId: params.user.activeBranchId ?? null,
      domain: 'reinsurance',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      title: params.title,
      description: params.message,
      assignedRole: params.role,
      createdBy: params.user.id,
    });

    await this.notificationsService.create({
      companyId: params.user.companyId!,
      branchId: params.user.activeBranchId ?? null,
      recipientRole: params.role,
      type: 'REINSURANCE_WORKFLOW',
      severity: 'INFO',
      title: params.title,
      message: params.message,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: { domain: 'reinsurance' },
    });
  }

  private money(value: string | number) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }

  private percentage(value: string | number) {
    return this.decimal(value ?? 0, 10);
  }

  private decimal(value: string | number, scale: number) {
    return Number(value ?? 0).toFixed(scale);
  }
}
