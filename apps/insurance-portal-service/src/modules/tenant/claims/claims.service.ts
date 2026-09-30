import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  ClaimRegulatoryOperationType,
  ClaimReserveMovementType,
  ClaimsPermissions,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';

import { AuditService } from '../../shared/audit/audit.service';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { BusinessReferenceService } from '../../shared/identifiers/business-reference.service';
import { MoneyUtil } from '../billing-commission/utils/money.util';
import { CoverNote } from '../cover-notes/entities/cover-note.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerType } from '../customers/enums/customer-type.enum';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { NotificationsService } from '../work-items/notifications.service';
import { WorkItemsService } from '../work-items/work-items.service';
import {
  CLAIM_QUEUE_STATUSES,
  CLAIM_STATUS_TRANSITIONS,
  EDITABLE_CLAIM_STATUSES,
  deriveClaimStage,
} from './claim-lifecycle';
import {
  CreateClaimDto,
  CreateClaimantDto,
  UpdateClaimDto,
  UpdateClaimantDto,
} from './dto/create-claim.dto';
import {
  AssignClaimDto,
  CloseClaimDto,
  ReopenClaimDto,
  TiramisSubmitOptionsDto,
} from './dto/claim-workflow.dto';
import {
  FindClaimsQueryDto,
  PolicyLookupQueryDto,
} from './dto/find-claims-query.dto';
import { ClaimApproval } from './entities/claim-approval.entity';
import { ClaimClaimant } from './entities/claim-claimant.entity';
import { ClaimDischargeVoucher } from './entities/claim-discharge-voucher.entity';
import { ClaimEvent } from './entities/claim-event.entity';
import { InsuranceClaim } from './entities/claim.entity';
import { ClaimIntimation } from './entities/claim-intimation.entity';
import { ClaimRegulatoryOperation } from './entities/claim-regulatory-operation.entity';
import { ClaimRejection } from './entities/claim-rejection.entity';
import { ClaimReserve } from './entities/claim-reserve.entity';
import {
  ClaimEventActorType,
  ClaimLiabilityStatus,
  ClaimPriority,
  ClaimRegulatoryStatus,
  ClaimReserveStatus,
  ClaimStatus,
  ClaimantType,
  TiraClaimantCategory,
  TiraPartyType,
} from './enums/claim.enums';
import { ClaimAccessService } from './services/claim-access.service';
import { ClaimCoverageService } from './services/claim-coverage.service';
import { ClaimFinancialProjectionService } from './services/claim-financial-projection.service';
import { ClaimReserveMovementService } from './services/claim-reserve-movement.service';
import { ClaimStateMachineService } from './services/claim-state-machine.service';
import { ClaimTiramisPayloadService } from './services/claim-tiramis-payload.service';
import { ClaimTiramisService } from './services/claim-tiramis.service';

/** Allowed actions surfaced to the UI; the API still enforces each one. */
export type ClaimAction =
  | 'edit'
  | 'delete'
  | 'submit_notification'
  | 'retry_notification'
  | 'create_intimation'
  | 'submit_intimation'
  | 'create_assessment'
  | 'create_discharge'
  | 'create_payment'
  | 'reject'
  | 'close'
  | 'reopen';

/** Regulatory statuses that still block closing a claim. */
const UNFINISHED_REGULATORY_STATUSES = [
  ClaimRegulatoryStatus.QUEUED,
  ClaimRegulatoryStatus.PROCESSING,
  ClaimRegulatoryStatus.ACKNOWLEDGED,
  ClaimRegulatoryStatus.RETRYABLE,
  ClaimRegulatoryStatus.FAILED,
  ClaimRegulatoryStatus.REJECTED,
  ClaimRegulatoryStatus.RECONCILIATION_REQUIRED,
];

