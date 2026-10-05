import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  InvoiceSourceType,
  PolicyChangeCategory,
  PolicyTransactionChangeType,
  PolicyTransactionEventType,
  PolicyTransactionPremiumEffect,
  PolicyTransactionType,
  WorkflowApprovalStatus,
  WorkflowPaymentStatus,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';

import { IdentifierGeneratorService } from '../../../shared/identifiers/identifier-generator.service';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionChange } from '../entities/policy-transaction-change.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransactionEligibilityService } from './policy-transaction-eligibility.service';
import { ProposedPolicySnapshotService } from './proposed-policy-snapshot.service';
import { EndorsementRepricingService } from './endorsement-repricing.service';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';
import { EndorsementTypesService } from './endorsement-types.service';
import { PolicyTransactionInvoiceService } from './policy-transaction-invoice.service';
import { PolicyTransactionQuotationFactoryService } from './policy-transaction-quotation-factory.service';
import { FLEET_VEHICLE_ENDORSEMENT_CODES } from '../constants/fleet-vehicle-endorsement.constants';
import { FleetRemovalRefundService } from './fleet-removal-refund.service';
import { NonMotorEndorsementService } from './non-motor-endorsement.service';

export interface CreateEndorsementInput {
  effective_date: string;
  endorsement_type_code: string;
  reason: string;
  idempotency_key: string;
}

export interface RecordEndorsementChangeInput {
  category: PolicyChangeCategory;
  operation: PolicyTransactionChangeType;
  field_path: string;
  resource_id?: string | null;
  old_value?: unknown;
  new_value: unknown;
  is_material?: boolean;
  requires_repricing?: boolean;
  requires_regulatory_submission?: boolean;
}

/** Categories that always force underwriter/senior-approver review (§13.14). */
const APPROVAL_TRIGGER_CATEGORIES: PolicyChangeCategory[] = [
  PolicyChangeCategory.CUSTOMER,
  PolicyChangeCategory.POLICYHOLDER,
  PolicyChangeCategory.ASSET,
  PolicyChangeCategory.COVER_PERIOD,
  PolicyChangeCategory.RISK,
  PolicyChangeCategory.SUM_INSURED,
  PolicyChangeCategory.COVER,
  PolicyChangeCategory.ADDON,
  PolicyChangeCategory.EXCLUSION,
  PolicyChangeCategory.SPECIAL_CONDITION,
];

interface EndorsementFieldRule {
  pattern: RegExp;
  category: PolicyChangeCategory;
  material: boolean;
  repricing: boolean;
  regulatory: boolean;
}

const ENDORSEMENT_FIELD_RULES: EndorsementFieldRule[] = [
  {
    pattern:
      /^policyHolders\.\d+\.(name|birthDate|type|idType|idNumber|gender|countryCode|region|district|street|phone|fax|postalAddress|email)$/,
    category: PolicyChangeCategory.POLICYHOLDER,
    material: true,
    repricing: true,
    regulatory: true,
  },
  {
    pattern: /^cover\.(startDate|endDate)$/,
    category: PolicyChangeCategory.COVER_PERIOD,
    material: true,
    repricing: true,
    regulatory: true,
  },
  {
    pattern:
      /^entries\.\d+\.motor\.(motorCategory|motorType|registrationNumber|chassisNumber|make|model|modelNumber|bodyType|color|engineNumber|engineCapacity|fuelUsed|numberOfAxles|axleDistance|sittingCapacity|yearOfManufacture|tareWeight|grossWeight|motorUsage|ownerName|ownerCategory|ownerAddress)$/,
    category: PolicyChangeCategory.ASSET,
    material: true,
    repricing: true,
    regulatory: true,
  },
  {
    pattern: /^entries\.\d+\.subjectMatters\.\d+\.(reference|description)$/,
    category: PolicyChangeCategory.ASSET,
    material: true,
    repricing: true,
    regulatory: true,
  },
  {
    pattern: /^entries\.\d+\.risks\.\d+\.sumInsured$/,
    category: PolicyChangeCategory.SUM_INSURED,
    material: true,
    repricing: true,
    regulatory: true,
  },
  {
    pattern: /^entries\.\d+\.(coverNoteDescription|operativeClause)$/,
    category: PolicyChangeCategory.COVER,
    material: true,
    repricing: false,
    regulatory: true,
  },
  // Non-Motor risk details (NON_MOTOR policies only; source values come from
  // policy_non_motor_risk_details — see NonMotorEndorsementService). They are
  // not rating factors and TIRAMIS does not carry them.
  {
    pattern: /^nonMotor\.riskData\.[a-z][a-z0-9_]*$/,
    category: PolicyChangeCategory.RISK,
    material: true,
    repricing: false,
    regulatory: false,
  },
  {
    pattern: /^nonMotor\.(riskLocation|limitOfLiability)$/,
    category: PolicyChangeCategory.RISK,
    material: true,
    repricing: false,
    regulatory: false,
  },
];

