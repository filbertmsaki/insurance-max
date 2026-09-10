import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { QuotationStage } from '@insurance-max/contracts';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyVersion } from '../policies/entities/policy-version.entity';
import { PolicyStatusHistory } from '../policies/entities/policy-status-history.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationStatus } from '../quotations/enums/quotation-status.enum';
import { QuotationStatusHistory } from '../quotations/entities/quotation-status-history.entity';

/** Called only within the successful cover-note issuance transaction. */
export async function applyPolicyReplacement(manager: EntityManager, quotation: Quotation,
  replacement: Policy, hashService: ProductDefinitionHashService) {
  if (!quotation.replacement_source_policy_id || quotation.replacement_applied_at) return;
  const policy = await manager.getRepository(Policy).findOne({
    where: { id: quotation.replacement_source_policy_id, company_id: quotation.company_id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!policy || !['ACTIVE', 'COVER_NOTE_ISSUED'].includes(policy.policy_status) ||
    policy.active_version_id !== quotation.replacement_source_version_id || policy.pending_transaction_id) {
    throw new ConflictException('The original policy changed while its replacement was being prepared. Reconciliation is required.');
  }
  const originalQuotation = await manager.getRepository(Quotation).findOne({
    where: { id: policy.quotation_id!, company_id: quotation.company_id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!originalQuotation || originalQuotation.id === quotation.id) {
    throw new ConflictException('The original quotation could not be resolved.');
  }
  const version = await manager.getRepository(PolicyVersion).findOneByOrFail({
    id: policy.active_version_id!, company_id: quotation.company_id, policy_id: policy.id,
  });
  const now = new Date();
  const reason = `${quotation.replacement_reason ?? 'Policy replacement'} — replaced by ${replacement.policy_no} (${quotation.quotation_no})`;
  const snapshot = { ...version.policy_snapshot, policyStatus: 'CANCELLED',
    replacement: { policyId: replacement.id, quotationId: quotation.id,
      coverNoteReference: replacement.cover_note_no, effectiveDate: replacement.start_date } };
  await manager.getRepository(PolicyVersion).update(version.id, { is_current: false, superseded_at: now });
  const cancelledVersion = await manager.getRepository(PolicyVersion).save({
    company_id: policy.company_id, policy_id: policy.id, version_number: version.version_number + 1,
    version_type: 'CANCELLATION', status: 'CANCELLED', effective_from: replacement.start_date,
    effective_to: replacement.start_date, policy_snapshot: snapshot,
    policy_snapshot_hash: hashService.hashDefinition(snapshot), pricing_snapshot: version.pricing_snapshot,
    pricing_result_hash: version.pricing_result_hash, customer_snapshot: version.customer_snapshot,
    customer_snapshot_hash: version.customer_snapshot_hash, asset_manifest: version.asset_manifest,
    asset_manifest_hash: version.asset_manifest_hash, supersedes_version_id: version.id,
    is_current: true, regulatory_reference: version.regulatory_reference,
    effective_transaction_date: replacement.start_date, created_by: quotation.created_by,
  });
  await manager.getRepository(PolicyStatusHistory).save({policy_id: policy.id,
    old_status: policy.policy_status, new_status: 'CANCELLED', reason, changed_by: null});
  await manager.getRepository(Policy).update(policy.id, {
    policy_status: 'CANCELLED', cancellation_effective_date: replacement.start_date,
    active_version_id: cancelledVersion.id, current_version_no: cancelledVersion.version_number,
    state_version: Number(policy.state_version || 1) + 1,
    metadata: { ...policy.metadata, replaced_by_policy_id: replacement.id, replacement_quotation_id: quotation.id },
  });
  await manager.getRepository(QuotationStatusHistory).save({quotation_id: originalQuotation.id,
    previous_quotation_status: originalQuotation.status, new_quotation_status: QuotationStatus.CANCELLED,
    reason, changed_by_type: 'SYSTEM', transition_type: 'POLICY_REPLACED',
    metadata: { replacement_quotation_id: quotation.id, replacement_policy_id: replacement.id }});
  await manager.getRepository(Quotation).update(originalQuotation.id, {
    status: QuotationStatus.CANCELLED, quotation_stage: QuotationStage.CANCELLED, cancellation_reason: reason,
  });
  await manager.getRepository(Quotation).update(quotation.id, { replacement_applied_at: now });
}
