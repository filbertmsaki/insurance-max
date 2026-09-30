import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PolicyTransactionChangeType } from '@insurance-max/contracts';
import { ProductRiskField } from '../../underwrite/non-motor/entities/product-risk-field.entity';
import {
  validateRiskData,
  type RiskData,
  type RiskFieldDefinition,
} from '../../underwrite/non-motor/risk-field.types';
import { snapshotNonMotorRiskToPolicy } from '../../underwrite/common/issued-policy-links';
import { PolicyTransactionChange } from '../entities/policy-transaction-change.entity';

/** Snapshot root the Non-Motor risk details are endorsed under. */
export const NON_MOTOR_SNAPSHOT_KEY = 'nonMotor';

const RISK_DATA_PATH = /^nonMotor\.riskData\.([a-z][a-z0-9_]*)$/;
const RISK_LOCATION_PATH = 'nonMotor.riskLocation';
const LIMIT_OF_LIABILITY_PATH = 'nonMotor.limitOfLiability';
const RISK_LOCATION_MAX_LENGTH = 255;

/** The Non-Motor risk details of a policy, as endorsed (`snapshot.nonMotor`). */
export interface NonMotorRiskSnapshot {
  riskData: RiskData;
  riskLocation: string | null;
  limitOfLiability: number | null;
}

export interface NonMotorPolicyRiskContext {
  policyId: string;
  companyId: string;
  quotationId: string | null;
  productId: string;
  subClassId: string | null;
  current: NonMotorRiskSnapshot;
}

export interface ResolvedNonMotorChange {
  sourceValue: unknown;
  operation: PolicyTransactionChangeType;
  newValue: unknown;
}

interface PolicyLineRow {
  id: string;
  company_id: string;
  quotation_id: string | null;
  product_id: string;
  sub_class_id: string | null;
  business_line: string | null;
  quotation_flow: string | null;
}

interface RiskDetailRow {
  risk_data: RiskData | null;
  risk_location: string | null;
  limit_of_liability: string | number | null;
}

function toDefinition(field: ProductRiskField): RiskFieldDefinition {
  return {
    field_key: field.field_key,
    label: field.label,
    data_type: field.data_type,
    is_required: field.is_required,
    options: field.options,
    validation_rules: field.validation_rules,
  };
}

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Endorsement of a Non-Motor policy's risk details (`nonMotor.riskData.<key>`,
 * `nonMotor.riskLocation`, `nonMotor.limitOfLiability`).
 *
 * The authoritative current values live in `policy_non_motor_risk_details`
 * (frozen at issuance), not in the policy version snapshot, so the change
 * source values and the proposed snapshot's `nonMotor` block are read from
 * there. Risk data is validated against the product risk schema. These
 * details are not rating factors and are not carried by TIRAMIS, so they
 * neither reprice nor alter the regulatory payload; on apply they are
 * written back to `policy_non_motor_risk_details`.
 */
@Injectable()
export class NonMotorEndorsementService {
  isNonMotorPath(fieldPath: string): boolean {
    return fieldPath.startsWith(`${NON_MOTOR_SNAPSHOT_KEY}.`);
  }

  hasNonMotorChanges(changes: Array<{ field_path: string }>): boolean {
    return changes.some((change) => this.isNonMotorPath(change.field_path));
  }

  /** Current risk details of a Non-Motor policy, or null for other lines. */
  async loadPolicyRisk(
    manager: EntityManager,
    companyId: string,
    policyId: string,
  ): Promise<NonMotorPolicyRiskContext | null> {
    const [policy] = await manager.query<PolicyLineRow[]>(
      `SELECT policy.id, policy.company_id, policy.quotation_id,
              policy.product_id, policy.sub_class_id, policy.business_line,
              quotation.quotation_flow
         FROM policies policy
         LEFT JOIN quotations quotation ON quotation.id = policy.quotation_id
        WHERE policy.id = $1 AND policy.company_id = $2`,
      [policyId, companyId],
    );
    if (!policy) return null;

    const line =
      policy.business_line ??
      (policy.quotation_flow === 'NON_MOTOR' ? 'NON_MOTOR' : null);
    if (line !== 'NON_MOTOR') return null;

    const [issued] = await manager.query<RiskDetailRow[]>(
      `SELECT risk_data, risk_location, limit_of_liability
         FROM policy_non_motor_risk_details
        WHERE policy_id = $1 AND company_id = $2`,
      [policyId, companyId],
    );
    // Policies issued before the policy snapshot existed fall back to the
    // quotation's details, as the policy risk-details view does.
    const [quoted] =
      issued || !policy.quotation_id
        ? []
        : await manager.query<RiskDetailRow[]>(
            `SELECT risk_data, risk_location, limit_of_liability
               FROM quotation_non_motor_details
              WHERE quotation_id = $1 AND company_id = $2`,
            [policy.quotation_id, companyId],
          );
    const detail = issued ?? quoted ?? null;

    return {
      policyId: policy.id,
      companyId: policy.company_id,
      quotationId: policy.quotation_id,
      productId: policy.product_id,
      subClassId: policy.sub_class_id,
      current: {
        riskData: { ...(detail?.risk_data ?? {}) },
        riskLocation: detail?.risk_location ?? null,
        limitOfLiability:
          detail?.limit_of_liability == null
            ? null
            : Number(detail.limit_of_liability),
      },
    };
  }