@Injectable()
export class ClaimsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(ClaimClaimant)
    private readonly claimantRepository: Repository<ClaimClaimant>,
    @InjectRepository(ClaimEvent)
    private readonly eventRepository: Repository<ClaimEvent>,
    @InjectRepository(ClaimRegulatoryOperation)
    private readonly operationRepository: Repository<ClaimRegulatoryOperation>,
    private readonly scopeService: DataAccessScopeService,
    private readonly access: ClaimAccessService,
    private readonly referenceService: BusinessReferenceService,
    private readonly workItemsService: WorkItemsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly coverageService: ClaimCoverageService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly reserveMovementService: ClaimReserveMovementService,
    private readonly financialProjectionService: ClaimFinancialProjectionService,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly tiramisPayload: ClaimTiramisPayloadService,
    private readonly claimTiramis: ClaimTiramisService,
  ) {}

  // ---------------------------------------------------------------------
  // Policy lookup
  // ---------------------------------------------------------------------

  /**
   * Finds claimable policies by policy/cover-note/TIRA number, customer,
   * vehicle registration or chassis, within the caller's policy scope.
   */
  async policyLookup(user: AuthenticatedUser, query: PolicyLookupQueryDto) {
    const term = query.q.trim();

    if (term.length < 2) {
      throw new BadRequestException('Enter at least 2 characters to search');
    }

    const search = `%${term}%`;
    const scope = this.scopeService.resolve(user);
    const queryBuilder = this.dataSource
      .getRepository(Policy)
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.customer', 'customer')
      .where('policy.deleted_at IS NULL')
      .andWhere(
        new Brackets((match) => {
          match
            .where('policy.policy_no ILIKE :search')
            .orWhere('policy.cover_note_no ILIKE :search')
            .orWhere('policy.policy_reference_number ILIKE :search')
            .orWhere('customer.customer_no ILIKE :search')
            .orWhere('customer.display_name ILIKE :search')
            .orWhere('customer.company_name ILIKE :search')
            .orWhere(
              "CONCAT_WS(' ', customer.first_name, customer.last_name) ILIKE :search",
            )
            .orWhere(
              `EXISTS (
                SELECT 1 FROM policy_risks risk
                JOIN motor_vehicles vehicle ON vehicle.id = risk.motor_vehicle_id
                WHERE risk.policy_id = policy.id
                  AND risk.deleted_at IS NULL
                  AND (vehicle.registration_no ILIKE :search
                    OR vehicle.chassis_no ILIKE :search)
              )`,
            )
            .orWhere(
              `EXISTS (
                SELECT 1 FROM cover_notes note
                WHERE note.policy_id = policy.id
                  AND note.deleted_at IS NULL
                  AND (note.cover_note_reference_number ILIKE :search
                    OR note.cover_note_number ILIKE :search)
              )`,
            );
        }),
      )
      .setParameter('search', search)
      .orderBy('policy.end_date', 'DESC')
      .take(Math.min(query.limit ?? 10, 50));

    this.scopeService.applyPolicyReadScope(queryBuilder, 'policy', scope);

    const policies = await queryBuilder.getMany();

    return policies.map((policy) => this.policySummary(policy));
  }

  /** Everything the claim form shows read-only once a policy is chosen. */
  async policyDetail(user: AuthenticatedUser, policyId: string) {
    const policy = await this.getPolicyInScope(this.dataSource.manager, user, policyId);
    const risks = await this.dataSource
      .getRepository(PolicyRisk)
      .createQueryBuilder('risk')
      .leftJoinAndSelect('risk.risk', 'insuranceRisk')
      .leftJoinAndSelect('risk.motor_vehicle', 'vehicle')
      .leftJoinAndSelect('risk.subject_matter', 'subjectMatter')
      .where('risk.policy_id = :policyId', { policyId })
      .andWhere('risk.deleted_at IS NULL')
      .orderBy('risk.created_at', 'ASC')
      .getMany();
    const coverNotes = await this.dataSource.getRepository(CoverNote).find({
      where: { policy_id: policyId },
      order: { created_at: 'DESC' },
    });
    const openClaims = await this.claimRepository.count({
      where: {
        policy_id: policyId,
        status: In(
          Object.values(ClaimStatus).filter(
            (status) =>
              ![
                ClaimStatus.CLOSED,
                ClaimStatus.CANCELLED,
                ClaimStatus.REJECTED,
                ClaimStatus.SETTLED,
              ].includes(status),
          ),
        ),
      },
    });

    return {
      ...this.policySummary(policy),
      sum_insured: policy.sum_insured,
      total_premium: policy.total_premium,
      business_line: policy.business_line,
      product_id: policy.product_id,
      category_id: policy.category_id,
      branch_id: policy.branch_id,
      intermediary_company_id: policy.intermediary_company_id,
      open_claims: openClaims,
      customer: policy.customer ? this.customerSummary(policy.customer) : null,
      risks: risks.map((risk) => ({
        id: risk.id,
        risk_name: (risk.risk as any)?.name ?? null,
        risk_code: (risk.risk as any)?.code ?? null,
        sum_insured: risk.sum_insured,
        status: risk.status,
        subject_matter: risk.subject_matter
          ? {
              id: risk.subject_matter.id,
              description:
                (risk.subject_matter as any).description ??
                (risk.subject_matter as any).name ??
                null,
            }
          : null,
        vehicle: risk.motor_vehicle
          ? {
              id: risk.motor_vehicle.id,
              registration_no: risk.motor_vehicle.registration_no,
              chassis_no: risk.motor_vehicle.chassis_no,
              make: risk.motor_vehicle.make,
              model: risk.motor_vehicle.model,
              body_type: risk.motor_vehicle.body_type,
              manufacture_year: risk.motor_vehicle.manufacture_year,
              usage_type: risk.motor_vehicle.usage_type,
              vehicle_value: risk.motor_vehicle.vehicle_value,
            }
          : null,
        cover_note_reference_number: this.coverNoteReferenceFor(
          policy,
          risk,
          coverNotes,
        ),
      })),
    };
  }

  // ---------------------------------------------------------------------
  // Draft lifecycle
  // ---------------------------------------------------------------------

  async create(user: AuthenticatedUser, dto: CreateClaimDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const policy = await this.getPolicyInScope(manager, user, dto.policy_id);
      const policyRisk = await this.resolvePolicyRisk(manager, policy, dto.policy_risk_id);
      const coverNoteReference = await this.resolveCoverNoteReference(
        manager,
        policy,
        policyRisk,
      );

      this.validateLossDate(user, policy, dto.loss_date, dto.claim_report_date);

      const coverage = await this.coverageService.evaluate(
        manager,
        policy,
        dto.loss_date,
      );

      if (!coverage.covered) {
        throw new UnprocessableEntityException({
          code: 'CLAIM_COVERAGE_VALIDATION_FAILED',
          message: 'The policy did not cover the loss date',
          details: coverage.blockers,
        });
      }

      const customer = await manager
        .getRepository(Customer)
        .findOneOrFail({ where: { id: policy.customer_id } });
      const claimants = dto.claimants.map((claimant) =>
        this.normaliseClaimant(claimant, customer),
      );
      const duplicateFingerprint = this.duplicateFingerprint(
        policy.id,
        policyRisk?.id ?? null,
        dto,
        claimants,
      );
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
        .andWhere('claim.status <> :cancelled', {
          cancelled: ClaimStatus.CANCELLED,
        })
        .getOne();

      // A duplicate is a review signal, not a hard block: several genuine
      // claims can arise from one incident. Recording one needs a reason.
      if (possibleDuplicate && !dto.duplicate_override_reason?.trim()) {
        throw new ConflictException({
          code: 'CLAIM_POSSIBLE_DUPLICATE',
          message: `This looks like claim ${possibleDuplicate.claim_no}. Provide a reason to record it anyway.`,
          duplicate_of: {
            id: possibleDuplicate.id,
            claim_no: possibleDuplicate.claim_no,
          },
        });
      }

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
      const incidentSnapshot = this.incidentSnapshot(dto);

      const claim = await manager.getRepository(InsuranceClaim).save(
        manager.getRepository(InsuranceClaim).create({
          company_id: policy.insurer_company_id,
          insurer_company_id: policy.insurer_company_id,
          intermediary_company_id: policy.intermediary_company_id,
          reported_by_company_id: user.companyId!,
          branch_id: policy.branch_id,
          reported_branch_id: user.activeBranchId ?? null,
          sale_point_id: user.defaultSalePointId ?? null,
          department_id: dto.department_id ?? policy.department_id ?? null,
          policy_id: policy.id,
          policy_risk_id: policyRisk?.id ?? null,
          policy_version_id: coverage.version!.id,
          policy_version_number: coverage.version!.version_number,
          customer_id: policy.customer_id,
          assigned_user_id: dto.assigned_user_id ?? null,
          reported_by_user_id: user.id,
          created_by: user.id,
          claim_no: claimNo,
          claim_notification_number: notificationNo,
          claim_reference_number: null,
          cover_note_reference_number: coverNoteReference,
          claim_report_date: dto.claim_report_date
            ? new Date(dto.claim_report_date)
            : new Date(),
          ...this.incidentColumns(dto),
          claim_form_dully_filled: dto.claim_form_dully_filled ? 'Y' : 'N',
          currency_code: policy.currency,
          exchange_rate: '1.000000',
          estimated_amount: this.money(dto.estimated_amount),
          status: ClaimStatus.DRAFT,
          claim_stage: deriveClaimStage(ClaimStatus.DRAFT),
          priority: dto.priority ?? ClaimPriority.MEDIUM,
          liability_status: ClaimLiabilityStatus.PENDING,
          metadata: dto.metadata ?? null,
          tiramis_status: 'NOT_SUBMITTED',
          coverage_status: coverage.status,
          policy_snapshot: coverage.version!.policy_snapshot,
          policy_snapshot_hash: coverage.version!.policy_snapshot_hash,
          coverage_snapshot: coverage.coverageSnapshot,
          coverage_snapshot_hash: coverage.coverageSnapshotHash,
          incident_snapshot: incidentSnapshot,
          incident_snapshot_hash: this.hashService.hashDefinition(incidentSnapshot),
          claimant_manifest_hash: this.claimantManifestHash(claimants),
          duplicate_fingerprint: duplicateFingerprint,
          possible_duplicate_of_id: possibleDuplicate?.id ?? null,
          duplicate_override_reason: possibleDuplicate
            ? dto.duplicate_override_reason!.trim()
            : null,
          duplicate_override_by: possibleDuplicate ? user.id : null,
          source_channel: 'INTERNAL',
        }),
      );

      await this.saveClaimants(manager, claim, claimants);

      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'CLAIM_CREATED',
        summary: `Claim ${claim.claim_no} registered against policy ${policy.policy_no}`,
        actorId: user.id,
        newStatus: ClaimStatus.DRAFT,
        metadata: possibleDuplicate
          ? { possible_duplicate_of: possibleDuplicate.claim_no }
          : null,
      });

      return claim;
    });

    await this.createClaimsWorkItem(result, `Submit claim notification ${result.claim_no}`, user.id);
    await this.auditService.log({
      userId: user.id,
      companyId: result.company_id,
      action: 'claim.created',
      resource: 'claim',
      resourceId: result.id,
      afterState: { claim_no: result.claim_no, status: result.status },
      metadata: { policy_id: result.policy_id },
    });

    return this.findOne(user, result.id);
  }

  async update(user: AuthenticatedUser, claimId: string, dto: UpdateClaimDto) {
    await this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);
      this.assertEditable(claim);

      if (dto.policy_id && dto.policy_id !== claim.policy_id) {
        throw new BadRequestException(
          'The policy of a claim cannot be changed; cancel the draft and register a new claim',
        );
      }

      const policy = await manager
        .getRepository(Policy)
        .findOneOrFail({ where: { id: claim.policy_id } });
      const before = this.incidentSnapshot(claim as any);

      if (dto.policy_risk_id !== undefined) {
        const risk = await this.resolvePolicyRisk(manager, policy, dto.policy_risk_id);
        claim.policy_risk_id = risk?.id ?? null;
        claim.cover_note_reference_number = await this.resolveCoverNoteReference(
          manager,
          policy,
          risk,
        );
      }

      if (dto.loss_date || dto.claim_report_date) {
        this.validateLossDate(
          user,
          policy,
          dto.loss_date ?? claim.loss_date.toISOString(),
          dto.claim_report_date ?? claim.claim_report_date.toISOString(),
        );
      }

      if (dto.loss_date) {
        const coverage = await this.coverageService.evaluate(
          manager,
          policy,
          dto.loss_date,
        );

        if (!coverage.covered) {
          throw new UnprocessableEntityException({
            code: 'CLAIM_COVERAGE_VALIDATION_FAILED',
            message: 'The policy did not cover the loss date',
            details: coverage.blockers,
          });
        }

        claim.policy_version_id = coverage.version!.id;
        claim.policy_version_number = coverage.version!.version_number;
        claim.coverage_status = coverage.status;
        claim.coverage_snapshot = coverage.coverageSnapshot;
        claim.coverage_snapshot_hash = coverage.coverageSnapshotHash;
      }

      const merged = { ...this.incidentFromClaim(claim), ...dto };
      Object.assign(claim, this.incidentColumns(merged as CreateClaimDto));

      if (dto.claim_report_date) {
        claim.claim_report_date = new Date(dto.claim_report_date);
      }

      if (dto.claim_form_dully_filled !== undefined) {
        claim.claim_form_dully_filled = dto.claim_form_dully_filled ? 'Y' : 'N';
      }

      if (dto.estimated_amount !== undefined) {
        claim.estimated_amount = this.money(dto.estimated_amount);
      }

      if (dto.priority) claim.priority = dto.priority;
      if (dto.department_id !== undefined) claim.department_id = dto.department_id ?? null;
      if (dto.metadata !== undefined) claim.metadata = dto.metadata ?? null;

      const incidentSnapshot = this.incidentSnapshot(merged as CreateClaimDto);
      claim.incident_snapshot = incidentSnapshot;
      claim.incident_snapshot_hash = this.hashService.hashDefinition(incidentSnapshot);

      await manager.getRepository(InsuranceClaim).save(claim);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'CLAIM_UPDATED',
        summary: 'Claim draft updated',
        actorId: user.id,
      });
      await this.auditService.log(
        {
          userId: user.id,
          companyId: claim.company_id,
          action: 'claim.updated',
          resource: 'claim',
          resourceId: claim.id,
          beforeState: before,
          afterState: incidentSnapshot,
        },
        manager,
      );
    });

    return this.findOne(user, claimId);
  }

  /**
   * Drafts never reported to TIRA may be deleted (soft delete). Anything
   * that reached TIRAMIS is kept for the regulatory record.
   */
  async removeDraft(user: AuthenticatedUser, claimId: string) {
    await this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (claim.status !== ClaimStatus.DRAFT) {
        throw new ConflictException(
          'Only a draft claim that was never submitted to TIRA can be deleted',
        );
      }

      const submitted = await manager
        .getRepository(ClaimRegulatoryOperation)
        .count({ where: { claim_id: claim.id } });

      if (submitted > 0) {
        throw new ConflictException(
          'This claim has TIRAMIS history and cannot be deleted',
        );
      }

      await this.stateMachine.transition(manager, claim, ClaimStatus.CANCELLED, {
        eventType: 'CLAIM_DELETED',
        summary: 'Draft claim deleted',
        actorId: user.id,
      });
      await manager.getRepository(InsuranceClaim).softDelete({ id: claim.id });
      await this.auditService.log(
        {
          userId: user.id,
          companyId: claim.company_id,
          action: 'claim.draft_deleted',
          resource: 'claim',
          resourceId: claim.id,
          beforeState: { claim_no: claim.claim_no, status: ClaimStatus.DRAFT },
        },
        manager,
      );
    });

    return { deleted: true };
  }

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  async findAll(user: AuthenticatedUser, query: FindClaimsQueryDto) {
    const scope = this.scopeService.resolve(user);
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);

    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.customer', 'customer')
      .leftJoinAndSelect('claim.assigned_user', 'assignedUser')
      .leftJoinAndSelect('claim.branch', 'branch')
      .where('claim.deleted_at IS NULL');

    this.scopeService.applyClaimReadScope(queryBuilder, 'claim', scope);

    if (query.branch_id) {
      this.scopeService.assertRequestedBranchAllowed(scope, query.branch_id);
      queryBuilder.andWhere(
        '(claim.branch_id = :branchId OR claim.reported_branch_id = :branchId)',
        { branchId: query.branch_id },
      );
    }

    if (query.queue) {
      queryBuilder.andWhere('claim.status IN (:...queueStatuses)', {
        queueStatuses: CLAIM_QUEUE_STATUSES[query.queue],
      });
    }

    if (query.status) {
      queryBuilder.andWhere('claim.status = :status', { status: query.status });
    }

    if (query.product_id) {
      queryBuilder.andWhere('policy.product_id = :productId', {
        productId: query.product_id,
      });
    }

    if (query.category_id) {
      queryBuilder.andWhere('policy.category_id = :categoryId', {
        categoryId: query.category_id,
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
      queryBuilder.andWhere('claim.created_at >= :from::date', { from: query.from });
    }

    if (query.to) {
      queryBuilder.andWhere("claim.created_at < (:to::date + INTERVAL '1 day')", {
        to: query.to,
      });
    }

    if (query.search?.trim()) {
      queryBuilder.andWhere(
        `(
          claim.claim_no ILIKE :search
          OR claim.claim_notification_number ILIKE :search
          OR claim.claim_reference_number ILIKE :search
          OR claim.cover_note_reference_number ILIKE :search
          OR policy.policy_no ILIKE :search
          OR customer.customer_no ILIKE :search
          OR customer.first_name ILIKE :search
          OR customer.last_name ILIKE :search
          OR customer.company_name ILIKE :search
        )`,
        { search: `%${query.search.trim()}%` },
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

  async findOne(user: AuthenticatedUser, id: string) {
    const scope = this.scopeService.resolve(user);
    const queryBuilder = this.claimRepository
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.customer', 'customer')
      .leftJoinAndSelect('claim.policy_risk', 'policyRisk')
      .leftJoinAndSelect('policyRisk.motor_vehicle', 'vehicle')
      .leftJoinAndSelect('policyRisk.risk', 'insuranceRisk')
      .leftJoinAndSelect('claim.assigned_user', 'assignedUser')
      .leftJoinAndSelect('claim.branch', 'branch')
      .leftJoinAndSelect('claim.claimants', 'claimants', 'claimants.deleted_at IS NULL')
      .leftJoinAndSelect('claim.documents', 'documents', 'documents.deleted_at IS NULL')
      .leftJoinAndSelect('claim.reserves', 'reserves')
      .leftJoinAndSelect('claim.assessments', 'assessments')
      .leftJoinAndSelect('claim.payments', 'payments')
      .where('claim.id = :id', { id })
      .andWhere('claim.deleted_at IS NULL');

    this.scopeService.applyClaimReadScope(queryBuilder, 'claim', scope);

    const claim = await queryBuilder.getOne();

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const manager = this.dataSource.manager;
    const [intimations, dischargeVouchers, rejections, approvals, operations] =
      await Promise.all([
        manager.getRepository(ClaimIntimation).find({
          where: { claim_id: claim.id },
          order: { created_at: 'DESC' },
        }),
        manager.getRepository(ClaimDischargeVoucher).find({
          where: { claim_id: claim.id },
          order: { created_at: 'DESC' },
        }),
        manager.getRepository(ClaimRejection).find({
          where: { claim_id: claim.id },
          order: { created_at: 'DESC' },
        }),
        manager.getRepository(ClaimApproval).find({
          where: { claim_id: claim.id },
          order: { created_at: 'DESC', level: 'ASC' },
        }),
        this.operationRepository.find({
          where: { claim_id: claim.id },
          order: { created_at: 'ASC' },
        }),
      ]);

    claim.assessments?.sort((a, b) => +b.created_at - +a.created_at);
    claim.payments?.sort((a, b) => +b.created_at - +a.created_at);
    claim.reserves?.sort((a, b) => +b.created_at - +a.created_at);

    return {
      ...claim,
      payments: (claim.payments ?? []).map((payment) => ({
        ...payment,
        payee_bank_details: payment.payee_bank_details
          ? this.maskBankDetails(payment.payee_bank_details)
          : null,
      })),
      intimations,
      discharge_vouchers: dischargeVouchers,
      rejections,
      approvals,
      regulatory_operations: operations.map((operation) =>
        this.redactOperation(operation, user),
      ),
      outstanding_amount: this.outstanding(claim),
      allowed_actions: this.allowedActions(claim, user),
      allowed_transitions: CLAIM_STATUS_TRANSITIONS[claim.status],
      user_names: await this.userNames([
        ...approvals.flatMap((row) => [row.submitted_by, row.acted_by]),
        ...(claim.reserves ?? []).flatMap((row) => [
          row.created_by,
          row.approved_by,
          row.rejected_by,
          row.released_by,
        ]),
        ...(claim.assessments ?? []).flatMap((row) => [
          row.created_by,
          row.submitted_by,
          row.approved_by,
          row.rejected_by,
        ]),
        ...intimations.flatMap((row) => [row.created_by, row.submitted_by]),
      ]),
    };
  }

  /** Display names for the users referenced on a claim's records, by id. */
  private async userNames(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];

    if (unique.length === 0) {
      return {};
    }

    const rows: Array<{ id: string; name: string }> =
      await this.dataSource.query(
        `SELECT id,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), email) AS name
           FROM users
          WHERE id = ANY($1::uuid[])`,
        [unique],
      );

    return Object.fromEntries(rows.map((row) => [row.id, row.name]));
  }

  async timeline(user: AuthenticatedUser, claimId: string) {
    const claim = await this.access.getForRead(user, claimId);
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoin('users', 'actor', 'actor.id = event.actor_id')
      .addSelect(
        "NULLIF(TRIM(CONCAT_WS(' ', actor.first_name, actor.last_name)), '')",
        'actor_name',
      )
      .where('event.claim_id = :claimId', { claimId: claim.id })
      .orderBy('event.created_at', 'ASC')
      .getRawAndEntities();

    return events.entities.map((event, index) => ({
      ...event,
      actor_name:
        event.actor_type === ClaimEventActorType.TIRA
          ? 'TIRA'
          : event.actor_type === ClaimEventActorType.SYSTEM
            ? 'System'
            : events.raw[index]?.actor_name ?? null,
    }));
  }

  async tiraTransactions(user: AuthenticatedUser, claimId: string) {
    const claim = await this.access.getForRead(user, claimId);
    const operations = await this.operationRepository.find({
      where: { claim_id: claim.id },
      order: { created_at: 'ASC' },
    });

    return operations.map((operation) => this.redactOperation(operation, user));
  }

  // ---------------------------------------------------------------------
  // Claimants
  // ---------------------------------------------------------------------

  async addClaimant(user: AuthenticatedUser, claimId: string, dto: CreateClaimantDto) {
    return this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);
      await this.assertClaimantsEditable(manager, claim);
      const customer = await manager
        .getRepository(Customer)
        .findOneOrFail({ where: { id: claim.customer_id } });
      const [saved] = await this.saveClaimants(manager, claim, [
        this.normaliseClaimant(dto, customer),
      ], false);

      await this.refreshClaimantManifest(manager, claim);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'CLAIMANT_ADDED',
        summary: `Claimant ${saved.full_name} added`,
        actorId: user.id,
        subjectType: 'CLAIMANT',
        subjectId: saved.id,
      });

      return saved;
    });
  }

  async updateClaimant(user: AuthenticatedUser, claimantId: string, dto: UpdateClaimantDto) {
    return this.dataSource.transaction(async (manager) => {
      const { record: claimant, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimClaimant,
        claimantId,
        'Claimant',
      );
      await this.assertClaimantsEditable(manager, claim);
      const customer = await manager
        .getRepository(Customer)
        .findOneOrFail({ where: { id: claim.customer_id } });
      const normalised = this.normaliseClaimant(
        { ...this.claimantToDto(claimant), ...dto } as CreateClaimantDto,
        customer,
      );

      Object.assign(claimant, normalised);
      const saved = await manager.getRepository(ClaimClaimant).save(claimant);

      if (normalised.is_primary) {
        await this.ensureSinglePrimary(manager, claim.id, saved.id);
      }

      await this.refreshClaimantManifest(manager, claim);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'CLAIMANT_UPDATED',
        summary: `Claimant ${saved.full_name} updated`,
        actorId: user.id,
        subjectType: 'CLAIMANT',
        subjectId: saved.id,
      });

      return saved;
    });
  }

  async removeClaimant(user: AuthenticatedUser, claimantId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { record: claimant, claim } = await this.access.getRecordForWrite(
        manager,
        user,
        ClaimClaimant,
        claimantId,
        'Claimant',
      );
      await this.assertClaimantsEditable(manager, claim);

      const remaining = await manager.getRepository(ClaimClaimant).count({
        where: { claim_id: claim.id, status: 'ACTIVE' },
      });

      if (remaining <= 1) {
        throw new ConflictException('A claim needs at least one claimant');
      }

      claimant.status = 'REMOVED';
      await manager.getRepository(ClaimClaimant).save(claimant);
      await manager.getRepository(ClaimClaimant).softDelete({ id: claimant.id });

      if (claimant.is_primary) {
        await this.ensureSinglePrimary(manager, claim.id, null);
      }

      await this.refreshClaimantManifest(manager, claim);
      await this.stateMachine.recordEvent(manager, claim, {
        eventType: 'CLAIMANT_REMOVED',
        summary: `Claimant ${claimant.full_name} removed`,
        actorId: user.id,
        subjectType: 'CLAIMANT',
        subjectId: claimant.id,
      });

      return { removed: true };
    });
  }

  // ---------------------------------------------------------------------
  // Assignment, notification, closure
  // ---------------------------------------------------------------------

  async assignClaim(user: AuthenticatedUser, claimId: string, dto: AssignClaimDto) {
    const claim = await this.dataSource.transaction(async (manager) => {
      const current = await this.access.getForWrite(user, claimId, manager);
      const assignee = await manager.query(
        `SELECT u.id FROM users u
         JOIN company_users cu ON cu.user_id = u.id
         WHERE u.id = $1 AND cu.company_id = $2
         LIMIT 1`,
        [dto.assigned_user_id, current.company_id],
      );

      if (!assignee.length) {
        throw new BadRequestException('The assignee is not a user of this company');
      }

      const previous = current.assigned_user_id;
      current.assigned_user_id = dto.assigned_user_id;

      if (dto.branch_id) {
        this.scopeService.assertRequestedBranchAllowed(
          this.scopeService.resolve(user),
          dto.branch_id,
        );
        current.branch_id = dto.branch_id;
      }

      await manager.getRepository(InsuranceClaim).update(
        { id: current.id },
        { assigned_user_id: current.assigned_user_id, branch_id: current.branch_id },
      );
      await this.stateMachine.recordEvent(manager, current, {
        eventType: 'CLAIM_ASSIGNED',
        summary: dto.instructions?.trim() || 'Claim officer assigned',
        actorId: user.id,
        metadata: { previous_assignee: previous, assignee: dto.assigned_user_id },
      });

      return current;
    });

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

    return this.findOne(user, claimId);
  }

  async submitNotification(
    user: AuthenticatedUser,
    claimId: string,
    options: TiramisSubmitOptionsDto = {},
  ) {
    const claim = await this.access.getForWrite(user, claimId);

    if (![ClaimStatus.DRAFT, ClaimStatus.NOTIFICATION_FAILED].includes(claim.status)) {
      throw new ConflictException(
        `Claim notification cannot be submitted from ${claim.status}`,
      );
    }

    if (claim.tiramis_reference_locked || claim.claim_reference_number) {
      throw new ConflictException('TIRA has already registered this claim');
    }

    await this.assertMandatoryDocuments(claim, 'NOTIFICATION');

    const officer = await this.claimTiramis.resolveOfficer(user);

    await this.claimRepository.update(
      { id: claim.id },
      { officer_name: officer.name, officer_title: officer.title },
    );

    const result = await this.claimTiramis.submit({
      user,
      claim,
      operationType: ClaimRegulatoryOperationType.NOTIFICATION,
      sourceRecordId: claim.id,
      sourceRecordNumber: claim.claim_notification_number,
      payload: this.tiramisPayload.notification(claim, officer),
      submittedStatus: ClaimStatus.NOTIFICATION_SUBMITTED,
      failedStatus: ClaimStatus.NOTIFICATION_FAILED,
      retry: options.retry || claim.status === ClaimStatus.NOTIFICATION_FAILED,
    });

    return { ...result, claim: await this.findOne(user, claimId) };
  }

  async closeClaim(user: AuthenticatedUser, claimId: string, dto: CloseClaimDto) {
    await this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (![ClaimStatus.SETTLED, ClaimStatus.REJECTED].includes(claim.status)) {
        throw new ConflictException('Only a settled or rejected claim can be closed');
      }

      const unfinished = await manager.getRepository(ClaimRegulatoryOperation).count({
        where: {
          claim_id: claim.id,
          status: In(UNFINISHED_REGULATORY_STATUSES),
        },
      });

      if (unfinished > 0) {
        throw new ConflictException(
          'Every TIRAMIS submission of this claim must be accepted before it can be closed',
        );
      }

      await this.releaseRemainingReserve(manager, user, claim, dto.closure_reason);

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          closed_by: user.id,
          closed_at: new Date(),
          closure_reason: dto.closure_reason.trim(),
        },
      );
      await this.stateMachine.transition(manager, claim, ClaimStatus.CLOSED, {
        eventType: 'CLAIM_CLOSED',
        summary: dto.closure_reason.trim(),
        actorId: user.id,
      });
    });

    return this.findOne(user, claimId);
  }

  async reopenClaim(user: AuthenticatedUser, claimId: string, dto: ReopenClaimDto) {
    await this.dataSource.transaction(async (manager) => {
      const claim = await this.access.getForWrite(user, claimId, manager);

      if (claim.status !== ClaimStatus.CLOSED) {
        throw new ConflictException('Only a closed claim can be reopened');
      }

      await manager.getRepository(InsuranceClaim).update(
        { id: claim.id },
        {
          reopened_at: new Date(),
          reopened_by: user.id,
          reopen_reason: dto.reason.trim(),
          closed_at: null,
          closed_by: null,
        },
      );
      await this.stateMachine.transition(manager, claim, ClaimStatus.REOPENED, {
        eventType: 'CLAIM_REOPENED',
        summary: dto.reason.trim(),
        actorId: user.id,
      });
    });

    return this.findOne(user, claimId);
  }

  // ---------------------------------------------------------------------
  // Shared helpers used by the stage services
  // ---------------------------------------------------------------------

  /** Claimants active on the claim, primary first (TIRA order). */
  activeClaimants(manager: EntityManager, claimId: string) {
    return manager.getRepository(ClaimClaimant).find({
      where: { claim_id: claimId, status: 'ACTIVE' },
      order: { is_primary: 'DESC', created_at: 'ASC' },
    });
  }

  assertClaimantsComplete(claimants: ClaimClaimant[]) {
    const problems: string[] = [];

    if (claimants.length === 0) {
      problems.push('At least one claimant is required');
    }

    for (const claimant of claimants) {
      const missing = [
        !claimant.full_name && 'name',
        !claimant.claimant_category && 'category',
        !claimant.party_type && 'type',
        !claimant.id_type && 'ID type',
        !claimant.identification_number && 'ID number',
        !claimant.country_code && 'country',
        !claimant.district && 'district',
        !claimant.phone && 'phone number',
        claimant.party_type === TiraPartyType.INDIVIDUAL && !claimant.gender && 'gender',
      ].filter(Boolean);

      if (missing.length) {
        problems.push(`${claimant.full_name || 'Claimant'} is missing ${missing.join(', ')}`);
      }
    }

    if (problems.length) {
      throw new UnprocessableEntityException({
        code: 'CLAIMANT_DETAILS_INCOMPLETE',
        message: 'Complete the claimant details required by TIRAMIS',
        details: problems,
      });
    }
  }

  async assertMandatoryDocuments(
    claim: InsuranceClaim,
    stage: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const policy = await manager.getRepository(Policy).findOne({
      where: { id: claim.policy_id },
      select: ['id', 'product_id', 'category_id'],
    });
    const missing: Array<{ document_type: string; title: string }> =
      await manager.query(
        `SELECT requirement.document_type, requirement.title
         FROM claim_document_requirements requirement
         WHERE requirement.company_id = $1
           AND requirement.claim_stage = $2
           AND requirement.is_active = true
           AND requirement.is_mandatory = true
           AND (requirement.product_id IS NULL OR requirement.product_id = $3)
           AND (requirement.insurance_category_id IS NULL
                OR requirement.insurance_category_id = $4)
           AND NOT EXISTS (
             SELECT 1 FROM claim_documents document
             WHERE document.claim_id = $5
               AND document.deleted_at IS NULL
               AND document.document_type = requirement.document_type
               AND document.status IN ('UPLOADED', 'VERIFIED')
           )`,
        [claim.company_id, stage, policy?.product_id ?? null, policy?.category_id ?? null, claim.id],
      );

    if (missing.length) {
      throw new UnprocessableEntityException({
        code: 'CLAIM_DOCUMENTS_MISSING',
        message: 'Upload the mandatory documents for this stage first',
        details: missing.map((item) => item.title),
      });
    }
  }

  private async releaseRemainingReserve(
    manager: EntityManager,
    user: AuthenticatedUser,
    claim: InsuranceClaim,
    reason: string,
  ) {
    const projected = await this.financialProjectionService.recalculate(manager, claim.id);

    if (MoneyUtil.compare(projected.outstanding_reserve, '0.00') <= 0) {
      return;
    }

    const reserve = await manager.getRepository(ClaimReserve).save({
      company_id: claim.company_id,
      claim_id: claim.id,
      reserve_no: await this.referenceService.next({
        companyId: claim.company_id,
        documentType: 'CLAIM_RESERVE',
        prefix: `RSV-${new Date().getFullYear()}-`,
        manager,
      }),
      reserve_type: ClaimReserveMovementType.CLOSURE_ADJUSTMENT,
      amount: MoneyUtil.subtract('0.00', projected.outstanding_reserve),
      currency: claim.currency_code,
      reason: `Closure: ${reason}`,
      status: ClaimReserveStatus.APPROVED,
      effective_at: new Date(),
      created_by: user.id,
      approved_by: user.id,
      approved_at: new Date(),
    });

    await this.reserveMovementService.record(
      manager,
      reserve,
      ClaimReserveMovementType.CLOSURE_ADJUSTMENT,
      reserve.amount,
      reserve.reason,
      `claim-closed:${claim.id}:${claim.state_version}`,
      user.id,
    );
    await this.financialProjectionService.recalculate(manager, claim.id);
  }

  private allowedActions(claim: InsuranceClaim, user: AuthenticatedUser): ClaimAction[] {
    const can = (permission: string) => (user.permissions ?? []).includes(permission);
    const targets = CLAIM_STATUS_TRANSITIONS[claim.status] ?? [];
    const actions: ClaimAction[] = [];

    if (EDITABLE_CLAIM_STATUSES.includes(claim.status) && can(ClaimsPermissions.UPDATE)) {
      actions.push('edit');
    }
    if (claim.status === ClaimStatus.DRAFT && can(ClaimsPermissions.DELETE_DRAFT)) {
      actions.push('delete');
    }
    if (claim.status === ClaimStatus.DRAFT && can(ClaimsPermissions.NOTIFICATION_SUBMIT)) {
      actions.push('submit_notification');
    }
    if (
      claim.status === ClaimStatus.NOTIFICATION_FAILED &&
      can(ClaimsPermissions.NOTIFICATION_SUBMIT)
    ) {
      actions.push('retry_notification');
    }
    if (
      [ClaimStatus.NOTIFICATION_ACCEPTED, ClaimStatus.INTIMATION_FAILED].includes(claim.status) &&
      can(ClaimsPermissions.INTIMATION_CREATE)
    ) {
      actions.push('create_intimation');
    }
    if (
      [ClaimStatus.INTIMATION_PENDING, ClaimStatus.INTIMATION_FAILED].includes(claim.status) &&
      can(ClaimsPermissions.INTIMATION_SUBMIT)
    ) {
      actions.push('submit_intimation');
    }
    if (
      [
        ClaimStatus.INTIMATED,
        ClaimStatus.ASSESSMENT_PENDING,
        ClaimStatus.REASSESSMENT_REQUIRED,
        ClaimStatus.APPROVED,
        ClaimStatus.DISCHARGE_REJECTED,
        ClaimStatus.REOPENED,
      ].includes(claim.status) &&
      can(ClaimsPermissions.ASSESSMENT_CREATE)
    ) {
      actions.push('create_assessment');
    }
    if (
      [ClaimStatus.APPROVED, ClaimStatus.DISCHARGE_REJECTED].includes(claim.status) &&
      can(ClaimsPermissions.DISCHARGE_CREATE)
    ) {
      actions.push('create_discharge');
    }
    if (
      [
        ClaimStatus.DISCHARGE_ACCEPTED,
        ClaimStatus.PAYMENT_PENDING,
        ClaimStatus.PARTIALLY_PAID,
      ].includes(claim.status) &&
      can(ClaimsPermissions.PAYMENT_CREATE)
    ) {
      actions.push('create_payment');
    }
    if (
      targets.includes(ClaimStatus.REJECTION_PENDING) &&
      MoneyUtil.compare(claim.paid_amount, '0.00') === 0 &&
      (can(ClaimsPermissions.REJECTION_CREATE) || can(ClaimsPermissions.REJECT))
    ) {
      actions.push('reject');
    }
    if (targets.includes(ClaimStatus.CLOSED) && can(ClaimsPermissions.CLOSE)) {
      actions.push('close');
    }
    if (targets.includes(ClaimStatus.REOPENED) && can(ClaimsPermissions.REOPEN)) {
      actions.push('reopen');
    }

    return actions;
  }

  private outstanding(claim: InsuranceClaim) {
    return MoneyUtil.compare(claim.approved_amount, claim.paid_amount) > 0
      ? MoneyUtil.subtract(claim.approved_amount, claim.paid_amount)
      : '0.00';
  }

  private redactOperation(operation: ClaimRegulatoryOperation, user: AuthenticatedUser) {
    const canViewPayload = (user.permissions ?? []).includes(
      ClaimsPermissions.TIRAMIS_VIEW_PAYLOAD,
    );

    return {
      ...operation,
      request_snapshot: canViewPayload ? operation.request_snapshot : undefined,
      response_snapshot: canViewPayload ? operation.response_snapshot : undefined,
    };
  }

  private maskBankDetails(details: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(details).map(([key, value]) => {
        const text = String(value ?? '');
        return [
          key,
          /account|iban|number/i.test(key) && text.length > 4
            ? `${'*'.repeat(text.length - 4)}${text.slice(-4)}`
            : value,
        ];
      }),
    );
  }

  private async getPolicyInScope(
    manager: EntityManager,
    user: AuthenticatedUser,
    policyId: string,
  ) {
    const queryBuilder = manager
      .getRepository(Policy)
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.customer', 'customer')
      .where('policy.id = :policyId', { policyId })
      .andWhere('policy.deleted_at IS NULL');

    this.scopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      this.scopeService.resolve(user),
    );

    const policy = await queryBuilder.getOne();

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    if (['VOID', 'DRAFT', 'PENDING'].includes(String(policy.policy_status).toUpperCase())) {
      throw new ConflictException(
        `Claims cannot be notified against a ${String(policy.policy_status).toLowerCase()} policy`,
      );
    }

    return policy;
  }

  private async resolvePolicyRisk(
    manager: EntityManager,
    policy: Policy,
    policyRiskId?: string | null,
  ) {
    const risks = await manager.getRepository(PolicyRisk).find({
      where: { policy_id: policy.id },
      relations: { motor_vehicle: true },
    });

    if (!policyRiskId) {
      if (policy.business_line === 'FLEET' && risks.length > 1) {
        throw new BadRequestException(
          'Select the fleet vehicle involved in the loss',
        );
      }

      return risks.length === 1 ? risks[0] : null;
    }

    const risk = risks.find((item) => item.id === policyRiskId);

    if (!risk) {
      throw new BadRequestException('Selected risk does not belong to this policy');
    }

    return risk;
  }

  /**
   * TIRA issues one cover-note reference per fleet vehicle, so a vehicle
   * claim uses its own cover note; otherwise the policy's.
   */
  private async resolveCoverNoteReference(
    manager: EntityManager,
    policy: Policy,
    risk: PolicyRisk | null,
  ) {
    const coverNotes = await manager.getRepository(CoverNote).find({
      where: { policy_id: policy.id },
      order: { created_at: 'DESC' },
    });
    const reference = this.coverNoteReferenceFor(policy, risk, coverNotes);

    if (!reference) {
      throw new BadRequestException(
        'The policy has no TIRA cover-note reference number; it must be issued through TIRA before a claim can be notified',
      );
    }

    return reference;
  }

  private coverNoteReferenceFor(
    policy: Policy,
    risk: PolicyRisk | null,
    coverNotes: CoverNote[],
  ): string | null {
    const assetId = risk?.motor_vehicle?.insured_asset_id ?? null;

    if (assetId) {
      const vehicleNote = coverNotes.find(
        (note) => note.insured_asset_id === assetId && note.cover_note_reference_number,
      );

      if (vehicleNote) {
        return vehicleNote.cover_note_reference_number;
      }
    }

    return (
      policy.cover_note_no ||
      coverNotes.find((note) => note.cover_note_reference_number)
        ?.cover_note_reference_number ||
      null
    );
  }

  private validateLossDate(
    user: AuthenticatedUser,
    policy: Policy,
    lossDateValue: string,
    reportDateValue?: string,
  ) {
    const lossDate = new Date(lossDateValue);
    const reportDate = reportDateValue ? new Date(reportDateValue) : new Date();

    if (Number.isNaN(lossDate.getTime())) {
      throw new BadRequestException('Loss date is invalid');
    }

    if (lossDate > new Date()) {
      throw new BadRequestException('Loss date cannot be in the future');
    }

    if (reportDate < lossDate) {
      throw new BadRequestException('Report date cannot be before the loss date');
    }

    const startDate = new Date(`${policy.start_date}T00:00:00+03:00`);
    const endDate = new Date(`${policy.end_date}T23:59:59+03:00`);
    const outsideCover = lossDate < startDate || lossDate > endDate;

    if (
      outsideCover &&
      !(user.permissions ?? []).includes(ClaimsPermissions.OVERRIDE_COVER_VALIDATION)
    ) {
      throw new BadRequestException(
        `Loss date falls outside the policy period (${policy.start_date} to ${policy.end_date})`,
      );
    }
  }

  private assertEditable(claim: InsuranceClaim) {
    if (!EDITABLE_CLAIM_STATUSES.includes(claim.status)) {
      throw new ConflictException(
        'Only draft claims or claims whose notification TIRA rejected can be edited',
      );
    }
  }

  /** Claimants are fixed once TIRA has accepted an intimation of the claim. */
  private async assertClaimantsEditable(manager: EntityManager, claim: InsuranceClaim) {
    const reported = await manager.getRepository(ClaimRegulatoryOperation).count({
      where: {
        claim_id: claim.id,
        operation_type: ClaimRegulatoryOperationType.INTIMATION,
        status: In([
          ClaimRegulatoryStatus.ACCEPTED,
          ClaimRegulatoryStatus.QUEUED,
          ClaimRegulatoryStatus.PROCESSING,
          ClaimRegulatoryStatus.ACKNOWLEDGED,
        ]),
      },
    });

    if (reported > 0 || [ClaimStatus.CLOSED, ClaimStatus.CANCELLED].includes(claim.status)) {
      throw new ConflictException(
        'Claimants cannot be changed after the intimation was submitted to TIRA',
      );
    }
  }

  private normaliseClaimant(dto: CreateClaimantDto, customer: Customer): Partial<ClaimClaimant> {
    const isPolicyholder =
      dto.uses_policyholder ||
      [ClaimantType.POLICYHOLDER, ClaimantType.INSURED].includes(dto.claimant_type);

    if (dto.uses_policyholder) {
      const corporate = customer.customer_type === CustomerType.CORPORATE;

      return {
        customer_id: customer.id,
        claimant_type: dto.claimant_type ?? ClaimantType.POLICYHOLDER,
        uses_policyholder: true,
        is_primary: dto.is_primary ?? false,
        full_name: this.customerName(customer),
        claimant_category: TiraClaimantCategory.POLICYHOLDER,
        party_type: corporate ? TiraPartyType.CORPORATE : TiraPartyType.INDIVIDUAL,
        id_type: customer.id_type ?? (corporate ? 7 : null),
        identification_type: customer.id_type ? String(customer.id_type) : null,
        identification_number:
          customer.id_number ??
          (corporate ? customer.incorporation_certificate_no ?? customer.tin : null),
        birth_date: customer.date_of_birth ?? null,
        gender: corporate ? null : (customer.gender ?? null),
        country_code: customer.country_code ?? 'TZA',
        region: customer.region ?? null,
        district: customer.district ?? null,
        street: customer.street ?? null,
        phone: customer.phone ?? null,
        fax: customer.fax ?? null,
        postal_address: customer.postal_address ?? null,
        email: customer.email ?? null,
        amount_claimed: this.money(dto.amount_claimed),
        metadata: dto.metadata ?? null,
      };
    }

    if (!dto.full_name?.trim()) {
      throw new BadRequestException('Claimant name is required');
    }

    return {
      customer_id: dto.customer_id ?? null,
      claimant_type: dto.claimant_type,
      uses_policyholder: false,
      is_primary: dto.is_primary ?? false,
      full_name: dto.full_name.trim(),
      claimant_category:
        dto.claimant_category ??
        (isPolicyholder ? TiraClaimantCategory.POLICYHOLDER : TiraClaimantCategory.THIRD_PARTY),
      party_type: dto.party_type ?? null,
      id_type: dto.id_type ?? null,
      identification_type: dto.id_type ? String(dto.id_type) : null,
      identification_number: dto.identification_number?.trim() || null,
      birth_date: dto.birth_date ? dto.birth_date.slice(0, 10) : null,
      gender: dto.gender ?? null,
      country_code: dto.country_code ?? 'TZA',
      region: dto.region?.trim() || null,
      district: dto.district?.trim() || null,
      street: dto.street?.trim() || null,
      phone: dto.phone?.trim() || null,
      fax: dto.fax?.trim() || null,
      postal_address: dto.postal_address?.trim() || null,
      email: dto.email?.trim() || null,
      amount_claimed: this.money(dto.amount_claimed),
      metadata: dto.metadata ?? null,
    };
  }

  private claimantToDto(claimant: ClaimClaimant): Partial<CreateClaimantDto> {
    return {
      claimant_type: claimant.claimant_type,
      uses_policyholder: claimant.uses_policyholder,
      customer_id: claimant.customer_id ?? undefined,
      is_primary: claimant.is_primary,
      full_name: claimant.full_name,
      claimant_category: claimant.claimant_category ?? undefined,
      party_type: claimant.party_type ?? undefined,
      id_type: claimant.id_type ?? undefined,
      identification_number: claimant.identification_number ?? undefined,
      birth_date: claimant.birth_date ?? undefined,
      gender: (claimant.gender as 'M' | 'F') ?? undefined,
      country_code: claimant.country_code ?? undefined,
      region: claimant.region ?? undefined,
      district: claimant.district ?? undefined,
      street: claimant.street ?? undefined,
      phone: claimant.phone ?? undefined,
      fax: claimant.fax ?? undefined,
      postal_address: claimant.postal_address ?? undefined,
      email: claimant.email ?? undefined,
      amount_claimed: claimant.amount_claimed,
    };
  }

  private async saveClaimants(
    manager: EntityManager,
    claim: InsuranceClaim,
    claimants: Partial<ClaimClaimant>[],
    enforcePrimary = true,
  ) {
    const repository = manager.getRepository(ClaimClaimant);
    const primaries = claimants.filter((claimant) => claimant.is_primary).length;

    if (primaries > 1) {
      throw new BadRequestException('Only one primary claimant is allowed');
    }

    const saved = await repository.save(
      claimants.map((claimant) =>
        repository.create({
          ...claimant,
          company_id: claim.company_id,
          claim_id: claim.id,
          amount_approved: '0.00',
          amount_paid: '0.00',
          status: 'ACTIVE',
        }),
      ),
    );

    if (enforcePrimary && primaries === 0 && saved[0]) {
      saved[0].is_primary = true;
      await repository.save(saved[0]);
    } else if (!enforcePrimary && saved.some((claimant) => claimant.is_primary)) {
      await this.ensureSinglePrimary(manager, claim.id, saved.find((c) => c.is_primary)!.id);
    }

    return saved;
  }

  private async ensureSinglePrimary(manager: EntityManager, claimId: string, primaryId: string | null) {
    const repository = manager.getRepository(ClaimClaimant);
    const active = await repository.find({
      where: { claim_id: claimId, status: 'ACTIVE' },
      order: { created_at: 'ASC' },
    });
    const chosen = primaryId ?? active[0]?.id ?? null;

    for (const claimant of active) {
      const shouldBePrimary = claimant.id === chosen;

      if (claimant.is_primary !== shouldBePrimary) {
        claimant.is_primary = shouldBePrimary;
        await repository.save(claimant);
      }
    }
  }

  private async refreshClaimantManifest(manager: EntityManager, claim: InsuranceClaim) {
    const claimants = await this.activeClaimants(manager, claim.id);

    await manager.getRepository(InsuranceClaim).update(
      { id: claim.id },
      { claimant_manifest_hash: this.claimantManifestHash(claimants) },
    );
  }

  private claimantManifestHash(claimants: Partial<ClaimClaimant>[]) {
    return this.hashService.hashDefinition({
      claimants: claimants.map((claimant) => ({
        fullName: claimant.full_name,
        category: claimant.claimant_category,
        idType: claimant.id_type,
        idNumber: claimant.identification_number,
      })),
    });
  }

  private duplicateFingerprint(
    policyId: string,
    policyRiskId: string | null,
    dto: CreateClaimDto,
    claimants: Partial<ClaimClaimant>[],
  ) {
    return this.hashService.hashDefinition({
      policyId,
      policyRiskId,
      lossDate: new Date(dto.loss_date).toISOString().slice(0, 10),
      lossType: dto.loss_type.trim().toLowerCase(),
      policeReportNumber: dto.police_report_number?.trim().toLowerCase() ?? null,
      claimantNames: claimants
        .map((claimant) => (claimant.full_name ?? '').trim().toLowerCase())
        .sort(),
    });
  }

  private incidentColumns(dto: CreateClaimDto) {
    return {
      claim_title: dto.claim_title?.trim() || null,
      loss_date: new Date(dto.loss_date),
      loss_nature: dto.loss_nature.trim(),
      loss_type: dto.loss_type.trim(),
      loss_location: dto.loss_location.trim(),
      description: dto.description.trim(),
      cause_of_loss: dto.cause_of_loss?.trim() || null,
      police_report_number: dto.police_report_number?.trim() || null,
      notification_source: dto.notification_source ?? null,
      reporter_name: dto.reporter_name?.trim() || null,
      reporter_phone: dto.reporter_phone?.trim() || null,
      reporter_email: dto.reporter_email?.trim() || null,
      incident_details: dto.incident_details ?? null,
      internal_notes: dto.internal_notes?.trim() || null,
    };
  }

  private incidentFromClaim(claim: InsuranceClaim): Partial<CreateClaimDto> {
    return {
      claim_title: claim.claim_title ?? undefined,
      loss_date: claim.loss_date.toISOString(),
      loss_nature: claim.loss_nature,
      loss_type: claim.loss_type,
      loss_location: claim.loss_location,
      description: claim.description,
      cause_of_loss: claim.cause_of_loss ?? undefined,
      police_report_number: claim.police_report_number ?? undefined,
      notification_source: claim.notification_source ?? undefined,
      reporter_name: claim.reporter_name ?? undefined,
      reporter_phone: claim.reporter_phone ?? undefined,
      reporter_email: claim.reporter_email ?? undefined,
      incident_details: claim.incident_details ?? undefined,
      internal_notes: claim.internal_notes ?? undefined,
    };
  }

  private incidentSnapshot(dto: Partial<CreateClaimDto>) {
    return {
      lossDate: dto.loss_date ? new Date(dto.loss_date).toISOString() : null,
      lossNature: dto.loss_nature?.trim() ?? null,
      lossType: dto.loss_type?.trim() ?? null,
      lossLocation: dto.loss_location?.trim() ?? null,
      description: dto.description?.trim() ?? null,
      causeOfLoss: dto.cause_of_loss?.trim() ?? null,
      policeReportNumber: dto.police_report_number?.trim() ?? null,
      incidentDetails: dto.incident_details ?? null,
    };
  }

  private policySummary(policy: Policy) {
    return {
      id: policy.id,
      policy_no: policy.policy_no,
      cover_note_no: policy.cover_note_no,
      policy_reference_number: policy.policy_reference_number,
      policy_status: policy.policy_status,
      start_date: policy.start_date,
      end_date: policy.end_date,
      currency: policy.currency,
      business_line: policy.business_line,
      customer_name: policy.customer ? this.customerName(policy.customer) : null,
    };
  }

  private customerSummary(customer: Customer) {
    return {
      id: customer.id,
      customer_no: customer.customer_no,
      name: this.customerName(customer),
      customer_type: customer.customer_type,
      phone: customer.phone,
      email: customer.email,
      region: customer.region,
      district: customer.district,
    };
  }

  private customerName(customer: Customer) {
    return (
      customer.display_name?.trim() ||
      customer.company_name?.trim() ||
      [customer.first_name, customer.middle_name, customer.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      customer.customer_no
    );
  }

  private money(value?: string | number | null) {
    return MoneyUtil.fromMinor(MoneyUtil.toMinor(value ?? 0));
  }

  private createClaimsWorkItem(claim: InsuranceClaim, title: string, createdBy: string) {
    return this.workItemsService.create({
      companyId: claim.company_id,
      branchId: claim.branch_id,
      domain: 'CLAIMS',
      resourceType: 'claim',
      resourceId: claim.id,
      title,
      priority: claim.priority,
      assignedUserId: claim.assigned_user_id ?? undefined,
      assignedRole: claim.assigned_user_id ? undefined : 'CLAIMS_OFFICER',
      dedupeKey: `claim-review:${claim.id}`,
      createdBy,
    });
  }
}
