import { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

const logger = new Logger('UnderwriteIssuedPolicyLinks');

export interface IssuedPolicyLinkTarget {
  policyId: string;
  companyId: string;
  quotationId: string;
}

/**
 * Links the fleet register to an issued policy: the fleet gets `policy_id`,
 * and each fleet item gets the `policy_risk_id` created from the same
 * quotation entry risk. Idempotent; never re-points a fleet already linked
 * to another policy.
 */
export async function linkFleetRegisterToPolicy(
  manager: EntityManager,
  { policyId, companyId, quotationId }: IssuedPolicyLinkTarget,
): Promise<void> {
  await manager.query(
    `UPDATE motor_fleets
        SET policy_id = $1,
            status = CASE WHEN status IN ('DRAFT', 'QUOTED') THEN 'ACTIVE' ELSE status END,
            updated_at = now()
      WHERE company_id = $2
        AND quotation_id = $3
        AND deleted_at IS NULL
        AND (policy_id IS NULL OR policy_id = $1)`,
    [policyId, companyId, quotationId],
  );
  await manager.query(
    `UPDATE motor_fleet_items item
        SET policy_risk_id = policy_risk.id,
            updated_at = now()
       FROM motor_fleets fleet, policy_risks policy_risk
      WHERE fleet.id = item.fleet_id
        AND fleet.company_id = $2
        AND fleet.quotation_id = $3
        AND fleet.policy_id = $1
        AND fleet.deleted_at IS NULL
        AND item.deleted_at IS NULL
        AND policy_risk.policy_id = $1
        AND policy_risk.deleted_at IS NULL
        AND policy_risk.quotation_entry_risk_id = item.quotation_entry_risk_id
        AND item.policy_risk_id IS DISTINCT FROM policy_risk.id`,
    [policyId, companyId, quotationId],
  );
}

/**
 * Freezes the quotation's Non-Motor risk details onto the issued policy. The
 * first issuance wins, so later quotation revisions never change what a
 * policy was issued with.
 */
export async function snapshotNonMotorRiskToPolicy(
  manager: EntityManager,
  { policyId, companyId, quotationId }: IssuedPolicyLinkTarget,
): Promise<void> {
  await manager.query(
    `INSERT INTO policy_non_motor_risk_details
       (company_id, policy_id, quotation_id, product_id, sub_class_id,
        risk_data, schema_snapshot, risk_location, limit_of_liability)
     SELECT detail.company_id, $1, detail.quotation_id, detail.product_id,
            detail.sub_class_id, detail.risk_data, detail.schema_snapshot,
            detail.risk_location, detail.limit_of_liability
       FROM quotation_non_motor_details detail
      WHERE detail.company_id = $2
        AND detail.quotation_id = $3
     ON CONFLICT (policy_id) DO NOTHING`,
    [policyId, companyId, quotationId],
  );
}

/**
 * Seeds a renewal quotation's Non-Motor risk details from what the expiring
 * policy was issued with (`policy_non_motor_risk_details`), falling back to
 * the policy's source quotation for policies issued before that snapshot
 * existed. Never overwrites details already captured on the new quotation.
 */
export async function copyNonMotorRiskToQuotation(
  manager: EntityManager,
  params: {
    companyId: string;
    policyId: string;
    sourceQuotationId: string | null;
    targetQuotationId: string;
    userId: string | null;
  },
): Promise<void> {
  await manager.query(
    `INSERT INTO quotation_non_motor_details
       (company_id, quotation_id, product_id, sub_class_id, risk_data,
        schema_snapshot, risk_location, limit_of_liability, updated_by)
     SELECT quotation.company_id, quotation.id, quotation.product_id,
            quotation.sub_class_id, source.risk_data, source.schema_snapshot,
            source.risk_location, source.limit_of_liability, $5
       FROM quotations quotation
       CROSS JOIN LATERAL (
         SELECT risk_data, schema_snapshot, risk_location, limit_of_liability
           FROM (
             SELECT issued.risk_data, issued.schema_snapshot,
                    issued.risk_location, issued.limit_of_liability,
                    0 AS priority
               FROM policy_non_motor_risk_details issued
              WHERE issued.company_id = $1
                AND issued.policy_id = $2
             UNION ALL
             SELECT quoted.risk_data, quoted.schema_snapshot,
                    quoted.risk_location, quoted.limit_of_liability,
                    1 AS priority
               FROM quotation_non_motor_details quoted
              WHERE quoted.company_id = $1
                AND quoted.quotation_id = $3
           ) candidate
          ORDER BY candidate.priority
          LIMIT 1
       ) source
      WHERE quotation.company_id = $1
        AND quotation.id = $4
     ON CONFLICT (quotation_id) DO NOTHING`,
    [
      params.companyId,
      params.policyId,
      params.sourceQuotationId,
      params.targetQuotationId,
      params.userId,
    ],
  );
}

/**
 * Additive issuance follow-up for the Underwrite lines. Runs in a savepoint
 * so a failure is logged and rolled back on its own, never failing issuance.
 */
export async function linkIssuedPolicyToUnderwrite(
  manager: EntityManager,
  target: IssuedPolicyLinkTarget & { quotationFlow: string | null | undefined },
): Promise<void> {
  const link =
    target.quotationFlow === 'MOTOR_FLEET'
      ? linkFleetRegisterToPolicy
      : target.quotationFlow === 'NON_MOTOR'
        ? snapshotNonMotorRiskToPolicy
        : null;
  if (!link) return;

  try {
    await manager.transaction((savepoint) => link(savepoint, target));
  } catch (error) {
    logger.warn(
      `Underwrite link for policy ${target.policyId} skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
