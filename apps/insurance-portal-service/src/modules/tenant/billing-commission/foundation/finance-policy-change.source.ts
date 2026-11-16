import { ConflictException } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { EntityManager } from 'typeorm';
import { cashObject, cashAmount } from './finance-outgoing.types';
import {
  controlUuid,
  controlScale,
  controlUnits,
} from './finance-receivables.types';
import {
  normalizePolicyChange,
  signedChangeAmount,
  signedUnits,
  type ChangeRef,
  type PolicyChangeEvidence,
} from './finance-policy-change.types';

/** Read-only native adapter. Existing pricing engines remain the owners of calculation. */
export async function readPolicyChangeSource(
  m: EntityManager,
  input: {
    companyId: string;
    transactionId: string;
    sourceRevision: number;
    decimalScale: number;
    originalBilling: ChangeRef;
    previousChange: ChangeRef | null;
    correctionOf: ChangeRef | null;
    effect: PolicyChangeEvidence['effect'];
  },
): Promise<PolicyChangeEvidence> {
  const company = controlUuid(input.companyId),
    transaction = controlUuid(input.transactionId),
    scale = controlScale(input.decimalScale);
  const [t] = await m.query(
    'SELECT * FROM policy_transactions WHERE company_id=$1 AND id=$2 FOR SHARE',
    [company, transaction],
  );
  if (
    !t ||
    t.stage !== 'APPLIED' ||
    t.submission_status !== 'ACCEPTED' ||
    !t.target_policy_version_id ||
    !['ENDORSEMENT', 'CANCELLATION'].includes(t.transaction_type)
  )
    throw new ConflictException(
      'An applied, regulator-accepted endorsement/cancellation is required.',
    );
  const [policy] = await m.query(
    'SELECT id,company_id,quotation_id,customer_id FROM policies WHERE company_id=$1 AND id=$2 FOR SHARE',
    [company, t.source_policy_id],
  );
  const versions = await m.query(
      'SELECT * FROM policy_versions WHERE company_id=$1 AND policy_id=$2 AND id=ANY($3::uuid[]) FOR SHARE',
      [
        company,
        t.source_policy_id,
        [t.source_policy_version_id, t.target_policy_version_id],
      ],
    ),
    before = versions.find((v: any) => v.id === t.source_policy_version_id),
    after = versions.find((v: any) => v.id === t.target_policy_version_id),
    hasher = new ProductDefinitionHashService();
  if (
    !policy ||
    !before ||
    !after ||
    after.supersedes_version_id !== before.id ||
    after.policy_transaction_id !== t.id ||
    before.version_number !== t.source_policy_version_no ||
    after.version_number !== before.version_number + 1 ||
    hasher.hashDefinition(before.policy_snapshot) !==
      before.policy_snapshot_hash ||
    hasher.hashDefinition(after.policy_snapshot) !==
      after.policy_snapshot_hash ||
    !t.pricing_snapshot ||
    hasher.hashDefinition(t.pricing_snapshot) !== t.pricing_snapshot_hash
  )
    throw new ConflictException(
      'Native policy version or pricing evidence differs from its stored hash.',
    );
  // Legacy aggregate fields do not establish a multi-tax breakdown. Only an explicit
  // pricing-owned component object, covered by the native pricing hash, may resolve it.
  const components = t.pricing_snapshot.finance_components ?? null;
  if (
    components &&
    t.tax_difference != null &&
    signedUnits(signedChangeAmount(components.taxDifference, scale)) !==
      signedUnits(signedChangeAmount(t.tax_difference, scale))
  )
    throw new ConflictException(
      'Pricing-owned tax components differ from the native transaction aggregate.',
    );
  const additional = cashAmount(t.additional_premium, scale),
    returned = cashAmount(t.return_premium, scale);
  let invoiceReconciliation: 'MATCHED' | 'UNRESOLVED' =
    controlUnits(additional) === 0n ? 'MATCHED' : 'UNRESOLVED';
  if (controlUnits(additional) > 0n && t.active_invoice_id && components) {
    const [invoice] = await m.query(
      'SELECT * FROM invoices WHERE company_id=$1 AND id=$2 FOR SHARE',
      [company, t.active_invoice_id],
    );
    if (
      invoice &&
      invoice.source_record_id === t.id &&
      invoice.currency === t.currency_code &&
      invoice.pricing_result_hash === t.pricing_snapshot_hash
    ) {
      const n = (v: string) => controlUnits(cashAmount(v, scale));
      const tax = components.taxDifference,
        fees = components.feeDifference;
      if (
        typeof tax === 'string' &&
        typeof fees === 'string' &&
        !tax.startsWith('-') &&
        !fees.startsWith('-') &&
        n(invoice.total_amount) === n(additional) &&
        n(invoice.tax_amount) === n(tax) &&
        n(invoice.charges_amount) === n(fees) &&
        n(invoice.gross_amount) -
          n(invoice.discount_amount) +
          n(invoice.tax_amount) +
          n(invoice.charges_amount) ===
          n(additional)
      )
        invoiceReconciliation = 'MATCHED';
    }
  }
  return normalizePolicyChange({
    schema: 'FINANCE_POLICY_CHANGE_V1',
    id: t.id,
    sourceRevision: input.sourceRevision,
    workflowRevision: t.state_version,
    sourceCompanyId: company,
    policyId: policy.id,
    quotationId: policy.quotation_id,
    customerId: policy.customer_id,
    kind: t.transaction_type,
    stage: t.stage,
    regulatoryStatus: t.submission_status,
    sourceVersion: {
      id: before.id,
      number: before.version_number,
      hash: before.policy_snapshot_hash,
    },
    targetVersion: {
      id: after.id,
      number: after.version_number,
      hash: after.policy_snapshot_hash,
    },
    previousChange: input.previousChange,
    correctionOf: input.correctionOf,
    effect: input.effect,
    effectiveDate: t.effective_date,
    currency: t.currency_code,
    decimalScale: scale,
    originalBilling: input.originalBilling,
    pricing: {
      snapshot: cashObject(t.pricing_snapshot),
      hash: t.pricing_snapshot_hash,
    },
    additionalPremium: additional,
    returnPremium: returned,
    taxDifference: components?.taxDifference ?? null,
    feeDifference: components?.feeDifference ?? null,
    commissionDifference: components?.commissionDifference ?? null,
    taxLines: components?.taxLines ?? null,
    taxEvidenceHash: components?.taxEvidenceHash ?? null,
    invoiceReconciliation,
  });
}
