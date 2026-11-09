import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { AuditService } from '../../../shared/audit/audit.service';
import {
  CompanyConfig,
  ConfigValueType,
} from '../../../platform/company-configs/entities/company-config.entity';
import type { Quotation } from '../entities/quotation.entity';
import {
  EMPTY_APPROVAL_POLICY,
  QUOTATION_APPROVAL_POLICY_KEY,
  QUOTATION_APPROVAL_POLICY_MANAGE_PERMISSION,
  normalizeApprovalPolicy,
  type ApprovalFacts,
  type QuotationApprovalPolicy,
} from './quotation-approval-policy';

@Injectable()
export class QuotationApprovalPolicyService {
  constructor(
    @InjectRepository(CompanyConfig)
    private readonly configRepository: Repository<CompanyConfig>,
    private readonly auditService: AuditService,
  ) {}

  async getPolicy(companyId: string): Promise<QuotationApprovalPolicy> {
    const row = await this.configRepository.findOne({
      where: {
        company_id: companyId,
        config_key: QUOTATION_APPROVAL_POLICY_KEY,
        is_active: true,
      },
    });
    return row
      ? normalizeApprovalPolicy(row.config_value)
      : structuredClone(EMPTY_APPROVAL_POLICY);
  }

  /**
   * Saves the policy. An editor may not change their own direct-approval
   * entry, so nobody can grant (or widen) their own approval authority.
   */
  async updatePolicy(
    companyId: string,
    value: unknown,
    user: AuthenticatedUser,
  ): Promise<QuotationApprovalPolicy> {
    const next = normalizeApprovalPolicy(value);
    const previous = await this.getPolicy(companyId);
    const own = (policy: QuotationApprovalPolicy) =>
      JSON.stringify(
        policy.direct_approval.approvers.find(
          (item) => item.user_id === user.id,
        ) ?? null,
      );
    const selfChange = own(previous) !== own(next);
    if (selfChange) {
      // Exception: a company with a single policy administrator could never
      // configure that person otherwise. Allowed only then, and audited as
      // a critical self-grant.
      const managers = await this.countActivePolicyManagers(companyId);
      if (managers > 1) {
        throw new ForbiddenException(
          'You cannot change your own direct approval authority. Ask another administrator.',
        );
      }
    }

    const existing = await this.configRepository.findOne({
      where: {
        company_id: companyId,
        config_key: QUOTATION_APPROVAL_POLICY_KEY,
      },
    });
    const row =
      existing ??
      this.configRepository.create({
        company_id: companyId,
        config_key: QUOTATION_APPROVAL_POLICY_KEY,
        description:
          'Quotation automatic approval rules and direct approval authority',
      });
    row.config_value = next;
    row.value_type = ConfigValueType.JSON;
    row.is_active = true;
    await this.configRepository.save(row);

    await this.auditService.log({
      userId: user.id,
      companyId,
      action: 'quotation.approval_policy.updated',
      resource: 'company_config',
      resourceId: row.id,
      beforeState: { ...previous },
      afterState: { ...next },
    });
    if (selfChange) {
      await this.auditService.logCritical({
        userId: user.id,
        actorType: 'user',
        companyId,
        action: 'quotation.approval_policy.self_authority_changed',
        eventCategory: 'quotation',
        resource: 'company_config',
        resourceId: row.id,
        reason:
          'Sole approval-policy administrator changed their own direct approval authority',
        beforeState: { approver: JSON.parse(own(previous)) },
        afterState: { approver: JSON.parse(own(next)) },
      });
    }

    return next;
  }

  /**
   * Active members of the company who can manage the approval policy,
   * through a role or a direct grant, minus explicit exclusions.
   */
  /** True when the user is the only active policy administrator. */
  async selfEditAllowed(companyId: string): Promise<boolean> {
    return (await this.countActivePolicyManagers(companyId)) <= 1;
  }

  private async countActivePolicyManagers(companyId: string): Promise<number> {
    const rows: Array<{ count: string }> = await this.configRepository.query(
      `
      SELECT COUNT(DISTINCT cu.user_id)::text AS count
      FROM company_users cu
      JOIN users u ON u.id = cu.user_id
        AND u.deleted_at IS NULL
        AND u.status = 'active'
      JOIN permissions p ON p.name = $2
      WHERE cu.company_id = $1
        AND cu.status = 'active'
        AND (
          EXISTS (
            SELECT 1 FROM company_user_roles cur
            JOIN permission_role pr ON pr.roles_id = cur.role_id
            WHERE cur.company_user_id = cu.id AND pr.permissions_id = p.id
          )
          OR EXISTS (
            SELECT 1 FROM company_user_permissions cup
            WHERE cup.company_user_id = cu.id AND cup.permission_id = p.id
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM company_user_permission_exclusions cupe
          WHERE cupe.company_user_id = cu.id AND cupe.permission_id = p.id
        )
      `,
      [companyId, QUOTATION_APPROVAL_POLICY_MANAGE_PERMISSION],
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** Reads the values the rules look at from a saved quotation aggregate. */
  factsFor(quotation: Quotation): ApprovalFacts {
    const coverNote = quotation.cover_note;
    let maxDiscountPercent = 0;
    const riskCodes = new Set<string>();
    for (const entry of coverNote?.entries ?? []) {
      for (const risk of entry.risks ?? []) {
        if (risk.risk_code?.trim()) {
          riskCodes.add(risk.risk_code.trim().toUpperCase());
        }
        const base = Number(risk.premium_before_discount) || 0;
        const discount = (risk.discounts ?? []).reduce(
          (sum, item) => sum + (Number(item.discount_amount) || 0),
          0,
        );
        if (base > 0) {
          maxDiscountPercent = Math.max(
            maxDiscountPercent,
            (discount / base) * 100,
          );
        }
      }
    }
    const paymentMode = Number(coverNote?.payment_mode);
    return {
      payment_mode: Number.isFinite(paymentMode) ? paymentMode : null,
      product_id: quotation.product_id,
      quotation_flow: String(quotation.quotation_flow),
      branch_id: quotation.branch_id ?? null,
      risk_codes: [...riskCodes],
      total_premium: Number(coverNote?.total_premium_including_tax) || 0,
      max_discount_percent: maxDiscountPercent,
    };
  }
}