  /** Active risk fields of the policy's product (sub-class aware). */
  async listFields(
    manager: EntityManager,
    context: Pick<
      NonMotorPolicyRiskContext,
      'companyId' | 'productId' | 'subClassId'
    >,
  ): Promise<ProductRiskField[]> {
    const query = manager
      .getRepository(ProductRiskField)
      .createQueryBuilder('field')
      .where('field.company_id = :companyId', {
        companyId: context.companyId,
      })
      .andWhere('field.product_id = :productId', {
        productId: context.productId,
      })
      .andWhere('field.deleted_at IS NULL')
      .andWhere('field.is_active = true')
      .orderBy("COALESCE(field.section, '')", 'ASC')
      .addOrderBy('field.sort_order', 'ASC')
      .addOrderBy('field.label', 'ASC');

    if (context.subClassId) {
      query.andWhere(
        '(field.sub_class_id IS NULL OR field.sub_class_id = :subClassId)',
        { subClassId: context.subClassId },
      );
    } else {
      query.andWhere('field.sub_class_id IS NULL');
    }

    return query.getMany();
  }

  /**
   * Resolves the authoritative source value of a `nonMotor.*` change and
   * validates/normalises the proposed value. A blank value on an optional
   * field is a removal.
   */
  async resolveChange(
    manager: EntityManager,
    companyId: string,
    policyId: string,
    fieldPath: string,
    operation: PolicyTransactionChangeType,
    newValue: unknown,
  ): Promise<ResolvedNonMotorChange> {
    const context = await this.loadPolicyRisk(manager, companyId, policyId);

    if (!context) {
      throw new UnprocessableEntityException({
        code: 'NON_MOTOR_ENDORSEMENT_NOT_APPLICABLE',
        message: 'Risk details can only be endorsed on a Non-Motor policy.',
      });
    }

    const removing =
      operation === PolicyTransactionChangeType.REMOVE || isBlank(newValue);
    const riskDataKey = RISK_DATA_PATH.exec(fieldPath)?.[1];

    if (riskDataKey) {
      const field = (await this.listFields(manager, context)).find(
        (item) => item.field_key === riskDataKey,
      );

      if (!field) {
        throw new BadRequestException({
          code: 'NON_MOTOR_RISK_FIELD_UNKNOWN',
          message: `"${riskDataKey}" is not a risk field of this product.`,
        });
      }

      const sourceValue = context.current.riskData[riskDataKey];

      if (removing) {
        if (field.is_required) {
          throw new BadRequestException({
            code: 'NON_MOTOR_RISK_DETAILS_INVALID',
            message: `${field.label} is required`,
          });
        }
        return {
          sourceValue,
          operation: PolicyTransactionChangeType.REMOVE,
          newValue: null,
        };
      }

      const { data, errors } = validateRiskData(
        [toDefinition(field)],
        { [riskDataKey]: newValue },
        { enforceRequired: true },
      );

      if (errors.length) {
        throw new BadRequestException({
          code: 'NON_MOTOR_RISK_DETAILS_INVALID',
          message: errors[0].message,
          details: { errors },
        });
      }

      return { sourceValue, operation, newValue: data[riskDataKey] };
    }

    if (fieldPath === RISK_LOCATION_PATH) {
      const sourceValue = context.current.riskLocation ?? undefined;

      if (removing) {
        return {
          sourceValue,
          operation: PolicyTransactionChangeType.REMOVE,
          newValue: null,
        };
      }
      if (typeof newValue !== 'string') {
        throw new BadRequestException('Risk location must be text.');
      }

      const location = newValue.trim();

      if (location.length > RISK_LOCATION_MAX_LENGTH) {
        throw new BadRequestException(
          `Risk location must be at most ${RISK_LOCATION_MAX_LENGTH} characters.`,
        );
      }

      return { sourceValue, operation, newValue: location };
    }

    if (fieldPath === LIMIT_OF_LIABILITY_PATH) {
      const sourceValue = context.current.limitOfLiability ?? undefined;

      if (removing) {
        return {
          sourceValue,
          operation: PolicyTransactionChangeType.REMOVE,
          newValue: null,
        };
      }

      const limit =
        typeof newValue === 'number' ? newValue : Number(String(newValue));

      if (!Number.isFinite(limit) || limit < 0) {
        throw new BadRequestException(
          'Limit of liability must be a non-negative number.',
        );
      }

      return {
        sourceValue,
        operation,
        newValue: Number(limit.toFixed(2)),
      };
    }

    throw new BadRequestException(
      `Field "${fieldPath}" is not editable through endorsement.`,
    );
  }

