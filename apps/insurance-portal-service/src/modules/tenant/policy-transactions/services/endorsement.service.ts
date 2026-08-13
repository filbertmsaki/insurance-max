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
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Policy } from '../../policies/entities/policy.entity';
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
  ) {}

  async getEligibility(
    user: AuthenticatedUser,
    policyId: string,
    effectiveDate?: string,
  ) {
    const policy = await this.policyRepository.findOne({
      where: {
        id: policyId,
        company_id: user.companyId!,
      },
    });

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
      const policy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', { policyId })
        .andWhere('policy.company_id = :companyId', {
          companyId: user.companyId,
        })
        .getOne();

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

      const previousCoverNoteReference =
        eligibility.currentVersion!.regulatory_reference ??
        policy.cover_note_no;

      if (!previousCoverNoteReference) {
        throw new UnprocessableEntityException(
          'The current policy version does not contain a regulatory cover-note reference.',
        );
      }

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
        requires_new_cover_note: typeConfig.requires_new_cover_note,
      });

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
      });

      return transaction;
    });
  }

  async recordChange(
    user: AuthenticatedUser,
    transactionId: string,
    dto: RecordEndorsementChangeInput,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.requireDraftTransaction(
        manager,
        user.companyId!,
        transactionId,
      );

      const rule = this.resolveChangeRule(dto.field_path);

      if (dto.category !== rule.category) {
        throw new BadRequestException(
          `Field "${dto.field_path}" belongs to category ${rule.category}, not ${dto.category}.`,
        );
      }

      const repository = manager.getRepository(PolicyTransactionChange);
      const sourceValue = this.snapshotService.readValue(
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
        user.companyId!,
        transactionId,
      );
      return this.rebuildProposedSnapshot(manager, transaction);
    });
  }

  async complete(user: AuthenticatedUser, transactionId: string) {
    const transaction = await this.dataSource.transaction(async (manager) => {
      const current = await this.requireDraftTransaction(
        manager,
        user.companyId!,
        transactionId,
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
        const transaction = await manager
          .getRepository(PolicyTransaction)
          .findOne({
            where: {
              id: transactionId,
              company_id: user.companyId!,
              transaction_type: PolicyTransactionType.ENDORSEMENT,
            },
          });

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

  async getContext(companyId: string, transactionId: string) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id: transactionId,
        company_id: companyId,
        transaction_type: PolicyTransactionType.ENDORSEMENT,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    const endorsement = await this.endorsementRepository.findOne({
      where: {
        company_id: companyId,
        policy_transaction_id: transaction.id,
      },
    });

    const changes = await this.changeRepository.find({
      where: {
        company_id: companyId,
        policy_transaction_id: transaction.id,
      },
      order: {
        created_at: 'ASC',
      },
    });

    return {
      transaction,
      endorsement,
      changes,
      source_policy_snapshot: transaction.source_policy_snapshot,
      proposed_policy_snapshot:
        transaction.proposed_policy_snapshot ??
        transaction.source_policy_snapshot,
    };
  }

  async findAll(companyId: string, policyId?: string) {
    const transactions = await this.transactionRepository.find({
      where: policyId
        ? {
            company_id: companyId,
            transaction_type: PolicyTransactionType.ENDORSEMENT,
            source_policy_id: policyId,
          }
        : {
            company_id: companyId,
            transaction_type: PolicyTransactionType.ENDORSEMENT,
          },
      order: { created_at: 'DESC' },
    });

    if (!transactions.length) {
      return [];
    }

    const endorsements = await this.endorsementRepository.find({
      where: {
        company_id: companyId,
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

  async findOne(companyId: string, id: string) {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id,
        company_id: companyId,
        transaction_type: PolicyTransactionType.ENDORSEMENT,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Endorsement not found');
    }

    return transaction;
  }

  private async requireDraftTransaction(
    manager: EntityManager,
    companyId: string,
    transactionId: string,
  ) {
    const transaction = await manager
      .getRepository(PolicyTransaction)
      .createQueryBuilder('transaction')
      .setLock('pessimistic_write')
      .where('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.company_id = :companyId', { companyId })
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

    const { snapshot, snapshotHash } = this.snapshotService.build(
      transaction.source_policy_snapshot,
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

    return manager.getRepository(PolicyTransaction).save(transaction);
  }
}
