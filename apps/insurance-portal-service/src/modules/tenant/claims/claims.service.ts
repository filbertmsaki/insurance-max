import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { ClaimReserveMovementType } from '@insurance-max/contracts';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';
import { TiramisBusinessSubmitService } from '../../tiramis/services/tiramis-business-submit.service';
import { MoneyUtil } from '../billing-commission/utils/money.util';
import { NotificationsService } from '../work-items/notifications.service';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { WorkItemsService } from '../work-items/work-items.service';
import { ClaimCoverageService } from './services/claim-coverage.service';
import { ClaimReserveMovementService } from './services/claim-reserve-movement.service';
import { ClaimFinancialProjectionService } from './services/claim-financial-projection.service';
import { DocumentsService } from '../insurance-documents/documents.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { FindClaimsQueryDto } from './dto/find-claims-query.dto';
import {
  AddClaimDocumentDto,
  AssignClaimDto,
  CloseClaimDto,
  CreateClaimAssessmentDto,
  CreateClaimIntimationDto,
  CreateClaimPaymentDto,
  CreateClaimReserveDto,
  CreateDischargeVoucherDto,
  CreateServiceAssignmentDto,
  RejectClaimDto,
  RespondToDischargeDto,
  VerifyClaimDocumentDto,
} from './dto/claim-workflow.dto';
import {
  ClaimAssessmentStatus,
  ClaimDischargeStatus,
  ClaimDisbursementStatus,
  ClaimDocumentStatus,
  ClaimLiabilityStatus,
  ClaimPriority,
  ClaimPaymentStatus,
  ClaimReserveStatus,
  ClaimServiceAssignmentStatus,
  ClaimStage,
  ClaimStatus,
  DischargeResponse,
} from './enums/claim.enums';
import { ClaimsPermissions } from './claims.permissions';
import { ClaimAssessment } from './entities/claim-assessment.entity';
import { ClaimClaimant } from './entities/claim-claimant.entity';
import { ClaimDischargeVoucher } from './entities/claim-discharge-voucher.entity';
import { ClaimDocument } from './entities/claim-document.entity';
import { InsuranceClaim } from './entities/claim.entity';
import { ClaimIntimation } from './entities/claim-intimation.entity';
import { ClaimPayment } from './entities/claim-payment.entity';
import { ClaimRejection } from './entities/claim-rejection.entity';
import { ClaimReserve } from './entities/claim-reserve.entity';
import { ClaimServiceAssignment } from './entities/claim-service-assignment.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';
import { ClaimDisbursement } from './entities/claim-disbursement.entity';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,

    @InjectRepository(ClaimClaimant)
    private readonly claimantRepository: Repository<ClaimClaimant>,

    @InjectRepository(ClaimDocument)
    private readonly documentRepository: Repository<ClaimDocument>,

    @InjectRepository(ClaimReserve)
    private readonly reserveRepository: Repository<ClaimReserve>,

    @InjectRepository(ClaimIntimation)
    private readonly intimationRepository: Repository<ClaimIntimation>,

    @InjectRepository(ClaimAssessment)
    private readonly assessmentRepository: Repository<ClaimAssessment>,

    @InjectRepository(ClaimServiceAssignment)
    private readonly assignmentRepository: Repository<ClaimServiceAssignment>,

    @InjectRepository(ClaimDischargeVoucher)
    private readonly dischargeRepository: Repository<ClaimDischargeVoucher>,

    @InjectRepository(ClaimPayment)
    private readonly paymentRepository: Repository<ClaimPayment>,

    @InjectRepository(ClaimRejection)
    private readonly rejectionRepository: Repository<ClaimRejection>,

    @InjectRepository(ClaimStatusHistory)
    private readonly statusHistoryRepository: Repository<ClaimStatusHistory>,

    @InjectRepository(ClaimDisbursement)
    private readonly claimDisbursementRepository: Repository<ClaimDisbursement>,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(PolicyRisk)
    private readonly policyRiskRepository: Repository<PolicyRisk>,

    private readonly scopeService: DataAccessScopeService,

    private readonly referenceService: BusinessReferenceService,

    private readonly tiramisSubmitService: TiramisBusinessSubmitService,

    private readonly workItemsService: WorkItemsService,

    private readonly notificationsService: NotificationsService,

    private readonly auditService: AuditService,

    private readonly coverageService: ClaimCoverageService,

    private readonly hashService: ProductDefinitionHashService,

    private readonly reserveMovementService: ClaimReserveMovementService,

    private readonly financialProjectionService: ClaimFinancialProjectionService,

    private readonly documentsService: DocumentsService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateClaimDto,
  ): Promise<InsuranceClaim> {
    const result = await this.dataSource.transaction(async (manager) => {
      const policy = await this.getPolicyForClaim(manager, user, dto.policy_id);

      if (!policy.cover_note_no) {
        throw new BadRequestException(
          'The policy does not contain a cover-note reference number',
        );
      }

      if (dto.policy_risk_id) {
        const policyRisk = await manager.getRepository(PolicyRisk).findOne({
          where: {
            id: dto.policy_risk_id,
            policy_id: policy.id,
          },
        });

        if (!policyRisk) {
          throw new BadRequestException(
            'Selected policy risk does not belong to this policy',
          );
        }
      }

      this.validateLossDate(user, policy, dto.loss_date);

      const coverage = await this.coverageService.evaluate(
        manager,
        policy,
        dto.loss_date,
      );

      if (!coverage.covered) {
        throw new UnprocessableEntityException({
          code: 'CLAIM_COVERAGE_VALIDATION_FAILED',
          details: coverage.blockers,
        });
      }

      // A duplicate is a review signal, never an automatic hard block —
      // legitimate multiple claims can arise from the same incident
      // (§14.5/14.13).
      const duplicateFingerprint = this.hashService.hashDefinition({
        policyId: policy.id,
        policyRiskId: dto.policy_risk_id ?? null,
        lossDate: dto.loss_date,
        lossType: dto.loss_type.trim().toLowerCase(),
        policeReportNumber:
          dto.police_report_number?.trim().toLowerCase() ?? null,
        claimantNames: dto.claimants
          .map((claimant) => claimant.full_name.trim().toLowerCase())
          .sort(),
      });

      const possibleDuplicate = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .where('claim.company_id = :companyId', {
          companyId: policy.insurer_company_id,
        })
        .andWhere('claim.duplicate_fingerprint = :fingerprint', {
          fingerprint: duplicateFingerprint,
        })
        .andWhere('claim.deleted_at IS NULL')
        .getOne();

      const year = new Date().getFullYear();
      const claimNo = await this.referenceService.next({
        companyId: policy.insurer_company_id,
        documentType: 'CLAIM',
        prefix: `CLM-${year}-`,
        manager,
      });
      const notificationNo = await this.referenceService.next({
        companyId: policy.insurer_company_id,
        documentType: 'CLAIM_NOTIFICATION',
        prefix: `CLN-${year}-`,
        manager,
      });

      const incidentSnapshot = {
        lossDate: dto.loss_date,
        lossNature: dto.loss_nature.trim(),
        lossType: dto.loss_type.trim(),
        lossLocation: dto.loss_location.trim(),
        description: dto.description.trim(),
        causeOfLoss: dto.cause_of_loss?.trim() ?? null,
        policeReportNumber: dto.police_report_number?.trim() ?? null,
      };
      const claimantManifest = dto.claimants.map((claimant) => ({
        fullName: claimant.full_name.trim(),
        claimantType: claimant.claimant_type,
        identificationNumber: claimant.identification_number?.trim() ?? null,
      }));

      const claim = manager.getRepository(InsuranceClaim).create({
        company_id: policy.insurer_company_id,
        insurer_company_id: policy.insurer_company_id,
        intermediary_company_id: policy.intermediary_company_id,
        reported_by_company_id: user.companyId!,
        branch_id: policy.branch_id,
        reported_branch_id: user.activeBranchId ?? null,
        sale_point_id: user.defaultSalePointId ?? null,
        policy_id: policy.id,
        policy_risk_id: dto.policy_risk_id ?? null,
        policy_version_id: coverage.version!.id,
        policy_version_number: coverage.version!.version_number,
        customer_id: policy.customer_id,
        assigned_user_id: null,
        reported_by_user_id: user.id,
        created_by: user.id,
        claim_no: claimNo,
        claim_notification_number: notificationNo,
        claim_reference_number: null,
        cover_note_reference_number: policy.cover_note_no,
        claim_report_date: new Date(),
        loss_date: new Date(dto.loss_date),
        loss_nature: dto.loss_nature.trim(),
        loss_type: dto.loss_type.trim(),
        loss_location: dto.loss_location.trim(),
        description: dto.description.trim(),
        cause_of_loss: dto.cause_of_loss?.trim() ?? null,
        police_report_number: dto.police_report_number?.trim() ?? null,
        claim_form_dully_filled: dto.claim_form_dully_filled ? 'Y' : 'N',
        officer_name: null,
        officer_title: null,
        currency_code: policy.currency,
        exchange_rate: '1.000000',
        estimated_amount: MoneyUtil.fromMinor(
          MoneyUtil.toMinor(dto.estimated_amount ?? 0),
        ),
        approved_amount: '0.00',
        paid_amount: '0.00',
        outstanding_reserve: '0.00',
        recovery_expected: '0.00',
        recovery_received: '0.00',
        status: ClaimStatus.NOTIFIED,
        priority: dto.priority ?? ClaimPriority.MEDIUM,
        liability_status: ClaimLiabilityStatus.PENDING,
        fraud_indicator: false,
        litigation_indicator: false,
        metadata: dto.metadata ?? null,
        tiramis_status: 'NOT_SUBMITTED',
        claim_stage: ClaimStage.NOTIFICATION_PENDING,
        coverage_status: coverage.status,
        policy_snapshot: coverage.version!.policy_snapshot,
        policy_snapshot_hash: coverage.version!.policy_snapshot_hash,
        coverage_snapshot: coverage.coverageSnapshot,
        coverage_snapshot_hash: coverage.coverageSnapshotHash,
        incident_snapshot: incidentSnapshot,
        incident_snapshot_hash:
          this.hashService.hashDefinition(incidentSnapshot),
        claimant_manifest_hash: this.hashService.hashDefinition({
          claimants: claimantManifest,
        }),
        duplicate_fingerprint: duplicateFingerprint,
        possible_duplicate_of_id: possibleDuplicate?.id ?? null,
      });

      const savedClaim = await manager
        .getRepository(InsuranceClaim)
        .save(claim);

      let primaryCount = 0;

      for (const claimantDto of dto.claimants) {
        if (claimantDto.is_primary) {
          primaryCount += 1;
        }

        await manager.getRepository(ClaimClaimant).save({
          company_id: savedClaim.company_id,
          claim_id: savedClaim.id,
          customer_id: claimantDto.customer_id ?? null,
          claimant_type: claimantDto.claimant_type,
          is_primary: claimantDto.is_primary ?? false,
          full_name: claimantDto.full_name.trim(),
          identification_type: claimantDto.identification_type?.trim() ?? null,
          identification_number:
            claimantDto.identification_number?.trim() ?? null,
          phone: claimantDto.phone?.trim() ?? null,
          email: claimantDto.email?.trim() ?? null,
          amount_claimed: MoneyUtil.fromMinor(
            MoneyUtil.toMinor(claimantDto.amount_claimed ?? 0),
          ),
          amount_approved: '0.00',
          amount_paid: '0.00',
          status: 'ACTIVE',
          metadata: claimantDto.metadata ?? null,
        });
      }

      if (primaryCount > 1) {
        throw new BadRequestException('Only one primary claimant is allowed');
      }

      if (primaryCount === 0) {
        const first = await manager.getRepository(ClaimClaimant).findOne({
          where: { claim_id: savedClaim.id },
          order: { created_at: 'ASC' },
        });

        if (first) {
          first.is_primary = true;
          await manager.getRepository(ClaimClaimant).save(first);
        }
      }

      await this.addStatusHistory(
        manager,
        savedClaim,
        null,
        ClaimStatus.NOTIFIED,
        'Claim notification created',
        user.id,
      );

      return savedClaim;
    });

    await this.createClaimsWorkItem({
      claim: result,
      title: `Review new claim ${result.claim_no}`,
      priority: result.priority,
      assignedRole: 'CLAIMS_OFFICER',
      dedupeKey: `claim-review:${result.id}`,
      createdBy: user.id,
    });

    await this.auditService.log({
      userId: user.id,
      companyId: result.company_id,
      action: 'claim.created',
      resource: 'claim',
      resourceId: result.id,
      metadata: {
        claim_no: result.claim_no,
        policy_id: result.policy_id,
        reported_by_company_id: result.reported_by_company_id,
      },
    });

    return this.findOne(user, result.id);
  }

  async findAll(user: AuthenticatedUser, query: FindClaimsQueryDto) {
    const scope = this.scopeService.resolve(user);
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);

    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.customer', 'customer')
      .leftJoinAndSelect('claim.assigned_user', 'assignedUser')
      .where('claim.deleted_at IS NULL');

    this.scopeService.applyClaimReadScope(queryBuilder, 'claim', scope);

    if (query.branch_id) {
      this.scopeService.assertRequestedBranchAllowed(scope, query.branch_id);

      queryBuilder.andWhere(
        '(claim.branch_id = :branchId OR claim.reported_branch_id = :branchId)',
        { branchId: query.branch_id },
      );
    }

    if (query.status) {
      queryBuilder.andWhere('claim.status = :status', {
        status: query.status,
      });
    }

    if (query.assigned_user_id) {
      queryBuilder.andWhere('claim.assigned_user_id = :assignedUserId', {
        assignedUserId: query.assigned_user_id,
      });
    }

    if (query.policy_id) {
      queryBuilder.andWhere('claim.policy_id = :policyId', {
        policyId: query.policy_id,
      });
    }

    if (query.from) {
      queryBuilder.andWhere('claim.created_at >= :from::date', {
        from: query.from,
      });
    }

    if (query.to) {
      queryBuilder.andWhere(
        "claim.created_at < (:to::date + INTERVAL '1 day')",
        { to: query.to },
      );
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      queryBuilder.andWhere(
        `(
          claim.claim_no ILIKE :search
          OR claim.claim_notification_number ILIKE :search
          OR claim.claim_reference_number ILIKE :search
          OR policy.policy_no ILIKE :search
          OR customer.customer_no ILIKE :search
          OR customer.first_name ILIKE :search
          OR customer.last_name ILIKE :search
          OR customer.company_name ILIKE :search
        )`,
        { search },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('claim.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<InsuranceClaim> {
    const scope = this.scopeService.resolve(user);

    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.customer', 'customer')
      .leftJoinAndSelect('claim.policy_risk', 'policyRisk')
      .leftJoinAndSelect('claim.assigned_user', 'assignedUser')
      .leftJoinAndSelect('claim.claimants', 'claimants')
      .leftJoinAndSelect('claim.documents', 'documents')
      .leftJoinAndSelect('claim.reserves', 'reserves')
      .leftJoinAndSelect('claim.assessments', 'assessments')
      .leftJoinAndSelect('claim.payments', 'payments')
      .leftJoinAndSelect('claim.status_history', 'statusHistory')
      .where('claim.id = :id', { id })
      .andWhere('claim.deleted_at IS NULL');

    this.scopeService.applyClaimReadScope(queryBuilder, 'claim', scope);

    const claim = await queryBuilder.getOne();

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  async assignClaim(
    user: AuthenticatedUser,
    claimId: string,
    dto: AssignClaimDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);
    claim.assigned_user_id = dto.assigned_user_id;

    if (dto.branch_id) {
      const scope = this.scopeService.resolve(user);
      this.scopeService.assertRequestedBranchAllowed(scope, dto.branch_id);
      claim.branch_id = dto.branch_id;
    }

    if ([ClaimStatus.NOTIFIED, ClaimStatus.INTIMATED].includes(claim.status)) {
      claim.status = ClaimStatus.UNDER_REVIEW;
    }

    const saved = await this.claimRepository.save(claim);

    await this.notificationsService.create({
      companyId: claim.company_id,
      branchId: claim.branch_id,
      recipientUserId: dto.assigned_user_id,
      type: 'CLAIM_ASSIGNED',
      severity: 'HIGH',
      title: `Claim ${claim.claim_no} assigned`,
      message: dto.instructions ?? 'A claim has been assigned to you.',
      resourceType: 'claim',
      resourceId: claim.id,
      actionUrl: `/claims/${claim.id}`,
    });

    return saved;
  }

  async addDocument(
    user: AuthenticatedUser,
    claimId: string,
    dto: AddClaimDocumentDto,
  ) {
    await this.findOne(user, claimId);

    // Storage key is always resolved through the controlled document
    // registry, never accepted verbatim from the client (§14.9).
    const registered = await this.documentsService.register(user, {
      ownerType: 'CLAIM_DOCUMENT',
      ownerId: claimId,
      fileName: dto.file_name.trim(),
      checksum: dto.checksum?.trim() ?? 'UNVERIFIED',
      contentType: dto.mime_type?.trim() ?? null,
      fileSize: dto.file_size ?? null,
    });

    return this.documentRepository.save({
      company_id: user.companyId!,
      claim_id: claimId,
      document_id: registered.id,
      document_type: dto.document_type.trim(),
      requirement_code: dto.requirement_code?.trim() ?? null,
      title: dto.title.trim(),
      storage_key: registered.storage_key,
      file_name: dto.file_name.trim(),
      mime_type: dto.mime_type?.trim() ?? null,
      file_size: dto.file_size !== undefined ? String(dto.file_size) : null,
      checksum: dto.checksum?.trim() ?? null,
      status: ClaimDocumentStatus.UPLOADED,
      uploaded_by: user.id,
      uploaded_at: new Date(),
      verified_by: null,
      verified_at: null,
      rejection_reason: null,
      expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
      metadata: dto.metadata ?? null,
    });
  }

  async verifyDocument(
    user: AuthenticatedUser,
    documentId: string,
    dto: VerifyClaimDocumentDto,
  ) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Claim document not found');
    }

    await this.getClaimForWrite(user, document.claim_id);

    if (dto.decision === 'REJECTED' && !dto.rejection_reason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }

    document.status =
      dto.decision === 'VERIFIED'
        ? ClaimDocumentStatus.VERIFIED
        : ClaimDocumentStatus.REJECTED;
    document.verified_by = user.id;
    document.verified_at = new Date();
    document.rejection_reason = dto.rejection_reason?.trim() ?? null;

    return this.documentRepository.save(document);
  }

  async createIntimation(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimIntimationDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);

    if (
      ![
        ClaimStatus.NOTIFIED,
        ClaimStatus.UNDER_REVIEW,
        ClaimStatus.DOCUMENTS_PENDING,
      ].includes(claim.status)
    ) {
      throw new ConflictException(
        `Claim cannot be intimated from ${claim.status} status`,
      );
    }

    const claimants = await this.buildTiramisClaimants(claim.id);
    const year = new Date().getFullYear();
    const intimationNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_INTIMATION',
      prefix: `INT-${year}-`,
    });
    const reserveAmount = MoneyUtil.fromMinor(
      MoneyUtil.toMinor(dto.claim_reserve_amount),
    );

    const intimation = await this.intimationRepository.save({
      company_id: claim.company_id,
      branch_id: claim.branch_id,
      claim_id: claim.id,
      claim_intimation_number: intimationNo,
      claim_reference_number: claim.claim_reference_number,
      cover_note_reference_number: claim.cover_note_reference_number,
      claim_intimation_date: new Date(),
      currency_code: claim.currency_code,
      exchange_rate: claim.exchange_rate,
      claim_estimated_amount: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.claim_estimated_amount ?? claim.estimated_amount),
      ),
      claim_reserve_amount: reserveAmount,
      claim_reserve_method: dto.claim_reserve_method.trim(),
      loss_assessment_option: dto.loss_assessment_option ?? 1,
      assessor_name: dto.assessor_name?.trim() ?? null,
      assessor_id_number: dto.assessor_id_number?.trim() ?? null,
      assessor_id_type: dto.assessor_id_type ?? 1,
      claimants,
      status: 'CREATED',
      created_by: user.id,
      tiramis_status: 'NOT_SUBMITTED',
    });

    await this.transitionClaim(
      claim,
      ClaimStatus.INTIMATED,
      'Claim intimation created',
      user.id,
    );

    if (MoneyUtil.compare(reserveAmount, '0.00') > 0) {
      await this.createReserve(user, claim.id, {
        reserve_type: 'INITIAL',
        amount: reserveAmount,
        reason: 'Initial reserve created from claim intimation',
      });
    }

    return intimation;
  }

  async createReserve(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimReserveDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);
    const reserveNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_RESERVE',
      prefix: `RSV-${new Date().getFullYear()}-`,
    });

    return this.reserveRepository.save({
      company_id: claim.company_id,
      claim_id: claim.id,
      reserve_no: reserveNo,
      reserve_type: dto.reserve_type.trim(),
      amount: MoneyUtil.fromMinor(MoneyUtil.toMinor(dto.amount)),
      currency: claim.currency_code,
      reason: dto.reason.trim(),
      status: ClaimReserveStatus.DRAFT,
      effective_at: dto.effective_at ? new Date(dto.effective_at) : new Date(),
      created_by: user.id,
      submitted_by: null,
      submitted_at: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      released_by: null,
      released_at: null,
      release_reason: null,
      supersedes_reserve_id: null,
    });
  }

  async submitReserve(user: AuthenticatedUser, reserveId: string) {
    const reserve = await this.reserveRepository.findOne({
      where: {
        id: reserveId,
        company_id: user.companyId!,
      },
    });

    if (!reserve) {
      throw new NotFoundException('Claim reserve not found');
    }

    await this.getClaimForWrite(user, reserve.claim_id);

    if (reserve.status !== ClaimReserveStatus.DRAFT) {
      throw new ConflictException('Only a draft reserve can be submitted');
    }

    reserve.status = ClaimReserveStatus.SUBMITTED;
    reserve.submitted_by = user.id;
    reserve.submitted_at = new Date();

    return this.reserveRepository.save(reserve);
  }

  async approveReserve(user: AuthenticatedUser, reserveId: string) {
    return this.dataSource.transaction(async (manager) => {
      const reserve = await manager
        .getRepository(ClaimReserve)
        .createQueryBuilder('reserve')
        .setLock('pessimistic_write')
        .where('reserve.id = :id', { id: reserveId })
        .andWhere('reserve.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!reserve) {
        throw new NotFoundException('Claim reserve not found');
      }

      if (
        reserve.status !== ClaimReserveStatus.SUBMITTED &&
        reserve.status !== ClaimReserveStatus.DRAFT
      ) {
        throw new ConflictException('Reserve is not available for approval');
      }

      if (reserve.created_by === user.id) {
        throw new ConflictException(
          'The reserve creator cannot approve the same reserve',
        );
      }

      await this.getClaimForWrite(user, reserve.claim_id);

      reserve.status = ClaimReserveStatus.APPROVED;
      reserve.approved_by = user.id;
      reserve.approved_at = new Date();

      await manager.getRepository(ClaimReserve).save(reserve);
      await this.recalculateClaimReserve(manager, reserve.claim_id);

      const claimBeforeMovement = await manager
        .getRepository(InsuranceClaim)
        .findOneOrFail({ where: { id: reserve.claim_id } });
      const movementType: ClaimReserveMovementType =
        MoneyUtil.compare(claimBeforeMovement.gross_case_reserve, '0.00') === 0
          ? ClaimReserveMovementType.INITIAL
          : ClaimReserveMovementType.INCREASE;

      await this.reserveMovementService.record(
        manager,
        reserve,
        movementType,
        reserve.amount,
        reserve.reason,
        `reserve-approved:${reserve.id}`,
        user.id,
      );
      await this.financialProjectionService.recalculate(
        manager,
        reserve.claim_id,
      );

      return reserve;
    });
  }

  async releaseReserve(
    user: AuthenticatedUser,
    reserveId: string,
    reason: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const reserve = await manager
        .getRepository(ClaimReserve)
        .createQueryBuilder('reserve')
        .setLock('pessimistic_write')
        .where('reserve.id = :id', { id: reserveId })
        .andWhere('reserve.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!reserve) {
        throw new NotFoundException('Claim reserve not found');
      }

      if (reserve.status !== ClaimReserveStatus.APPROVED) {
        throw new ConflictException('Only an approved reserve can be released');
      }

      await this.getClaimForWrite(user, reserve.claim_id);

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId: reserve.claim_id })
        .getOneOrFail();

      const remainingReserve = MoneyUtil.subtract(
        claim.gross_case_reserve,
        reserve.amount,
      );

      if (MoneyUtil.compare(remainingReserve, claim.paid_amount) < 0) {
        throw new ConflictException(
          'Reserve cannot be released below the amount already paid on this claim',
        );
      }

      reserve.status = ClaimReserveStatus.RELEASED;
      reserve.released_by = user.id;
      reserve.released_at = new Date();
      reserve.release_reason = reason;

      await manager.getRepository(ClaimReserve).save(reserve);
      await this.recalculateClaimReserve(manager, reserve.claim_id);

      const releaseAmount = MoneyUtil.subtract('0.00', reserve.amount);

      await this.reserveMovementService.record(
        manager,
        reserve,
        ClaimReserveMovementType.RELEASE,
        releaseAmount,
        reason,
        `reserve-released:${reserve.id}`,
        user.id,
      );
      await this.financialProjectionService.recalculate(
        manager,
        reserve.claim_id,
      );

      return reserve;
    });
  }

  async createServiceAssignment(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateServiceAssignmentDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);

    if (!dto.provider_company_id && !dto.assigned_user_id) {
      throw new BadRequestException(
        'Provider company or assigned user is required',
      );
    }

    const assignmentNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_SERVICE_ASSIGNMENT',
      prefix: `CSA-${new Date().getFullYear()}-`,
    });

    const assignment = await this.assignmentRepository.save({
      company_id: claim.company_id,
      claim_id: claim.id,
      provider_company_id: dto.provider_company_id ?? null,
      assigned_user_id: dto.assigned_user_id ?? null,
      service_type: dto.service_type.trim(),
      assignment_no: assignmentNo,
      instructions: dto.instructions?.trim() ?? null,
      assigned_at: new Date(),
      due_at: dto.due_at ? new Date(dto.due_at) : null,
      accepted_at: null,
      declined_at: null,
      decline_reason: null,
      report_submitted_at: null,
      completed_at: null,
      estimated_fee: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.estimated_fee ?? 0),
      ),
      approved_fee: '0.00',
      currency: claim.currency_code,
      status: ClaimServiceAssignmentStatus.ASSIGNED,
      created_by: user.id,
      metadata: null,
    });

    await this.transitionClaim(
      claim,
      ClaimStatus.ASSESSMENT_PENDING,
      'Claim assigned for assessment',
      user.id,
    );

    await this.createClaimsWorkItem({
      claim,
      title: `Complete ${assignment.service_type} for ${claim.claim_no}`,
      priority: claim.priority,
      assignedUserId: assignment.assigned_user_id ?? undefined,
      assignedRole: assignment.assigned_user_id
        ? undefined
        : 'SERVICE_PROVIDER',
      dueAt: assignment.due_at ?? undefined,
      dedupeKey: `claim-assignment:${assignment.id}`,
      createdBy: user.id,
    });

    return assignment;
  }

  async createAssessment(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimAssessmentDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);
    const latestIntimation = await this.intimationRepository.findOne({
      where: { claim_id: claim.id },
      order: { created_at: 'DESC' },
    });
    const assessmentNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_ASSESSMENT',
      prefix: `ASM-${new Date().getFullYear()}-`,
    });
    const claimants = await this.buildTiramisClaimants(claim.id);

    return this.assessmentRepository.save({
      company_id: claim.company_id,
      branch_id: claim.branch_id,
      claim_id: claim.id,
      service_assignment_id: dto.service_assignment_id ?? null,
      claim_assessment_number: assessmentNo,
      claim_intimation_number:
        latestIntimation?.claim_intimation_number ?? null,
      claim_reference_number: claim.claim_reference_number,
      cover_note_reference_number: claim.cover_note_reference_number,
      assessment_received_date: new Date(dto.assessment_received_date),
      assessment_report_summary: dto.assessment_report_summary.trim(),
      currency_code: claim.currency_code,
      exchange_rate: claim.exchange_rate,
      assessment_amount: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.assessment_amount),
      ),
      approved_claim_amount: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.approved_claim_amount),
      ),
      claim_approval_date: null,
      claim_approval_authority: null,
      is_re_assessment: dto.is_re_assessment ? 'Y' : 'N',
      claimants,
      status: ClaimAssessmentStatus.DRAFT,
      created_by: user.id,
      tiramis_status: 'NOT_SUBMITTED',
    });
  }

  async submitAssessment(user: AuthenticatedUser, assessmentId: string) {
    const assessment = await this.getAssessmentForWrite(user, assessmentId);

    if (assessment.status !== ClaimAssessmentStatus.DRAFT) {
      throw new ConflictException('Only a draft assessment can be submitted');
    }

    assessment.status = ClaimAssessmentStatus.SUBMITTED;
    assessment.submitted_by = user.id;
    assessment.submitted_at = new Date();

    return this.assessmentRepository.save(assessment);
  }

  async approveAssessment(user: AuthenticatedUser, assessmentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assessment = await manager
        .getRepository(ClaimAssessment)
        .createQueryBuilder('assessment')
        .setLock('pessimistic_write')
        .where('assessment.id = :assessmentId', { assessmentId })
        .andWhere('assessment.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

      if (!assessment) {
        throw new NotFoundException('Claim assessment not found');
      }

      if (assessment.status !== ClaimAssessmentStatus.SUBMITTED) {
        throw new ConflictException(
          'Only a submitted assessment can be approved',
        );
      }

      if (assessment.created_by === user.id) {
        throw new ConflictException('The assessment creator cannot approve it');
      }

      const claim = await manager
        .getRepository(InsuranceClaim)
        .createQueryBuilder('claim')
        .setLock('pessimistic_write')
        .where('claim.id = :claimId', { claimId: assessment.claim_id })
        .getOneOrFail();

      assessment.status = ClaimAssessmentStatus.APPROVED;
      assessment.approved_by = user.id;
      assessment.approved_at = new Date();
      assessment.claim_approval_date = new Date();
      assessment.claim_approval_authority = user.email;
      claim.approved_amount = assessment.approved_claim_amount;
      claim.liability_status = ClaimLiabilityStatus.ADMITTED;

      await manager.getRepository(ClaimAssessment).save(assessment);

      await this.transitionClaimWithManager(
        manager,
        claim,
        ClaimStatus.APPROVED,
        'Claim assessment approved',
        user.id,
      );

      return assessment;
    });
  }

  async createDischargeVoucher(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateDischargeVoucherDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);

    if (claim.status !== ClaimStatus.APPROVED) {
      throw new ConflictException(
        'Claim must be approved before creating a discharge voucher',
      );
    }

    const outstandingApproved = MoneyUtil.subtract(
      claim.approved_amount,
      claim.paid_amount,
    );
    const offerAmount = MoneyUtil.fromMinor(
      MoneyUtil.toMinor(dto.claim_offer_amount),
    );

    if (MoneyUtil.compare(offerAmount, outstandingApproved) > 0) {
      throw new BadRequestException(
        'Offer amount exceeds the outstanding approved claim amount',
      );
    }

    const latestAssessment = await this.assessmentRepository.findOne({
      where: {
        claim_id: claim.id,
        status: ClaimAssessmentStatus.APPROVED,
      },
      order: { approved_at: 'DESC' },
    });

    const voucherNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_DISCHARGE_VOUCHER',
      prefix: `DV-${new Date().getFullYear()}-`,
    });

    const voucher = await this.dischargeRepository.save({
      company_id: claim.company_id,
      branch_id: claim.branch_id,
      claim_id: claim.id,
      claimant_id: dto.claimant_id ?? null,
      discharge_voucher_number: voucherNo,
      claim_assessment_number:
        latestAssessment?.claim_assessment_number ?? null,
      claim_reference_number: claim.claim_reference_number,
      cover_note_reference_number: claim.cover_note_reference_number,
      discharge_voucher_date: new Date(),
      currency_code: claim.currency_code,
      exchange_rate: claim.exchange_rate,
      claim_offer_communication_date: dto.claim_offer_communication_date
        ? new Date(dto.claim_offer_communication_date)
        : new Date(),
      claim_offer_amount: offerAmount,
      claimant_response_date: null,
      offer_accepted: 'N',
      signed_document_id: null,
      status: ClaimDischargeStatus.DRAFT,
      created_by: user.id,
      submitted_by: null,
      submitted_at: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      tiramis_status: 'NOT_SUBMITTED',
    });

    await this.transitionClaim(
      claim,
      ClaimStatus.DISCHARGE_PENDING,
      'Discharge voucher created',
      user.id,
    );

    return voucher;
  }

  async submitDischargeVoucher(user: AuthenticatedUser, voucherId: string) {
    const voucher = await this.dischargeRepository.findOne({
      where: {
        id: voucherId,
        company_id: user.companyId!,
      },
    });

    if (!voucher) {
      throw new NotFoundException('Discharge voucher not found');
    }

    await this.getClaimForWrite(user, voucher.claim_id);

    if (voucher.status !== ClaimDischargeStatus.DRAFT) {
      throw new ConflictException(
        'Only a draft discharge voucher can be submitted',
      );
    }

    voucher.status = ClaimDischargeStatus.SUBMITTED;
    voucher.submitted_by = user.id;
    voucher.submitted_at = new Date();

    return this.dischargeRepository.save(voucher);
  }

  async approveDischargeVoucher(user: AuthenticatedUser, voucherId: string) {
    const voucher = await this.dischargeRepository.findOne({
      where: {
        id: voucherId,
        company_id: user.companyId!,
      },
    });

    if (!voucher) {
      throw new NotFoundException('Discharge voucher not found');
    }

    await this.getClaimForWrite(user, voucher.claim_id);

    if (voucher.status !== ClaimDischargeStatus.SUBMITTED) {
      throw new ConflictException(
        'Only a submitted discharge voucher can be approved',
      );
    }

    if (voucher.created_by === user.id) {
      throw new ConflictException('The creator cannot approve this record');
    }

    voucher.status = ClaimDischargeStatus.APPROVED;
    voucher.approved_by = user.id;
    voucher.approved_at = new Date();

    return this.dischargeRepository.save(voucher);
  }

  async respondToDischarge(
    user: AuthenticatedUser,
    voucherId: string,
    dto: RespondToDischargeDto,
  ) {
    const voucher = await this.dischargeRepository.findOne({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new NotFoundException('Discharge voucher not found');
    }

    await this.findOne(user, voucher.claim_id);

    if (
      ![
        ClaimDischargeStatus.APPROVED,
        ClaimDischargeStatus.SENT_TO_CLAIMANT,
      ].includes(voucher.status)
    ) {
      throw new ConflictException(
        'Discharge voucher is not awaiting claimant response',
      );
    }

    voucher.claimant_response_date = new Date();
    voucher.signed_document_id = dto.signed_document_id ?? null;

    if (dto.response === DischargeResponse.ACCEPT) {
      voucher.offer_accepted = 'Y';
      voucher.status = ClaimDischargeStatus.ACCEPTED;

      const claim = await this.getClaimForWrite(user, voucher.claim_id);
      await this.transitionClaim(
        claim,
        ClaimStatus.DISCHARGED,
        'Claimant accepted the discharge voucher',
        user.id,
      );
    } else {
      voucher.offer_accepted = 'N';
      voucher.status = ClaimDischargeStatus.REJECTED;
    }

    return this.dischargeRepository.save(voucher);
  }

  async createPayment(
    user: AuthenticatedUser,
    claimId: string,
    dto: CreateClaimPaymentDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);

    if (
      ![
        ClaimStatus.DISCHARGED,
        ClaimStatus.PARTIALLY_PAID,
        ClaimStatus.PAYMENT_PENDING,
      ].includes(claim.status)
    ) {
      throw new ConflictException('Claim is not ready for payment');
    }

    if (dto.discharge_voucher_id) {
      const voucher = await this.dischargeRepository.findOne({
        where: {
          id: dto.discharge_voucher_id,
          claim_id: claim.id,
          status: ClaimDischargeStatus.ACCEPTED,
        },
      });

      if (!voucher) {
        throw new BadRequestException(
          'Accepted discharge voucher was not found',
        );
      }
    }

    const amount = MoneyUtil.fromMinor(MoneyUtil.toMinor(dto.paid_amount));
    const remaining = MoneyUtil.subtract(
      claim.approved_amount,
      claim.paid_amount,
    );

    if (MoneyUtil.compare(amount, remaining) > 0) {
      throw new BadRequestException(
        'Payment exceeds the outstanding approved claim amount',
      );
    }

    const latestIntimation = await this.intimationRepository.findOne({
      where: { claim_id: claim.id },
      order: { created_at: 'DESC' },
    });

    const paymentNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_PAYMENT',
      prefix: `CP-${new Date().getFullYear()}-`,
    });

    const payment = await this.paymentRepository.save({
      company_id: claim.company_id,
      branch_id: claim.branch_id,
      sale_point_id: claim.sale_point_id,
      claim_id: claim.id,
      claimant_id: dto.claimant_id ?? null,
      discharge_voucher_id: dto.discharge_voucher_id ?? null,
      claim_payment_number: paymentNo,
      claim_reference_number: claim.claim_reference_number,
      claim_intimation_number:
        latestIntimation?.claim_intimation_number ?? null,
      cover_note_reference_number: claim.cover_note_reference_number,
      payment_date: null,
      paid_amount: amount,
      payment_mode: dto.payment_mode ?? 1,
      payment_method: dto.payment_method?.trim() ?? null,
      payment_reference: dto.payment_reference?.trim() ?? null,
      parties_notified: 'N',
      net_premium_earned: MoneyUtil.fromMinor(
        MoneyUtil.toMinor(dto.net_premium_earned ?? 0),
      ),
      claim_resulted_litigation: dto.claim_resulted_litigation ? 'Y' : 'N',
      litigation_reason: dto.litigation_reason?.trim() ?? null,
      currency_code: claim.currency_code,
      exchange_rate: claim.exchange_rate,
      status: ClaimPaymentStatus.DRAFT,
      created_by: user.id,
      submitted_by: null,
      submitted_at: null,
      approved_by: null,
      approved_at: null,
      paid_by: null,
      paid_at: null,
      rejection_reason: null,
      tiramis_status: 'NOT_SUBMITTED',
    });

    await this.transitionClaim(
      claim,
      ClaimStatus.PAYMENT_PENDING,
      'Claim payment created',
      user.id,
    );

    return payment;
  }

  async submitPayment(user: AuthenticatedUser, paymentId: string) {
    const payment = await this.getPaymentForWrite(user, paymentId);

    if (payment.status !== ClaimPaymentStatus.DRAFT) {
      throw new ConflictException(
        'Only a draft claim payment can be submitted',
      );
    }

    payment.status = ClaimPaymentStatus.SUBMITTED;
    payment.submitted_by = user.id;
    payment.submitted_at = new Date();

    return this.paymentRepository.save(payment);
  }

  async approvePayment(user: AuthenticatedUser, paymentId: string) {
    const payment = await this.getPaymentForWrite(user, paymentId);

    if (payment.status !== ClaimPaymentStatus.SUBMITTED) {
      throw new ConflictException(
        'Only a submitted claim payment can be approved',
      );
    }

    if (payment.created_by === user.id) {
      throw new ConflictException(
        'The payment creator cannot approve the same payment',
      );
    }

    payment.status = ClaimPaymentStatus.APPROVED;
    payment.approved_by = user.id;
    payment.approved_at = new Date();

    return this.paymentRepository.save(payment);
  }

  async rejectClaim(
    user: AuthenticatedUser,
    claimId: string,
    dto: RejectClaimDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);

    if (MoneyUtil.compare(claim.paid_amount, '0.00') > 0) {
      throw new ConflictException(
        'A claim with completed payments cannot be rejected',
      );
    }

    if (
      [ClaimStatus.PAID, ClaimStatus.CLOSED, ClaimStatus.CANCELLED].includes(
        claim.status,
      )
    ) {
      throw new ConflictException(
        `Claim cannot be rejected from ${claim.status} status`,
      );
    }

    const unreversedDisbursement = await this.claimDisbursementRepository.count(
      {
        where: {
          claim_id: claim.id,
          status: In([
            ClaimDisbursementStatus.REQUESTED,
            ClaimDisbursementStatus.PROCESSING,
            ClaimDisbursementStatus.PAID,
          ]),
        },
      },
    );

    if (unreversedDisbursement > 0) {
      throw new ConflictException(
        'A claim with an unreversed disbursement cannot be rejected',
      );
    }

    const acceptedDischarge = await this.dischargeRepository.count({
      where: {
        claim_id: claim.id,
        status: ClaimDischargeStatus.ACCEPTED,
      },
    });

    if (acceptedDischarge > 0) {
      throw new ConflictException(
        'A claim with an accepted discharge voucher cannot be rejected',
      );
    }

    const rejectionNo = await this.referenceService.next({
      companyId: claim.company_id,
      documentType: 'CLAIM_REJECTION',
      prefix: `CRJ-${new Date().getFullYear()}-`,
    });

    const rejection = await this.rejectionRepository.save({
      company_id: claim.company_id,
      branch_id: claim.branch_id,
      claim_id: claim.id,
      claim_rejection_number: rejectionNo,
      claim_reference_number: claim.claim_reference_number,
      cover_note_reference_number: claim.cover_note_reference_number,
      rejection_date: new Date(),
      rejection_reason: dto.rejection_reason.trim(),
      status: 'APPROVED',
      created_by: user.id,
      approved_by: user.id,
      approved_at: new Date(),
      tiramis_status: 'NOT_SUBMITTED',
    });

    claim.liability_status = ClaimLiabilityStatus.DENIED;

    await this.transitionClaim(
      claim,
      ClaimStatus.REJECTED,
      dto.rejection_reason,
      user.id,
    );

    return rejection;
  }

  async closeClaim(
    user: AuthenticatedUser,
    claimId: string,
    dto: CloseClaimDto,
  ) {
    const claim = await this.getClaimForWrite(user, claimId);

    if (![ClaimStatus.PAID, ClaimStatus.REJECTED].includes(claim.status)) {
      throw new ConflictException(
        'Only a paid or rejected claim can be closed',
      );
    }

    const pendingPayments = await this.paymentRepository.count({
      where: {
        claim_id: claim.id,
        status: ClaimPaymentStatus.APPROVED,
      },
    });

    if (pendingPayments > 0) {
      throw new ConflictException(
        'Claim contains approved payments that are not yet completed',
      );
    }

    claim.closed_by = user.id;
    claim.closed_at = new Date();
    claim.closure_reason = dto.closure_reason.trim();

    await this.transitionClaim(
      claim,
      ClaimStatus.CLOSED,
      dto.closure_reason,
      user.id,
    );

    return claim;
  }

  async submitNotificationToTiramis(user: AuthenticatedUser, claimId: string) {
    const claim = await this.getClaimForWrite(user, claimId);

    return this.tiramisSubmitService.submitClaimNotification({
      id: claim.id,
      businessReference: claim.claim_notification_number,
      authContext: user,
      returnExisting: true,
    });
  }

  async submitIntimationToTiramis(
    user: AuthenticatedUser,
    intimationId: string,
  ) {
    const intimation = await this.intimationRepository.findOne({
      where: {
        id: intimationId,
        company_id: user.companyId!,
      },
    });

    if (!intimation) {
      throw new NotFoundException('Claim intimation not found');
    }

    await this.getClaimForWrite(user, intimation.claim_id);

    return this.tiramisSubmitService.submitClaimIntimation({
      id: intimation.id,
      businessReference: intimation.claim_intimation_number,
      authContext: user,
      returnExisting: true,
    });
  }

  async submitAssessmentToTiramis(
    user: AuthenticatedUser,
    assessmentId: string,
  ) {
    const assessment = await this.getAssessmentForWrite(user, assessmentId);

    if (assessment.status !== ClaimAssessmentStatus.APPROVED) {
      throw new ConflictException(
        'Only an approved assessment can be submitted to TIRAMIS',
      );
    }

    return this.tiramisSubmitService.submitClaimAssessment({
      id: assessment.id,
      businessReference: assessment.claim_assessment_number,
      authContext: user,
      returnExisting: true,
    });
  }

  async submitPaymentToTiramis(user: AuthenticatedUser, paymentId: string) {
    const payment = await this.getPaymentForWrite(user, paymentId);

    if (payment.status !== ClaimPaymentStatus.PAID) {
      throw new ConflictException(
        'Only a completed payment can be submitted to TIRAMIS',
      );
    }

    return this.tiramisSubmitService.submitClaimPayment({
      id: payment.id,
      businessReference: payment.claim_payment_number,
      authContext: user,
      returnExisting: true,
    });
  }

  private async getPolicyForClaim(
    manager: EntityManager,
    user: AuthenticatedUser,
    policyId: string,
  ) {
    const scope = this.scopeService.resolve(user);
    const queryBuilder = manager
      .getRepository(Policy)
      .createQueryBuilder('policy')
      .where('policy.id = :policyId', { policyId })
      .andWhere('policy.deleted_at IS NULL');

    this.scopeService.applyPolicyReadScope(queryBuilder, 'policy', scope);

    const policy = await queryBuilder.getOne();

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    if (policy.policy_status.toUpperCase() === 'VOID') {
      throw new ConflictException(
        'Claims cannot be notified against a void policy',
      );
    }

    return policy;
  }

  private validateLossDate(
    user: AuthenticatedUser,
    policy: Policy,
    lossDateValue: string,
  ): void {
    const lossDate = new Date(lossDateValue);
    const startDate = new Date(`${policy.start_date}T00:00:00Z`);
    const endDate = new Date(`${policy.end_date}T23:59:59Z`);
    const outsideCover = lossDate < startDate || lossDate > endDate;

    if (
      outsideCover &&
      !(user.permissions ?? []).includes(
        ClaimsPermissions.OVERRIDE_COVER_VALIDATION,
      )
    ) {
      throw new BadRequestException(
        'Loss date falls outside the policy coverage period',
      );
    }
  }

  private async getClaimForWrite(user: AuthenticatedUser, claimId: string) {
    const scope = this.scopeService.resolve(user);
    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .where('claim.id = :claimId', { claimId })
      .andWhere('claim.deleted_at IS NULL');

    this.scopeService.applyClaimWriteScope(queryBuilder, 'claim', scope);

    const claim = await queryBuilder.getOne();

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  private async getAssessmentForWrite(
    user: AuthenticatedUser,
    assessmentId: string,
  ) {
    const assessment = await this.assessmentRepository.findOne({
      where: {
        id: assessmentId,
        company_id: user.companyId!,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Claim assessment not found');
    }

    await this.getClaimForWrite(user, assessment.claim_id);

    return assessment;
  }

  private async getPaymentForWrite(user: AuthenticatedUser, paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: {
        id: paymentId,
        company_id: user.companyId!,
      },
    });

    if (!payment) {
      throw new NotFoundException('Claim payment not found');
    }

    await this.getClaimForWrite(user, payment.claim_id);

    return payment;
  }

  private async buildTiramisClaimants(claimId: string) {
    const claimants = await this.claimantRepository.find({
      where: {
        claim_id: claimId,
        status: 'ACTIVE',
      },
      order: {
        is_primary: 'DESC',
        created_at: 'ASC',
      },
    });

    return claimants.map((claimant) => ({
      claimantName: claimant.full_name,
      claimantType: claimant.claimant_type,
      claimantIdType: claimant.identification_type ?? '',
      claimantIdNumber: claimant.identification_number ?? '',
      claimantPhone: claimant.phone ?? '',
      claimantEmail: claimant.email ?? '',
      amountClaimed: claimant.amount_claimed,
      amountApproved: claimant.amount_approved,
      amountPaid: claimant.amount_paid,
    }));
  }

  private async recalculateClaimReserve(
    manager: EntityManager,
    claimId: string,
  ) {
    const reserveAggregate = await manager
      .getRepository(ClaimReserve)
      .createQueryBuilder('reserve')
      .select('COALESCE(SUM(reserve.amount), 0)', 'amount')
      .where('reserve.claim_id = :claimId', { claimId })
      .andWhere('reserve.status = :status', {
        status: ClaimReserveStatus.APPROVED,
      })
      .getRawOne<{ amount: string }>();

    const claim = await manager.getRepository(InsuranceClaim).findOneOrFail({
      where: { id: claimId },
    });

    const approvedReserves = reserveAggregate?.amount ?? '0.00';

    claim.outstanding_reserve =
      MoneyUtil.compare(approvedReserves, claim.paid_amount) >= 0
        ? MoneyUtil.subtract(approvedReserves, claim.paid_amount)
        : '0.00';

    await manager.getRepository(InsuranceClaim).save(claim);
  }

  private async transitionClaim(
    claim: InsuranceClaim,
    nextStatus: ClaimStatus,
    reason: string,
    userId: string,
  ) {
    return this.dataSource.transaction((manager) =>
      this.transitionClaimWithManager(
        manager,
        claim,
        nextStatus,
        reason,
        userId,
      ),
    );
  }

  private async transitionClaimWithManager(
    manager: EntityManager,
    claim: InsuranceClaim,
    nextStatus: ClaimStatus,
    reason: string,
    userId: string,
  ) {
    const oldStatus = claim.status;
    claim.status = nextStatus;

    await manager.getRepository(InsuranceClaim).save(claim);

    await this.addStatusHistory(
      manager,
      claim,
      oldStatus,
      nextStatus,
      reason,
      userId,
    );

    return claim;
  }

  private async addStatusHistory(
    manager: EntityManager,
    claim: InsuranceClaim,
    oldStatus: ClaimStatus | null,
    newStatus: ClaimStatus,
    reason: string,
    userId: string,
  ) {
    await manager.getRepository(ClaimStatusHistory).save({
      claim_id: claim.id,
      old_status: oldStatus,
      new_status: newStatus,
      reason,
      changed_by: userId,
      changed_at: new Date(),
      metadata: null,
    });
  }

  private createClaimsWorkItem(params: {
    claim: InsuranceClaim;
    title: string;
    priority: string;
    assignedUserId?: string;
    assignedRole?: string;
    dueAt?: Date;
    dedupeKey: string;
    createdBy: string;
  }) {
    return this.workItemsService.create({
      companyId: params.claim.company_id,
      branchId: params.claim.branch_id,
      domain: 'CLAIMS',
      resourceType: 'claim',
      resourceId: params.claim.id,
      title: params.title,
      priority: params.priority,
      assignedUserId: params.assignedUserId,
      assignedRole: params.assignedRole,
      dueAt: params.dueAt,
      dedupeKey: params.dedupeKey,
      createdBy: params.createdBy,
    });
  }
}
