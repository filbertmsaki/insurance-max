import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  PolicyTransactionEventType,
  InvoiceSourceType,
  PolicyTransactionStage,
  PolicyTransactionType,
  PolicyVersionType,
  QuotationStage,
  WorkflowSubmissionStatus,
} from '@insurance-max/contracts';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { Policy } from '../../policies/entities/policy.entity';
import { PolicyStatusHistory } from '../../policies/entities/policy-status-history.entity';
import { PolicyVersion } from '../../policies/entities/policy-version.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationStatus } from '../../quotations/enums/quotation-status.enum';
import { TiraStatus } from '../../quotations/enums/tira-status.enum';
import { PolicyCancellation } from '../entities/policy-cancellation.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { PolicyTransactionLifecycleService } from './policy-transaction-lifecycle.service';
import { PolicyTransactionReturnPremiumService } from './policy-transaction-return-premium.service';

export interface ApplyPolicyTransactionContext {
  changedBy?: string | null;
}

/**
 * Applies an ENDORSEMENT or CANCELLATION transaction to its source policy
 * once TIRAMIS has accepted the resubmission (§13's "apply to policy" step,
 * previously missing — `PolicyTransactionLifecycleService.markApplied` only
 * flipped the transaction's own stage and never touched the policy). Mirrors
 * the versioning pattern already used for new-business issuance
 * (`IssuanceService.createPolicyVersion`) and renewal
 * (`RenewalService.applyIssuedPolicyIfRenewal`).
 */