@Injectable()
export class EndorsementService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyTransactionChange)
    private readonly changeRepository: Repository<PolicyTransactionChange>,
    @InjectRepository(PolicyEndorsement)
    private readonly endorsementRepository: Repository<PolicyEndorsement>,
    private readonly eligibilityService: PolicyTransactionEligibilityService,
    private readonly snapshotService: ProposedPolicySnapshotService,
    private readonly repricingService: EndorsementRepricingService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly endorsementTypesService: EndorsementTypesService,
    private readonly identifierService: IdentifierGeneratorService,
    private readonly hashService: ProductDefinitionHashService,
    private readonly invoiceService: PolicyTransactionInvoiceService,
    private readonly quotationFactory: PolicyTransactionQuotationFactoryService,
    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly fleetRemovalRefund: FleetRemovalRefundService,
    private readonly nonMotorEndorsement: NonMotorEndorsementService,
  ) {}

  async getEligibility(
    user: AuthenticatedUser,
    policyId: string,
    effectiveDate?: string,
  ) {
    const policyQuery = this.policyRepository
      .createQueryBuilder('policy')
      .where('policy.id = :policyId', { policyId });
    this.dataAccessScopeService.applyPolicyReadScope(
      policyQuery,
      'policy',
      this.dataAccessScopeService.resolve(user, 'policy-transactions:read'),
    );
    const policy = await policyQuery.getOne();

    if (!policy) {
      throw new BadRequestException('Policy not found');
    }

    const result = await this.dataSource.transaction((manager) =>
      this.eligibilityService.validate(
        manager,
        policy,
        PolicyTransactionType.ENDORSEMENT,
        effectiveDate,
      ),
    );

    const currentVersion = result.currentVersion;

    return {
      eligible: result.eligible,
      blockers: result.blockers,
      policy: {
        id: policy.id,
        policy_no: policy.policy_no,
        policy_status: policy.policy_status,
        quotation_id: policy.quotation_id,
        start_date: policy.start_date,
        end_date: policy.end_date,
        currency: policy.currency,
        pending_transaction_id: policy.pending_transaction_id,
        cover_note_no: policy.cover_note_no,
        tira_status: policy.tira_status,
      },
      current_version: currentVersion
        ? {
            id: currentVersion.id,
            version_number: currentVersion.version_number,
            version_type: currentVersion.version_type,
            effective_from: currentVersion.effective_from,
            effective_to: currentVersion.effective_to,
            regulatory_reference: currentVersion.regulatory_reference,
            snapshot_schema_version: Number(
              currentVersion.policy_snapshot?.['schemaVersion'] ?? 1,
            ),
          }
        : null,
    };
  }

  async create(
    user: AuthenticatedUser,
    policyId: string,
    dto: CreateEndorsementInput,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const policyQuery = manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', { policyId });
      this.dataAccessScopeService.applyPolicyReadScope(
        policyQuery,
        'policy',
        this.dataAccessScopeService.resolve(user, 'endorsements:create'),
      );
      const policy = await policyQuery.getOne();

      if (!policy) {
        throw new BadRequestException('Policy not found');
      }

      const existing = await manager.getRepository(PolicyTransaction).findOne({
        where: {
          company_id: user.companyId!,
          idempotency_key: dto.idempotency_key,
        },
      });

      if (existing) {
        return existing;
      }

      const eligibility = await this.eligibilityService.validate(
        manager,
        policy,
        PolicyTransactionType.ENDORSEMENT,
        dto.effective_date,
      );

      if (!eligibility.eligible) {
        throw new UnprocessableEntityException({
          code: 'ENDORSEMENT_NOT_ELIGIBLE',
          details: eligibility.blockers,
        });
      }

      const typeConfig = await this.endorsementTypesService.requireActive(
        user.companyId!,
        dto.endorsement_type_code,
      );

      if (
        typeConfig.tira_endorsement_type == null ||
        ![1, 2, 3].includes(Number(typeConfig.tira_endorsement_type))
      ) {
        throw new UnprocessableEntityException({
          code: 'ENDORSEMENT_TYPE_NOT_SUPPORTED_FOR_POLICY_ENDORSEMENT',
          message:
            'Policy endorsements must map to TIRAMIS EndorsementType 1, 2, or 3.',
        });
      }

      if (
        FLEET_VEHICLE_ENDORSEMENT_CODES.includes(typeConfig.code) &&
        !this.isFleetPolicy(policy, eligibility.currentVersion?.policy_snapshot)
      ) {
        throw new UnprocessableEntityException({
          code: 'ENDORSEMENT_TYPE_FLEET_ONLY',
          message: `The "${typeConfig.name}" endorsement type can only be used on a motor fleet policy.`,
        });
      }

      const previousCoverNoteReference =
        eligibility.currentVersion!.regulatory_reference ??
        policy.cover_note_no;

      if (!previousCoverNoteReference) {
        throw new UnprocessableEntityException(
          'The current policy version does not contain a regulatory cover-note reference.',
        );
      }

      const currentSnapshotCoverNotes = Array.isArray(
        (
          eligibility.currentVersion!.policy_snapshot as Record<
            string,
            unknown
          > | null
        )?.['coverNotes'],
      )
        ? (eligibility.currentVersion!.policy_snapshot[
            'coverNotes'
          ] as unknown[])
        : [];
      const previousStickerNumber =
        ((
          currentSnapshotCoverNotes[0] as Record<string, unknown> | undefined
        )?.['stickerNumber'] as string | undefined) ?? null;

      const transactionNo =
        await this.identifierService.generatePolicyTransactionNumber(
          PolicyTransactionType.ENDORSEMENT,
          user.companyId!,
          manager,
        );

      const transaction = await manager.getRepository(PolicyTransaction).save({
        company_id: user.companyId!,
        transaction_no: transactionNo,
        transaction_type: PolicyTransactionType.ENDORSEMENT,
        source_policy_id: policy.id,
        source_policy_version_id: eligibility.currentVersion!.id,
        source_policy_version_no: eligibility.currentVersion!.version_number,
        source_policy_snapshot: eligibility.currentVersion!.policy_snapshot,
        source_policy_snapshot_hash:
          eligibility.currentVersion!.policy_snapshot_hash,
        effective_date: dto.effective_date,
        reason: dto.reason.trim(),
        requested_by: user.id,
        currency_code: policy.currency,
        idempotency_key: dto.idempotency_key,
      });

      await manager.getRepository(PolicyEndorsement).save({
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
        endorsement_type_id: typeConfig.id,
        endorsement_type_code: typeConfig.code,
        endorsement_type_name: typeConfig.name,
        tira_endorsement_type: typeConfig.tira_endorsement_type,
        previous_cover_note_reference: previousCoverNoteReference,
        previous_sticker_number: previousStickerNumber,
        requires_new_cover_note: typeConfig.requires_new_cover_note,
      });

      // The background TIRAMIS submission quotation is deliberately NOT
      // created here. Per the endorsement workflow spec it must be created
      // automatically only *after* approval, in the background — see
      // `ensureTransactionQuotation()`, invoked from
      // EndorsementsController#approve right after `approveTransaction`
      // succeeds. Nothing in the DRAFT-stage editing flow (recordChange /
      // recalculate / complete, all below) reads this quotation back; it
      // exists purely as an auditable link artifact for the eventual
      // TIRAMIS submission, which itself is built from
      // `PolicyTransaction`/`PolicyEndorsement` snapshots, not from the
      // quotation.
      policy.pending_transaction_id = transaction.id;
      await manager.getRepository(Policy).save(policy);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CREATED,
        actor_type: 'USER',
        actor_id: user.id,
        from_stage: null,
        to_stage: transaction.stage,
        metadata: {
          coverNoteType: 3,
          endorsementType: Number(typeConfig.tira_endorsement_type),
          previousCoverNoteReference,
        },
      });

      return transaction;
    });
  }

  /**
   * A motor fleet policy: its stored underwrite line, else the issued
   * snapshot's source flow (as the TIRAMIS payload builder decides).
   */
  private isFleetPolicy(
    policy: Policy,
    snapshot: Record<string, unknown> | null | undefined,
  ): boolean {
    if (policy.business_line) {
      return policy.business_line === 'FLEET';
    }
    const source = snapshot?.['source'] as Record<string, unknown> | undefined;
    return (
      source?.['isFleet'] === true ||
      source?.['quotationFlow'] === 'MOTOR_FLEET'
    );
  }

  /**
   * Creates the background TIRAMIS submission quotation for an approved
   * endorsement, if one does not already exist. Idempotent: safe to call
   * more than once for the same transaction (e.g. re-approval after a
   * CHANGES_REQUESTED cycle), and safe to call from a system/approval
   * context since it only needs `companyId` — not a full request-scoped
   * `AuthenticatedUser` beyond attribution.
   */
  async ensureTransactionQuotation(
    user: AuthenticatedUser,
    transactionId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(Quotation).findOne({
        where: {
          company_id: user.companyId!,
          source_policy_transaction_id: transactionId,
        },
      });

      if (existing) {
        return existing;
      }

      const transaction = await this.createScopedTransactionQuery(
        manager,
        user,
        'transaction',
        'policy',
      )
        .andWhere('transaction.id = :transactionId', { transactionId })
        .andWhere('transaction.transaction_type = :transactionType', {
          transactionType: PolicyTransactionType.ENDORSEMENT,
        })
        .getOne();

      if (!transaction) {
        throw new BadRequestException('Endorsement not found');
      }

      const [endorsement, policy, version] = await Promise.all([
        manager.getRepository(PolicyEndorsement).findOne({
          where: { policy_transaction_id: transaction.id },
        }),
        manager.getRepository(Policy).findOne({
          where: { id: transaction.source_policy_id },
        }),
        manager.getRepository(PolicyVersion).findOne({
          where: { id: transaction.source_policy_version_id },
        }),
      ]);

      if (!endorsement || !policy || !version) {
        throw new BadRequestException(
          'Endorsement, source policy, or source policy version could not be resolved.',
        );
      }

      const transactionQuotation =
        await this.quotationFactory.createTransactionDraft(manager, user, {
          policy,
          version,
          transaction,
          previousCoverNoteReference: endorsement.previous_cover_note_reference,
          endorsementType: Number(endorsement.tira_endorsement_type),
          endorsementReason: transaction.reason,
        });

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.QUOTATION_CREATED,
        actor_type: user.id ? 'USER' : 'SYSTEM',
        actor_id: user.id ?? null,
        to_stage: transaction.stage,
        metadata: {
          quotationId: transactionQuotation.id,
          quotationNo: transactionQuotation.quotation_no,
        },
      });

      return transactionQuotation;
    });
  }

  async recordChange(
    user: AuthenticatedUser,
    transactionId: string,
    input: RecordEndorsementChangeInput,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.requireDraftTransaction(
        manager,
        user,
        transactionId,
      );

      await this.assertNotFleetVehicleEndorsement(manager, transaction.id);

      const rule = this.resolveChangeRule(input.field_path);

      if (input.category !== rule.category) {
        throw new BadRequestException(
          `Field "${input.field_path}" belongs to category ${rule.category}, not ${input.category}.`,
        );
      }

      // Non-Motor risk details are not in the policy snapshot: their source
      // value comes from policy_non_motor_risk_details and the new value is
      // validated against the product risk schema.
      const nonMotor = this.nonMotorEndorsement.isNonMotorPath(input.field_path)
        ? await this.nonMotorEndorsement.resolveChange(
            manager,
            user.companyId!,
            transaction.source_policy_id,
            input.field_path,
            input.operation,
            input.new_value,
          )
        : null;
      const dto: RecordEndorsementChangeInput = nonMotor
        ? {
            ...input,
            operation: nonMotor.operation,
            new_value: nonMotor.newValue,
          }
        : input;

      const repository = manager.getRepository(PolicyTransactionChange);
      const sourceValue = nonMotor
        ? nonMotor.sourceValue
        : this.snapshotService.readValue(
            transaction.source_policy_snapshot,
            dto.field_path,
          );
      const existing = await repository.findOne({
        where: {
          company_id: user.companyId!,
          policy_transaction_id: transaction.id,
          field_path: dto.field_path,
        },
      });

      if (
        dto.operation !== PolicyTransactionChangeType.REMOVE &&
        this.snapshotService.sameValue(sourceValue, dto.new_value)
      ) {
        if (existing) {
          await repository.remove(existing);
          await manager.getRepository(PolicyTransactionEvent).save({
            company_id: transaction.company_id,
            policy_transaction_id: transaction.id,
            event_type: PolicyTransactionEventType.CHANGE_ADDED,
            actor_type: 'USER',
            actor_id: user.id,
            from_stage: transaction.stage,
            to_stage: transaction.stage,
            metadata: {
              action: 'REVERTED_TO_SOURCE',
              fieldPath: dto.field_path,
              category: rule.category,
            },
          });
        }

        return this.rebuildProposedSnapshot(manager, transaction);
      }

      if (
        dto.operation === PolicyTransactionChangeType.REMOVE &&
        sourceValue === undefined
      ) {
        if (existing) {
          await repository.remove(existing);
        }

        return this.rebuildProposedSnapshot(manager, transaction);
      }

      const operation =
        dto.operation === PolicyTransactionChangeType.REMOVE
          ? PolicyTransactionChangeType.REMOVE
          : sourceValue === undefined
            ? PolicyTransactionChangeType.ADD
            : PolicyTransactionChangeType.MODIFY;
      const newValue =
        operation === PolicyTransactionChangeType.REMOVE ? null : dto.new_value;
      const changeSnapshot = {
        category: rule.category,
        operation,
        fieldPath: dto.field_path,
        oldValue: sourceValue ?? null,
        newValue,
      };

      let change = existing;

      if (change) {
        change.category = rule.category;
        change.operation = operation;
        change.new_value = newValue;
        change.is_material = rule.material;
        change.requires_repricing = rule.repricing;
        change.requires_regulatory_submission = rule.regulatory;
        change.change_hash = this.hashService.hashDefinition(changeSnapshot);
        change = await repository.save(change);
      } else {
        change = await repository.save({
          company_id: user.companyId!,
          policy_transaction_id: transaction.id,
          category: rule.category,
          operation,
          field_path: dto.field_path,
          resource_id: dto.resource_id ?? null,
          old_value: sourceValue ?? null,
          new_value: newValue,
          is_material: rule.material,
          requires_repricing: rule.repricing,
          requires_regulatory_submission: rule.regulatory,
          change_hash: this.hashService.hashDefinition(changeSnapshot),
          created_by: user.id,
        });
      }

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CHANGE_ADDED,
        actor_type: 'USER',
        actor_id: user.id,
        from_stage: transaction.stage,
        to_stage: transaction.stage,
        metadata: {
          action: existing ? 'UPDATED' : 'ADDED',
          changeId: change.id,
          fieldPath: dto.field_path,
          category: rule.category,
        },
      });

      return this.rebuildProposedSnapshot(manager, transaction);
    });
  }

  async recalculate(user: AuthenticatedUser, transactionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.requireDraftTransaction(
        manager,
        user,
        transactionId,
      );
      return this.rebuildProposedSnapshot(manager, transaction);
    });
  }

  async complete(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.dataSource.transaction(async (manager) => {
      const current = await this.requireDraftTransaction(
        manager,
        user,
        transactionId,
        'endorsements:complete',
      );
      const updated = await this.rebuildProposedSnapshot(manager, current);

      const changes = await manager
        .getRepository(PolicyTransactionChange)
        .find({
          where: { policy_transaction_id: updated.id },
        });

      if (!changes.length) {
        throw new UnprocessableEntityException(
          'At least one policy change is required to complete an endorsement.',
        );
      }

      if (!updated.pricing_snapshot || !updated.pricing_snapshot_hash) {
        throw new UnprocessableEntityException(
          'The endorsement must be priced before completion.',
        );
      }

      if (
        !updated.proposed_policy_snapshot ||
        !updated.proposed_policy_snapshot_hash
      ) {
        throw new UnprocessableEntityException(
          'The proposed policy snapshot is missing.',
        );
      }

      // TIRAMIS assigns fixed regulatory meaning to EndorsementType 1
      // ("Increasing Premium Charged") and 2 ("Decreasing Premium
      // Charged") — see the cover-note API spec. A user-selected
      // endorsement type that contradicts the actual computed premium
      // effect is a near-certain TIRAMIS content rejection (TIRA002-class)
      // that we can catch here instead of round-tripping through a
      // submission attempt. Type 3 (cover-details change) is left
      // unrestricted since a details-only change can legitimately carry
      // either no premium impact or a rating side-effect.
      const endorsement = await manager
        .getRepository(PolicyEndorsement)
        .findOne({
          where: { policy_transaction_id: updated.id },
        });
      if (
        endorsement?.tira_endorsement_type === 1 &&
        updated.premium_effect === PolicyTransactionPremiumEffect.CREDIT
      ) {
        throw new UnprocessableEntityException({
          code: 'ENDORSEMENT_TYPE_PREMIUM_EFFECT_MISMATCH',
          message:
            'This endorsement is configured as "Increasing Premium Charged" (TIRAMIS EndorsementType 1), but the recalculated pricing results in a premium decrease. Choose a "Decreasing Premium Charged" endorsement type, or adjust the recorded changes.',
        });
      }
      if (
        endorsement?.tira_endorsement_type === 2 &&
        updated.premium_effect === PolicyTransactionPremiumEffect.DEBIT
      ) {
        throw new UnprocessableEntityException({
          code: 'ENDORSEMENT_TYPE_PREMIUM_EFFECT_MISMATCH',
          message:
            'This endorsement is configured as "Decreasing Premium Charged" (TIRAMIS EndorsementType 2), but the recalculated pricing results in a premium increase. Choose an "Increasing Premium Charged" endorsement type, or adjust the recorded changes.',
        });
      }

      const pricing = updated.pricing_snapshot;
      const pricingApprovalRequired =
        pricing['pricingApprovalRequired'] === true;
      const materialApprovalRequired = changes.some(
        (change) =>
          change.is_material &&
          APPROVAL_TRIGGER_CATEGORIES.includes(change.category),
      );
      const requiresApproval =
        materialApprovalRequired || pricingApprovalRequired;
      const requiresPayment =
        updated.premium_effect === PolicyTransactionPremiumEffect.DEBIT &&
        DecimalUtil.value(updated.additional_premium).greaterThan(0);

      updated.approval_required = requiresApproval;
      updated.payment_required = requiresPayment;
      updated.approval_status = requiresApproval
        ? WorkflowApprovalStatus.NOT_EVALUATED
        : WorkflowApprovalStatus.NOT_REQUIRED;
      updated.payment_status = requiresPayment
        ? WorkflowPaymentStatus.NOT_REQUESTED
        : WorkflowPaymentStatus.NOT_REQUIRED;
      updated.submission_status = WorkflowSubmissionStatus.NOT_READY;
      updated.completed_by = user.id;
      updated.completed_at = new Date();
      updated.state_version = Number(updated.state_version || 1) + 1;
      updated.last_command = 'COMPLETE_ENDORSEMENT';

      return manager.getRepository(PolicyTransaction).save(updated);
    });

    return this.lifecycleService.evaluateRequirements(
      user.companyId!,
      transaction.id,
      {
        changedBy: user.id,
        changedByType: 'USER',
        reason: 'Endorsement completed after authoritative pricing',
      },
    );
  }

  async requestPayment(user: AuthenticatedUser, transactionId: string) {
    return this.dataSource
      .transaction(async (manager) => {
        const transaction = await this.requireAccessibleTransaction(
          manager,
          user,
          transactionId,
          'endorsements:request-payment',
        );

        if (!transaction) {
          throw new BadRequestException('Endorsement not found');
        }

        if (
          transaction.premium_effect !== PolicyTransactionPremiumEffect.DEBIT
        ) {
          throw new UnprocessableEntityException(
            'Only a debit endorsement requires payment.',
          );
        }

        if (
          transaction.approval_required &&
          transaction.approval_status !== WorkflowApprovalStatus.APPROVED
        ) {
          throw new UnprocessableEntityException(
            'The endorsement must be approved before payment is requested.',
          );
        }

        const endorsement = await manager
          .getRepository(PolicyEndorsement)
          .findOne({
            where: { policy_transaction_id: transaction.id },
          });
        const policy = await manager.getRepository(Policy).findOne({
          where: { id: transaction.source_policy_id },
        });

        if (!endorsement || !policy) {
          throw new BadRequestException(
            'Endorsement or source policy could not be resolved.',
          );
        }

        const invoice = await this.invoiceService.createOrReuseInvoice(
          manager,
          {
            companyId: user.companyId!,
            insurerCompanyId: policy.insurer_company_id,
            intermediaryCompanyId: policy.intermediary_company_id,
            customerId: policy.customer_id,
            branchId: policy.branch_id,
            transaction,
            childResourceId: endorsement.id,
            sourceType: InvoiceSourceType.ENDORSEMENT,
            amount: transaction.additional_premium,
            description: `Additional premium for endorsement ${transaction.transaction_no}`,
            createdBy: user.id,
          },
        );

        transaction.active_invoice_id = invoice.id;
        await manager.getRepository(PolicyTransaction).save(transaction);

        return invoice;
      })
      .then((invoice) =>
        this.lifecycleService
          .markPaymentRequested(user.companyId!, transactionId, {
            changedBy: user.id,
          })
          .then(() => invoice),
      );
  }

  async cancel(user: AuthenticatedUser, transactionId: string, reason: string) {
    await this.assertAccessible(user, transactionId, 'endorsements:cancel');

    const transaction = await this.lifecycleService.cancelTransaction(
      user.companyId!,
      transactionId,
      { changedBy: user.id, reason },
    );

    await this.policyRepository.update(
      {
        id: transaction.source_policy_id,
        pending_transaction_id: transaction.id,
      },
      { pending_transaction_id: null },
    );

    return transaction;
  }

  async getContext(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.createScopedTransactionQuery(
      this.dataSource.manager,
      user,
      'transaction',
      'policy',
    )
      .andWhere('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType: PolicyTransactionType.ENDORSEMENT,
      })
      .getOne();

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    const endorsement = await this.endorsementRepository.findOne({
      where: {
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
      },
    });

    const changes = await this.changeRepository.find({
      where: {
        company_id: user.companyId!,
        policy_transaction_id: transaction.id,
      },
      order: {
        created_at: 'ASC',
      },
    });

    const nonMotorRiskDetails = await this.nonMotorEndorsement.getContext(
      this.dataSource.manager,
      user.companyId!,
      transaction.source_policy_id,
    );

    return {
      transaction,
      endorsement,
      changes,
      // Current risk details and schema of a Non-Motor policy (null for
      // other lines), for editing `nonMotor.*` changes.
      non_motor_risk_details: nonMotorRiskDetails,
      source_policy_snapshot: transaction.source_policy_snapshot,
      proposed_policy_snapshot:
        transaction.proposed_policy_snapshot ??
        transaction.source_policy_snapshot,
    };
  }

  async findAll(user: AuthenticatedUser, policyId?: string) {
    const query = this.createScopedTransactionQuery(
      this.dataSource.manager,
      user,
      'transaction',
      'policy',
      'policy-transactions:read',
    )
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType: PolicyTransactionType.ENDORSEMENT,
      })
      .orderBy('transaction.created_at', 'DESC');

    if (policyId) {
      query.andWhere('transaction.source_policy_id = :policyId', { policyId });
    }

    const transactions = await query.getMany();

    if (!transactions.length) {
      return [];
    }

    const endorsements = await this.endorsementRepository.find({
      where: {
        company_id: user.companyId!,
        policy_transaction_id: In(transactions.map((item) => item.id)),
      },
    });
    const map = new Map(
      endorsements.map((item) => [item.policy_transaction_id, item]),
    );

    return transactions.map((transaction) => {
      const endorsement = map.get(transaction.id);

      return {
        ...transaction,
        endorsement_type_code: endorsement?.endorsement_type_code ?? null,
        endorsement_type_name: endorsement?.endorsement_type_name ?? null,
        tira_endorsement_type: endorsement?.tira_endorsement_type ?? null,
        previous_cover_note_reference:
          endorsement?.previous_cover_note_reference ?? null,
        replacement_cover_note_reference:
          endorsement?.replacement_cover_note_reference ?? null,
        requires_new_cover_note: endorsement?.requires_new_cover_note ?? false,
      };
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const transaction = await this.createScopedTransactionQuery(
      this.dataSource.manager,
      user,
      'transaction',
      'policy',
      'policy-transactions:read',
    )
      .andWhere('transaction.id = :id', { id })
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType: PolicyTransactionType.ENDORSEMENT,
      })
      .getOne();

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    return transaction;
  }

  async assertAccessible(
    user: AuthenticatedUser,
    transactionId: string,
    permission = 'endorsements:create',
  ) {
    await this.requireAccessibleTransaction(
      this.dataSource.manager,
      user,
      transactionId,
      permission,
    );
  }

  /**
   * Runs `work` on a locked DRAFT endorsement and rebuilds (and reprices)
   * its proposed snapshot in the same database transaction, so a recorded
   * change never survives a failed rebuild. Used by the fleet vehicle
   * add/remove endorsements, which write their own change rows.
   */
  async applyWithinDraft<T>(
    user: AuthenticatedUser,
    transactionId: string,
    work: (
      manager: EntityManager,
      transaction: PolicyTransaction,
      endorsement: PolicyEndorsement,
    ) => Promise<T>,
  ): Promise<PolicyTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.requireDraftTransaction(
        manager,
        user,
        transactionId,
      );
      const endorsement = await manager
        .getRepository(PolicyEndorsement)
        .findOne({ where: { policy_transaction_id: transaction.id } });

      if (!endorsement) {
        throw new BadRequestException('Endorsement not found');
      }

      await work(manager, transaction, endorsement);
      return this.rebuildProposedSnapshot(manager, transaction);
    });
  }

  /**
   * Fleet add/remove-vehicle endorsements carry only their own vehicle
   * changes (one kind per endorsement), so field edits are refused on them.
   */
  private async assertNotFleetVehicleEndorsement(
    manager: EntityManager,
    transactionId: string,
  ) {
    const endorsement = await manager
      .getRepository(PolicyEndorsement)
      .findOne({ where: { policy_transaction_id: transactionId } });

    if (
      endorsement &&
      FLEET_VEHICLE_ENDORSEMENT_CODES.includes(
        endorsement.endorsement_type_code,
      )
    ) {
      throw new UnprocessableEntityException(
        'This endorsement only adds or removes fleet vehicles; record other changes in a separate endorsement.',
      );
    }
  }

  private async requireDraftTransaction(
    manager: EntityManager,
    user: AuthenticatedUser,
    transactionId: string,
    permission = 'endorsements:update-draft',
  ) {
    const transaction = await this.createScopedTransactionQuery(
      manager,
      user,
      'transaction',
      'policy',
      permission,
    )
      .setLock('pessimistic_write')
      .where('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.transaction_type = :type', {
        type: PolicyTransactionType.ENDORSEMENT,
      })
      .getOne();

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    if (transaction.stage !== 'DRAFT') {
      throw new UnprocessableEntityException(
        `Endorsement cannot be modified while in stage ${transaction.stage}.`,
      );
    }

    return transaction;
  }

  private async requireAccessibleTransaction(
    manager: EntityManager,
    user: AuthenticatedUser,
    transactionId: string,
    permission = 'endorsements:create',
  ) {
    const transaction = await this.createScopedTransactionQuery(
      manager,
      user,
      'transaction',
      'policy',
      permission,
    )
      .andWhere('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.transaction_type = :type', {
        type: PolicyTransactionType.ENDORSEMENT,
      })
      .getOne();

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    return transaction;
  }

  private createScopedTransactionQuery(
    manager: EntityManager,
    user: AuthenticatedUser,
    transactionAlias: string,
    policyAlias: string,
    permission = 'endorsements:create',
  ) {
    const query = manager
      .getRepository(PolicyTransaction)
      .createQueryBuilder(transactionAlias)
      .innerJoin(
        Policy,
        policyAlias,
        `${policyAlias}.id = ${transactionAlias}.source_policy_id`,
      )
      .andWhere(`${transactionAlias}.company_id = :transactionCompanyId`, {
        transactionCompanyId: user.companyId!,
      });

    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      policyAlias,
      this.dataAccessScopeService.resolve(user, permission),
    );

    return query;
  }

  private resolveChangeRule(fieldPath: string): EndorsementFieldRule {
    const rule = ENDORSEMENT_FIELD_RULES.find((item) =>
      item.pattern.test(fieldPath),
    );

    if (!rule) {
      throw new BadRequestException(
        `Field "${fieldPath}" is not editable through endorsement.`,
      );
    }

    return rule;
  }

  private async rebuildProposedSnapshot(
    manager: EntityManager,
    transaction: PolicyTransaction,
  ) {
    const changes = await manager.getRepository(PolicyTransactionChange).find({
      where: { policy_transaction_id: transaction.id },
      order: { created_at: 'ASC' },
    });

    // Non-Motor risk-detail changes apply on top of the policy's current
    // risk details, so the proposed snapshot carries the whole block.
    const base = this.nonMotorEndorsement.hasNonMotorChanges(changes)
      ? await this.nonMotorEndorsement.withCurrentRisk(
          manager,
          transaction.company_id,
          transaction.source_policy_id,
          transaction.source_policy_snapshot,
        )
      : transaction.source_policy_snapshot;

    const { snapshot, snapshotHash } = this.snapshotService.build(
      base,
      changes.map((change) => ({
        fieldPath: change.field_path,
        operation: change.operation,
        newValue: change.new_value,
      })),
    );

    transaction.proposed_policy_snapshot = snapshot;
    transaction.proposed_policy_snapshot_hash = snapshotHash;

    const repriced = await this.repricingService.reprice(
      manager,
      transaction,
      transaction.source_policy_snapshot,
      snapshot,
    );
    const pricingSnapshot = repriced.snapshot;

    transaction.pricing_snapshot = pricingSnapshot as unknown as Record<
      string,
      unknown
    >;
    transaction.pricing_snapshot_hash = pricingSnapshot.snapshotHash;
    transaction.premium_effect = pricingSnapshot.premiumEffect;
    transaction.additional_premium =
      pricingSnapshot.premiumEffect === PolicyTransactionPremiumEffect.DEBIT
        ? DecimalUtil.value(pricingSnapshot.premiumDifference).toFixed(4)
        : '0.0000';
    transaction.return_premium =
      pricingSnapshot.premiumEffect === PolicyTransactionPremiumEffect.CREDIT
        ? DecimalUtil.value(pricingSnapshot.premiumDifference).abs().toFixed(4)
        : '0.0000';
    transaction.tax_difference = pricingSnapshot.taxDifference;
    transaction.commission_difference = pricingSnapshot.commissionDifference;
    transaction.net_premium_difference = pricingSnapshot.premiumDifference;

    // A fleet vehicle removal refunds under the cancellation rules (D5).
    if (await this.fleetRemovalRefund.adjust(manager, transaction)) {
      transaction.pricing_snapshot_hash = this.hashService.hashDefinition(
        transaction.pricing_snapshot,
      );
    }

    return manager.getRepository(PolicyTransaction).save(transaction);
  }
}