  /**
   * The source snapshot with the policy's current risk details under
   * `nonMotor`, so the proposed snapshot (and the applied version) carries
   * the complete endorsed block, not only the changed keys.
   */
  async withCurrentRisk(
    manager: EntityManager,
    companyId: string,
    policyId: string,
    snapshot: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const context = await this.loadPolicyRisk(manager, companyId, policyId);

    if (!context) return snapshot;

    return {
      ...snapshot,
      [NON_MOTOR_SNAPSHOT_KEY]: this.toSnapshot(context.current),
    };
  }

  /** Writes the endorsed risk details back to `policy_non_motor_risk_details`. */
  async applyToPolicy(
    manager: EntityManager,
    companyId: string,
    transactionId: string,
    policyId: string,
  ): Promise<boolean> {
    const changes = (
      await manager.getRepository(PolicyTransactionChange).find({
        where: { company_id: companyId, policy_transaction_id: transactionId },
      })
    ).filter((change) => this.isNonMotorPath(change.field_path));

    if (!changes.length) return false;

    const setData: Record<string, unknown> = {};
    const removedKeys: string[] = [];
    let location: { value: string | null } | null = null;
    let limit: { value: string | null } | null = null;

    for (const change of changes) {
      const removed =
        change.operation === PolicyTransactionChangeType.REMOVE ||
        change.new_value === null ||
        change.new_value === undefined;
      const riskDataKey = RISK_DATA_PATH.exec(change.field_path)?.[1];

      if (riskDataKey) {
        if (removed) {
          removedKeys.push(riskDataKey);
        } else {
          setData[riskDataKey] = change.new_value;
        }
      } else if (change.field_path === RISK_LOCATION_PATH) {
        location = { value: removed ? null : String(change.new_value) };
      } else if (change.field_path === LIMIT_OF_LIABILITY_PATH) {
        limit = {
          value: removed ? null : Number(change.new_value).toFixed(2),
        };
      }
    }

    const [policy] = await manager.query<
      Array<{ quotation_id: string | null }>
    >(`SELECT quotation_id FROM policies WHERE id = $1 AND company_id = $2`, [
      policyId,
      companyId,
    ]);

    // Make sure the policy has its own row: frozen from the quotation when
    // it was issued before the snapshot existed, otherwise an empty one.
    if (policy?.quotation_id) {
      await snapshotNonMotorRiskToPolicy(manager, {
        policyId,
        companyId,
        quotationId: policy.quotation_id,
      });
    }
    await manager.query(
      `INSERT INTO policy_non_motor_risk_details
         (company_id, policy_id, quotation_id, product_id, sub_class_id)
       SELECT policy.company_id, policy.id, policy.quotation_id,
              policy.product_id, policy.sub_class_id
         FROM policies policy
        WHERE policy.id = $1 AND policy.company_id = $2
       ON CONFLICT (policy_id) DO NOTHING`,
      [policyId, companyId],
    );

    await manager.query(
      `UPDATE policy_non_motor_risk_details
          SET risk_data = (risk_data - $3::text[]) || $4::jsonb,
              risk_location =
                CASE WHEN $5::boolean THEN $6::varchar ELSE risk_location END,
              limit_of_liability =
                CASE WHEN $7::boolean THEN $8::numeric ELSE limit_of_liability END
        WHERE policy_id = $1 AND company_id = $2`,
      [
        policyId,
        companyId,
        removedKeys,
        JSON.stringify(setData),
        location !== null,
        location?.value ?? null,
        limit !== null,
        limit?.value ?? null,
      ],
    );

    return true;
  }

  /** Current risk details and schema for the endorsement editor. */
  async getContext(
    manager: EntityManager,
    companyId: string,
    policyId: string,
  ) {
    const context = await this.loadPolicyRisk(manager, companyId, policyId);

    if (!context) return null;

    return {
      product_id: context.productId,
      sub_class_id: context.subClassId,
      fields: await this.listFields(manager, context),
      risk_data: context.current.riskData,
      risk_location: context.current.riskLocation,
      limit_of_liability: context.current.limitOfLiability,
    };
  }

  private toSnapshot(current: NonMotorRiskSnapshot): NonMotorRiskSnapshot {
    return {
      riskData: { ...current.riskData },
      riskLocation: current.riskLocation,
      limitOfLiability: current.limitOfLiability,
    };
  }
}