@Injectable()
export class PolicyTransactionApplyService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    private readonly hashService: ProductDefinitionHashService,
    private readonly lifecycleService: PolicyTransactionLifecycleService,
    private readonly returnPremiumService: PolicyTransactionReturnPremiumService,
  ) {}

  async applyEndorsement(
    companyId: string,
    transactionId: string,
    context: ApplyPolicyTransactionContext = {},
  ) {
    return this.dataSource.transaction(async (manager) => {
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
        throw new ConflictException('Policy transaction not found.');
      }

      if (
        transaction.stage === PolicyTransactionStage.APPLIED &&
        transaction.target_policy_version_id
      ) {
        await this.markRelatedTransactionQuotationCompleted(
          manager,
          companyId,
          transaction,
          context,
        );

        return transaction;
      }

      if (transaction.submission_status !== WorkflowSubmissionStatus.ACCEPTED) {
        throw new ConflictException(
          'The endorsement cannot be applied before final TIRAMIS acceptance.',
        );
      }

      if (!transaction.proposed_policy_snapshot) {
        throw new ConflictException(
          'Endorsement has no proposed policy snapshot.',
        );
      }

      const endorsement = await manager
        .getRepository(PolicyEndorsement)
        .findOne({
          where: {
            company_id: companyId,
            policy_transaction_id: transaction.id,
          },
        });

      if (!endorsement) {
        throw new ConflictException('Endorsement could not be resolved.');
      }

      const policy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', {
          policyId: transaction.source_policy_id,
        })
        .getOne();

      if (!policy) {
        throw new ConflictException('Source policy could not be resolved.');
      }

      if (
        policy.active_version_id &&
        policy.active_version_id !== transaction.source_policy_version_id
      ) {
        throw new ConflictException({
          code: 'POLICY_VERSION_CONFLICT',
          message:
            'The source policy version changed after this endorsement was created.',
        });
      }

      const previousVersion = await manager
        .getRepository(PolicyVersion)
        .findOne({
          where: {
            id: transaction.source_policy_version_id,
            policy_id: policy.id,
          },
        });

      if (!previousVersion) {
        throw new ConflictException(
          'Source policy version could not be resolved.',
        );
      }

      const originalStatus = policy.policy_status;
      const newTotalPremium = DecimalUtil.subtract(
        DecimalUtil.add(policy.total_premium, transaction.additional_premium),
        transaction.return_premium,
      );
      const newTax = DecimalUtil.add(
        policy.total_tax,
        transaction.tax_difference,
      );
      const newCommission = DecimalUtil.add(
        policy.total_commission,
        transaction.commission_difference,
      );
      const newCharges = DecimalUtil.value(policy.total_charges)
        .plus(
          DecimalUtil.value(
            transaction.pricing_snapshot?.['chargeDifference'] as
              | string
              | number
              | undefined,
          ),
        )
        .toFixed(2);
      const appliedSnapshot = this.buildAppliedEndorsementSnapshot(
        transaction,
        endorsement,
        policy,
        {
          totalPremium: newTotalPremium,
          totalTax: newTax,
          totalCommission: newCommission,
          totalCharges: newCharges,
        },
      );
      const customerSnapshot = this.buildVersionCustomerSnapshot(
        previousVersion,
        appliedSnapshot,
      );
      const assetManifest = this.buildVersionAssetManifest(
        previousVersion,
        appliedSnapshot,
      );

      previousVersion.is_current = false;
      previousVersion.superseded_at = new Date();
      await manager.getRepository(PolicyVersion).save(previousVersion);

      const currentReference =
        endorsement.replacement_cover_note_reference ??
        endorsement.previous_cover_note_reference;
      const currentSticker =
        endorsement.replacement_sticker_number ??
        endorsement.previous_sticker_number;
      const cover = this.asObject(appliedSnapshot['cover']);
      const versionNumber = previousVersion.version_number + 1;
      const newVersion = await manager.getRepository(PolicyVersion).save({
        company_id: policy.company_id,
        policy_id: policy.id,
        version_number: versionNumber,
        version_type: PolicyVersionType.ENDORSEMENT,
        status: 'ENDORSED',
        effective_from: transaction.effective_date,
        effective_to: String(cover?.['endDate'] ?? policy.end_date),
        policy_snapshot: appliedSnapshot,
        policy_snapshot_hash: this.hashService.hashDefinition(appliedSnapshot),
        pricing_snapshot:
          transaction.pricing_snapshot ?? previousVersion.pricing_snapshot,
        pricing_result_hash:
          transaction.pricing_snapshot_hash ??
          previousVersion.pricing_result_hash,
        customer_snapshot: customerSnapshot,
        customer_snapshot_hash:
          this.hashService.hashDefinition(customerSnapshot),
        asset_manifest: assetManifest,
        asset_manifest_hash: this.hashService.hashDefinition(assetManifest),
        tiramis_tracking_id: transaction.tiramis_tracking_id,
        policy_transaction_id: transaction.id,
        supersedes_version_id: previousVersion.id,
        superseded_at: null,
        is_current: true,
        regulatory_reference: currentReference,
        regulatory_sticker_number: currentSticker,
        effective_transaction_date: transaction.effective_date,
        created_by: context.changedBy ?? transaction.completed_by ?? null,
      });

      policy.total_premium = newTotalPremium;
      policy.net_premium = newTotalPremium;
      policy.total_tax = newTax;
      policy.total_charges = newCharges;
      policy.total_commission = newCommission;
      policy.sum_insured = this.sumPolicySnapshotInsuredValue(appliedSnapshot);
      policy.policy_status = 'ENDORSED';

      if (cover?.['startDate']) {
        policy.start_date = String(cover['startDate']);
      }

      if (cover?.['endDate']) {
        policy.end_date = String(cover['endDate']);
      }

      policy.customer_snapshot = customerSnapshot;
      policy.customer_snapshot_hash =
        this.hashService.hashDefinition(customerSnapshot);
      policy.pricing_snapshot = transaction.pricing_snapshot;
      policy.pricing_result_hash = transaction.pricing_snapshot_hash;
      policy.cover_note_no = currentReference;
      if (currentSticker) {
        policy.sticker_no = currentSticker;
      }
      policy.tira_status = 'SUCCESS';
      policy.regulatory_sync_status = 'SUCCESS';
      policy.tiramis_submission_tracking_id = transaction.tiramis_tracking_id;
      policy.tiramis_transaction_id = transaction.tiramis_transaction_id;
      policy.tiramis_request_id = transaction.tiramis_request_id;
      policy.regulatory_response_payload = transaction.regulatory_response;
      policy.regulatory_response_hash = transaction.regulatory_response_hash;
      policy.tiramis_final_response_id =
        String(transaction.regulatory_response?.['responseId'] ?? '') || null;
      policy.tiramis_final_response_status_code =
        String(transaction.regulatory_response?.['statusCode'] ?? '') || null;
      policy.tiramis_final_response_status_desc =
        String(transaction.regulatory_response?.['statusDescription'] ?? '') ||
        null;
      policy.tiramis_last_synced_at = new Date();
      policy.last_endorsement_date = transaction.effective_date;
      policy.current_version_no = newVersion.version_number;
      policy.active_version_id = newVersion.id;
      policy.pending_transaction_id = null;
      policy.source_cover_note_count = currentReference
        ? Math.max(Number(policy.source_cover_note_count || 0), 1)
        : policy.source_cover_note_count;
      policy.state_version = Number(policy.state_version || 1) + 1;

      await manager.getRepository(Policy).save(policy);

      if (originalStatus !== 'ENDORSED') {
        await manager.getRepository(PolicyStatusHistory).save({
          policy_id: policy.id,
          old_status: originalStatus,
          new_status: 'ENDORSED',
          reason: transaction.reason,
          changed_by: context.changedBy ?? null,
        });
      }

      transaction.target_policy_id = policy.id;
      transaction.target_policy_version_id = newVersion.id;
      transaction.stage = PolicyTransactionStage.APPLIED;
      transaction.last_command = 'POLICY_VERSION_APPLIED';
      await manager.getRepository(PolicyTransaction).save(transaction);

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.POLICY_VERSION_APPLIED,
        actor_type: context.changedBy ? 'USER' : 'SYSTEM',
        actor_id: context.changedBy ?? null,
        from_stage: PolicyTransactionStage.COMPLETED,
        to_stage: PolicyTransactionStage.APPLIED,
        metadata: {
          sourceVersion: previousVersion.version_number,
          targetVersion: newVersion.version_number,
          previousCoverNoteReference: endorsement.previous_cover_note_reference,
          replacementCoverNoteReference: currentReference,
          previousStickerNumber: endorsement.previous_sticker_number,
          replacementStickerNumber: endorsement.replacement_sticker_number,
        },
      });

      await this.returnPremiumService.createRequests(
        manager,
        transaction,
        policy,
        endorsement.id,
        InvoiceSourceType.ENDORSEMENT,
      );

      await this.markRelatedTransactionQuotationCompleted(
        manager,
        companyId,
        transaction,
        context,
      );

      return transaction;
    });
  }

  private buildAppliedEndorsementSnapshot(
    transaction: PolicyTransaction,
    endorsement: PolicyEndorsement,
    policy: Policy,
    totals: {
      totalPremium: string;
      totalTax: string;
      totalCommission: string;
      totalCharges: string;
    },
  ): Record<string, unknown> {
    const snapshot = JSON.parse(
      JSON.stringify(transaction.proposed_policy_snapshot ?? {}),
    ) as Record<string, unknown>;
    const oldTotals = this.asObject(snapshot['totals']) ?? {};

    oldTotals['totalPremium'] = totals.totalPremium;
    oldTotals['totalTax'] = totals.totalTax;
    oldTotals['totalCommission'] = totals.totalCommission;
    oldTotals['totalCharges'] = totals.totalCharges;
    snapshot['totals'] = oldTotals;
    snapshot['policyStatus'] = 'ENDORSED';

    const regulatory = this.asObject(snapshot['regulatory']) ?? {};
    regulatory['previousCoverNoteReference'] =
      endorsement.previous_cover_note_reference;
    regulatory['currentCoverNoteReference'] =
      endorsement.replacement_cover_note_reference ??
      endorsement.previous_cover_note_reference;
    regulatory['previousStickerNumber'] = endorsement.previous_sticker_number;
    regulatory['currentStickerNumber'] =
      endorsement.replacement_sticker_number ??
      endorsement.previous_sticker_number;
    regulatory['endorsement'] = {
      transactionId: transaction.id,
      transactionNo: transaction.transaction_no,
      effectiveDate: transaction.effective_date,
      endorsementTypeCode: endorsement.endorsement_type_code,
      endorsementType: endorsement.tira_endorsement_type,
      reason: transaction.reason,
      premiumEffect: transaction.premium_effect,
      additionalPremium: transaction.additional_premium,
      returnPremium: transaction.return_premium,
    };
    regulatory['tiramisTrackingId'] = transaction.tiramis_tracking_id;
    regulatory['tiramisTransactionId'] = transaction.tiramis_transaction_id;
    regulatory['requestId'] = transaction.tiramis_request_id;
    regulatory['response'] = transaction.regulatory_response;
    regulatory['responseHash'] = transaction.regulatory_response_hash;
    snapshot['regulatory'] = regulatory;

    // `resolvePreviousReference()` (policy-transaction-tiramis-payload
    // .service.ts) prefers the per-entry `coverNoteReferenceNumber` it
    // finds on the NEXT endorsement's `source_policy_snapshot.coverNotes`
    // (which is a copy of this applied version's `policy_snapshot`) over
    // `endorsement.previous_cover_note_reference`. If we leave those
    // entries pointing at the pre-endorsement cover note, a *second*
    // endorsement on this policy would send TIRAMIS the wrong
    // PrevCoverNoteReferenceNumber. Refresh them here so the next
    // transaction's snapshot is accurate.
    const coverNotesArray = Array.isArray(snapshot['coverNotes'])
      ? (snapshot['coverNotes'] as unknown[])
      : null;
    if (coverNotesArray) {
      this.refreshSnapshotCoverNotes(coverNotesArray, transaction, endorsement);
    }

    return snapshot;
  }

  /**
   * Refreshes each `coverNotes[]` entry of the applied `PolicyVersion`
   * snapshot with the TIRAMIS-returned cover-note reference and sticker
   * number for its own fleet entry, not just a single shared value. TIRAMIS
   * returns one `MotorCoverNoteRefRes.FleetResDtl` per fleet entry — the
   * raw regulatory response (with a `coverNotes[]` entry per fleet entry,
   * each carrying `quotationEntryId`/`fleetEntry`) is already captured
   * verbatim on `transaction.regulatory_response` by
   * `PolicyTransactionRegulatoryOutcomeService.captureFinalSuccess`, so no
   * schema change is required to use it here — only the single/non-fleet
   * `PolicyEndorsement.replacement_cover_note_reference` +
   * `.replacement_sticker_number` are used as the fallback when TIRAMIS
   * only returned one cover note (the common, non-fleet case).
   */
  private refreshSnapshotCoverNotes(
    coverNotesArray: unknown[],
    transaction: PolicyTransaction,
    endorsement: PolicyEndorsement,
  ): void {
    const fallbackReference =
      endorsement.replacement_cover_note_reference ??
      endorsement.previous_cover_note_reference;
    const fallbackSticker =
      endorsement.replacement_sticker_number ??
      endorsement.previous_sticker_number;

    const regulatoryResponse = this.asObject(transaction.regulatory_response);
    const responseCoverNotes = this.asArray(regulatoryResponse?.['coverNotes'])
      .map((value) => this.asObject(value))
      .filter((value): value is Record<string, unknown> => !!value);

    for (const rawEntry of coverNotesArray) {
      const note = this.asObject(rawEntry);
      if (!note) {
        continue;
      }

      const entryId = note['quotationEntryId'];
      const fleetEntry = note['fleetEntry'];
      const matched =
        responseCoverNotes.find(
          (candidate) =>
            (entryId != null && candidate['quotationEntryId'] === entryId) ||
            (fleetEntry != null && candidate['fleetEntry'] === fleetEntry),
        ) ?? (coverNotesArray.length === 1 ? responseCoverNotes[0] : undefined);

      const newReference =
        (matched?.['coverNoteReferenceNumber'] as string | undefined) ??
        (coverNotesArray.length === 1 ? fallbackReference : undefined);
      const newSticker =
        (matched?.['stickerNumber'] as string | null | undefined) ??
        (coverNotesArray.length === 1 ? fallbackSticker : undefined);

      if (newReference) {
        note['coverNoteReferenceNumber'] = newReference;
      }
      if (newSticker) {
        note['stickerNumber'] = newSticker;
      }
    }
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private buildVersionCustomerSnapshot(
    previous: PolicyVersion,
    policySnapshot: Record<string, unknown>,
  ) {
    const holders = Array.isArray(policySnapshot['policyHolders'])
      ? policySnapshot['policyHolders']
      : [];

    return {
      ...previous.customer_snapshot,
      policyHolder:
        holders[0] ?? previous.customer_snapshot?.['policyHolder'] ?? null,
      policyHolders: holders,
    };
  }

  private buildVersionAssetManifest(
    previous: PolicyVersion,
    policySnapshot: Record<string, unknown>,
  ) {
    const entries = Array.isArray(policySnapshot['entries'])
      ? (policySnapshot['entries'] as Record<string, unknown>[])
      : [];
    const assetEntries = entries.map((entry) => {
      const clone = { ...entry };
      delete clone['pricing'];
      return clone;
    });

    return {
      ...previous.asset_manifest,
      entryCount: assetEntries.length,
      entries: assetEntries,
    };
  }

  private sumPolicySnapshotInsuredValue(
    snapshot: Record<string, unknown>,
  ): string {
    const entries = Array.isArray(snapshot['entries'])
      ? (snapshot['entries'] as Record<string, unknown>[])
      : [];
    let total = DecimalUtil.value(0);

    for (const entry of entries) {
      const risks = Array.isArray(entry['risks'])
        ? (entry['risks'] as Record<string, unknown>[])
        : [];

      for (const risk of risks) {
        total = total.plus(
          DecimalUtil.value(
            risk['sumInsured'] as string | number | null | undefined,
          ),
        );
      }
    }

    return total.toFixed(2);
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  async applyCancellation(
    companyId: string,
    transactionId: string,
    context: ApplyPolicyTransactionContext = {},
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager
        .getRepository(PolicyTransaction)
        .createQueryBuilder('transaction')
        .setLock('pessimistic_write')
        .where('transaction.id = :transactionId', { transactionId })
        .andWhere('transaction.company_id = :companyId', { companyId })
        .andWhere('transaction.transaction_type = :type', {
          type: PolicyTransactionType.CANCELLATION,
        })
        .getOne();

      if (!transaction) {
        throw new ConflictException('Policy transaction not found.');
      }

      if (
        transaction.stage === PolicyTransactionStage.APPLIED &&
        transaction.target_policy_version_id
      ) {
        await this.markRelatedTransactionQuotationCompleted(
          manager,
          companyId,
          transaction,
          context,
        );

        return transaction;
      }

      if (transaction.submission_status !== WorkflowSubmissionStatus.ACCEPTED) {
        throw new ConflictException(
          'The cancellation cannot be applied before final TIRAMIS acceptance.',
        );
      }

      const cancellation = await manager
        .getRepository(PolicyCancellation)
        .findOne({
          where: {
            company_id: companyId,
            policy_transaction_id: transaction.id,
          },
        });

      if (!cancellation) {
        throw new ConflictException('Cancellation could not be resolved.');
      }

      const policy = await manager
        .getRepository(Policy)
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.id = :policyId', {
          policyId: transaction.source_policy_id,
        })
        .getOne();

      if (!policy) {
        throw new ConflictException('Source policy could not be resolved.');
      }

      if (policy.active_version_id !== transaction.source_policy_version_id) {
        throw new ConflictException({
          code: 'POLICY_VERSION_CONFLICT',
          message: 'The policy changed after this cancellation was created.',
        });
      }

      const previousVersion = await manager
        .getRepository(PolicyVersion)
        .findOne({
          where: {
            id: transaction.source_policy_version_id,
            policy_id: policy.id,
            company_id: companyId,
          },
        });

      if (!previousVersion) {
        throw new ConflictException('Current Policy Version was not found.');
      }

      const cancelledSnapshot = JSON.parse(
        JSON.stringify(
          transaction.proposed_policy_snapshot ??
            transaction.source_policy_snapshot,
        ),
      ) as Record<string, unknown>;

      cancelledSnapshot['policyStatus'] = 'CANCELLED';
      cancelledSnapshot['cancellation'] = {
        ...(this.asObject(cancelledSnapshot['cancellation']) ?? {}),
        reasonType: cancellation.reason_type,
        reason: transaction.reason,
        method: cancellation.cancellation_method,
        effectiveDate: transaction.effective_date,
        policyDays: cancellation.policy_days,
        daysOnRisk: cancellation.days_on_risk,
        earnedPremium: cancellation.earned_premium,
        unearnedPremium: cancellation.unearned_premium,
        cancellationCharge: cancellation.cancellation_charge,
        refundAmount: cancellation.refund_amount,
        amountDue: cancellation.amount_due,
        previousCoverNoteReference: cancellation.previous_cover_note_reference,
        cancellationCoverNoteReference:
          cancellation.cancellation_cover_note_reference,
        regulatoryResponse: transaction.regulatory_response,
      };

      previousVersion.is_current = false;
      previousVersion.superseded_at = new Date();
      await manager.getRepository(PolicyVersion).save(previousVersion);

      const versionNumber = previousVersion.version_number + 1;
      const currentReference =
        cancellation.cancellation_cover_note_reference ??
        cancellation.previous_cover_note_reference;

      const newVersion = await manager.getRepository(PolicyVersion).save({
        company_id: policy.company_id,
        policy_id: policy.id,
        version_number: versionNumber,
        version_type: PolicyVersionType.CANCELLATION,
        status: 'CANCELLED',
        effective_from: transaction.effective_date,
        effective_to: transaction.effective_date,
        policy_snapshot: cancelledSnapshot,
        policy_snapshot_hash:
          this.hashService.hashDefinition(cancelledSnapshot),
        pricing_snapshot: transaction.pricing_snapshot ?? {},
        pricing_result_hash:
          transaction.pricing_snapshot_hash ??
          this.hashService.hashDefinition({}),
        customer_snapshot: previousVersion.customer_snapshot,
        customer_snapshot_hash: previousVersion.customer_snapshot_hash,
        asset_manifest: previousVersion.asset_manifest,
        asset_manifest_hash: previousVersion.asset_manifest_hash,
        tiramis_tracking_id: transaction.tiramis_tracking_id,
        policy_transaction_id: transaction.id,
        supersedes_version_id: previousVersion.id,
        is_current: true,
        regulatory_reference: currentReference,
        effective_transaction_date: transaction.effective_date,
        created_by: context.changedBy ?? transaction.completed_by,
      });

      const originalStatus = policy.policy_status;
      policy.policy_status = 'CANCELLED';
      policy.cancellation_effective_date = transaction.effective_date;
      policy.current_version_no = newVersion.version_number;
      policy.active_version_id = newVersion.id;
      policy.pending_transaction_id = null;
      policy.cover_note_no = currentReference;
      policy.tira_status = 'SUCCESS';
      policy.regulatory_sync_status = 'SUCCESS';
      policy.tiramis_submission_tracking_id = transaction.tiramis_tracking_id;
      policy.tiramis_transaction_id = transaction.tiramis_transaction_id;
      policy.tiramis_request_id = transaction.tiramis_request_id;
      policy.state_version = Number(policy.state_version || 1) + 1;

      await manager.getRepository(Policy).save(policy);

      if (originalStatus !== 'CANCELLED') {
        await manager.getRepository(PolicyStatusHistory).save({
          policy_id: policy.id,
          old_status: originalStatus,
          new_status: 'CANCELLED',
          reason: transaction.reason,
          changed_by: context.changedBy ?? null,
        });
      }

      transaction.target_policy_id = policy.id;
      transaction.target_policy_version_id = newVersion.id;
      transaction.stage = PolicyTransactionStage.APPLIED;
      transaction.last_command = 'CANCELLATION_APPLIED';
      await manager.getRepository(PolicyTransaction).save(transaction);

      await this.markRelatedTransactionQuotationCompleted(
        manager,
        companyId,
        transaction,
        context,
      );

      await manager.getRepository(PolicyTransactionEvent).save({
        company_id: transaction.company_id,
        policy_transaction_id: transaction.id,
        event_type: PolicyTransactionEventType.CANCELLATION_APPLIED,
        actor_type: context.changedBy ? 'USER' : 'SYSTEM',
        actor_id: context.changedBy ?? null,
        from_stage: PolicyTransactionStage.COMPLETED,
        to_stage: PolicyTransactionStage.APPLIED,
        metadata: {
          sourceVersion: previousVersion.version_number,
          targetVersion: newVersion.version_number,
          previousCoverNoteReference:
            cancellation.previous_cover_note_reference,
          cancellationCoverNoteReference: currentReference,
        },
      });

      await this.returnPremiumService.createRequests(
        manager,
        transaction,
        policy,
        cancellation.id,
        InvoiceSourceType.CANCELLATION,
      );

      return transaction;
    });
  }

  private async markRelatedTransactionQuotationCompleted(
    manager: import('typeorm').EntityManager,
    companyId: string,
    transaction: PolicyTransaction,
    context: ApplyPolicyTransactionContext,
  ) {
    await manager.getRepository(Quotation).update(
      {
        company_id: companyId,
        source_policy_transaction_id: transaction.id,
      },
      {
        status: QuotationStatus.COMPLETED,
        quotation_stage: QuotationStage.COMPLETED,
        tira_status: this.resolveTransactionQuotationTiraStatus(transaction),
        tira_request_id: transaction.tiramis_request_id,
        tira_response_id:
          String(transaction.regulatory_response?.['responseId'] ?? '') || null,
        tira_response_code:
          String(transaction.regulatory_response?.['statusCode'] ?? '') || null,
        tira_response_description:
          String(
            transaction.regulatory_response?.['statusDescription'] ?? '',
          ) || null,
        submitted_at: new Date(),
        workflow_completed_at: new Date(),
        updated_by: context.changedBy ?? null,
      },
    );
  }

  private resolveTransactionQuotationTiraStatus(
    transaction: PolicyTransaction,
  ): TiraStatus {
    switch (transaction.transaction_type) {
      case PolicyTransactionType.CANCELLATION:
        return TiraStatus.CANCELLED;
      case PolicyTransactionType.ENDORSEMENT:
        return TiraStatus.ENDORSED;
      default:
        return TiraStatus.SUCCESS;
    }
  }

  private async requireApplicableTransaction(
    companyId: string,
    transactionId: string,
    type: PolicyTransactionType,
  ): Promise<PolicyTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: {
        id: transactionId,
        company_id: companyId,
        transaction_type: type,
      },
    });

    if (!transaction) {
      throw new ConflictException('Policy transaction not found.');
    }

    if (transaction.stage === PolicyTransactionStage.APPLIED) {
      return transaction;
    }

    if (transaction.stage !== PolicyTransactionStage.COMPLETED) {
      throw new ConflictException(
        `Transaction cannot be applied to the policy from stage ${transaction.stage}.`,
      );
    }

    return transaction;
  }

  private async createNextVersion(
    manager: import('typeorm').EntityManager,
    params: {
      policy: Policy;
      previousVersion: PolicyVersion | null;
      transaction: PolicyTransaction;
      versionType: PolicyVersionType;
      policySnapshot: Record<string, unknown>;
      policySnapshotHash: string;
      effectiveFrom: string;
      effectiveTo: string;
      createdBy: string | null;
    },
  ): Promise<PolicyVersion> {
    const repository = manager.getRepository(PolicyVersion);

    if (params.previousVersion) {
      params.previousVersion.is_current = false;
      params.previousVersion.superseded_at = new Date();
      await repository.save(params.previousVersion);
    }

    const versionNumber =
      (params.previousVersion?.version_number ??
        params.transaction.source_policy_version_no) + 1;

    return repository.save({
      company_id: params.policy.company_id,
      policy_id: params.policy.id,
      version_number: versionNumber,
      version_type: params.versionType,
      status: params.policy.policy_status,
      effective_from: params.effectiveFrom,
      effective_to: params.effectiveTo,
      policy_snapshot: params.policySnapshot,
      policy_snapshot_hash: params.policySnapshotHash,
      pricing_snapshot:
        params.transaction.pricing_snapshot ??
        params.previousVersion?.pricing_snapshot ??
        {},
      pricing_result_hash:
        params.transaction.pricing_snapshot_hash ??
        params.previousVersion?.pricing_result_hash ??
        this.hashService.hashDefinition({}),
      customer_snapshot: params.previousVersion?.customer_snapshot ?? {},
      customer_snapshot_hash:
        params.previousVersion?.customer_snapshot_hash ??
        this.hashService.hashDefinition({}),
      asset_manifest: params.previousVersion?.asset_manifest ?? {},
      asset_manifest_hash:
        params.previousVersion?.asset_manifest_hash ??
        this.hashService.hashDefinition({}),
      policy_transaction_id: params.transaction.id,
      supersedes_version_id: params.previousVersion?.id ?? null,
      is_current: true,
      effective_transaction_date: params.transaction.effective_date,
      created_by: params.createdBy,
    });
  }
}
